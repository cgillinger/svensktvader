// pressure-service.js
// Hanterar lufttrycks- och trycktrend-funktionalitet för Svenskt Väder

// Konstanter
const METOBS_API_BASE = 'https://opendata-download-metobs.smhi.se/api/version/1.0';
const PRESSURE_PARAMETER = 1; // Parameter 1 är lufttryck (hPa)
const STATION_CACHE_EXPIRE = 7 * 24 * 60 * 60 * 1000; // 7 dagar i millisekunder
const TREND_THRESHOLD = 1.0; // hPa skillnad för att definiera en trend
const STORAGE_KEYS = {
  STATIONS_DATA: 'stationsData',
  STATIONS_UPDATED: 'stationsUpdated',
  LOCATION_STATION_MAP: 'locationStationMap',
  CURRENT_PRESSURE: 'currentPressure',
  PRESSURE_TREND: 'pressureTrend'
};

/**
 * Hämtar alla SMHI-stationer och cachelagrar dem
 * @returns {Promise<Array>} Array med stationsdata
 */
async function fetchAndCacheStations() {
  const url = `${METOBS_API_BASE}/parameter/${PRESSURE_PARAMETER}/station.json`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API svarade med status: ${response.status}`);
    }
    
    const data = await response.json();
    const stations = data.station;
    
    // Spara stationsdata och tidpunkt för uppdatering i cache
    const timestamp = new Date().getTime();
    chrome.storage.local.set({
      [STORAGE_KEYS.STATIONS_DATA]: stations,
      [STORAGE_KEYS.STATIONS_UPDATED]: timestamp
    });
    
    console.log(`Cachade ${stations.length} väderstationer från SMHI`);
    return stations;
  } catch (error) {
    console.error('Fel vid hämtning av stationsdata:', error);
    throw error;
  }
}

/**
 * Hämtar stationsdata, antingen från cache eller från API
 * @returns {Promise<Array>} Array med stationsdata
 */
async function getStations() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEYS.STATIONS_DATA, STORAGE_KEYS.STATIONS_UPDATED], async (result) => {
      const stationsData = result[STORAGE_KEYS.STATIONS_DATA];
      const lastUpdated = result[STORAGE_KEYS.STATIONS_UPDATED] || 0;
      const now = new Date().getTime();
      
      // Om stationerna inte finns i cache eller cache är för gammal
      if (!stationsData || now - lastUpdated > STATION_CACHE_EXPIRE) {
        try {
          const freshStations = await fetchAndCacheStations();
          resolve(freshStations);
        } catch (error) {
          reject(error);
        }
      } else {
        resolve(stationsData);
      }
    });
  });
}

/**
 * Beräknar avstånd mellan två koordinater med haversine-formeln
 * @param {number} lat1 - Latitud för punkt 1
 * @param {number} lon1 - Longitud för punkt 1
 * @param {number} lat2 - Latitud för punkt 2
 * @param {number} lon2 - Longitud för punkt 2
 * @returns {number} Avstånd i kilometer
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Jordens radie i km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Hitta närmaste station för en given koordinat
 * @param {Array} stations - Array med stationsdata
 * @param {number} latitude - Latitud
 * @param {number} longitude - Longitud
 * @returns {Object} Närmaste station
 */
function findNearestStation(stations, latitude, longitude) {
  let nearestStation = null;
  let minDistance = Infinity;
  
  for (const station of stations) {
    // Kontrollera att stationen är aktiv
    if (station.active) {
      const distance = calculateDistance(
        latitude, 
        longitude,
        station.latitude,
        station.longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = station;
      }
    }
  }
  
  return { station: nearestStation, distance: minDistance };
}

/**
 * Bygger upp mappning mellan orter och närmaste stationer
 * @param {Array} locations - Array med orts-koordinater
 * @returns {Promise<Object>} Mappning ort -> stationID
 */
async function buildLocationStationMap(locations) {
  try {
    const stations = await getStations();
    
    if (!stations || stations.length === 0) {
      throw new Error('Inga stationer tillgängliga');
    }
    
    const locationStationMap = {};
    
    for (const location of locations) {
      const { lat, lon, name } = location;
      const { station, distance } = findNearestStation(stations, lat, lon);
      
      if (station) {
        locationStationMap[name] = {
          stationId: station.id,
          stationName: station.name,
          distance: distance.toFixed(1)
        };
      }
    }
    
    // Spara mappningen i cache
    chrome.storage.local.set({ [STORAGE_KEYS.LOCATION_STATION_MAP]: locationStationMap });
    console.log('Mappning mellan orter och stationer uppdaterad');
    
    return locationStationMap;
  } catch (error) {
    console.error('Fel vid byggande av lokations-stations-mappning:', error);
    throw error;
  }
}

/**
 * Hämtar mappning mellan ort och station, skapar om den inte finns
 * @param {Array} locations - Array med orts-koordinater
 * @returns {Promise<Object>} Mappning ort -> stationID
 */
async function getLocationStationMap(locations) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEYS.LOCATION_STATION_MAP], async (result) => {
      const locationStationMap = result[STORAGE_KEYS.LOCATION_STATION_MAP];
      
      if (!locationStationMap) {
        try {
          const newMap = await buildLocationStationMap(locations);
          resolve(newMap);
        } catch (error) {
          reject(error);
        }
      } else {
        resolve(locationStationMap);
      }
    });
  });
}

/**
 * Hämtar senaste lufttrycksdata för en station
 * @param {number} stationId - Stations-ID
 * @returns {Promise<Object>} Lufttrycksdata
 */
async function fetchPressureData(stationId) {
  const url = `${METOBS_API_BASE}/parameter/${PRESSURE_PARAMETER}/station/${stationId}/period/latest-day/data.json`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API svarade med status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Fel vid hämtning av lufttrycksdata för station ${stationId}:`, error);
    throw error;
  }
}

/**
 * Beräknar trycktrend baserat på lufttrycksdata
 * @param {Array} values - Array med tryckobservationer
 * @returns {Object} Aktuellt tryck och trend
 */
function calculatePressureTrend(values) {
  if (!values || values.length < 2) {
    return { currentPressure: null, pressureTrend: "okänt" };
  }
  
  // Sortera värden efter tid för att säkerställa korrekt ordning
  const sortedValues = [...values].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Ta de senaste 6 timmarna om möjligt (eller så många som finns)
  const recentValues = sortedValues.slice(-Math.min(6, sortedValues.length));
  
  // Aktuellt tryck (senaste värdet)
  // VIKTIGT: Konvertera kPa till hPa om värdet är för litet
  let currentPressure = parseFloat(recentValues[recentValues.length - 1].value);
  
  // Första värde i vår tidsserie för jämförelse
  let firstPressure = parseFloat(recentValues[0].value);
  
  // Kontrollera om värdena verkar vara i kPa istället för hPa
  // Normalt lufttryck vid havsytan är cirka 1013.25 hPa
  // Om värdet är under 100, är det troligen i kPa och behöver konverteras
  if (currentPressure < 100) {
    currentPressure = currentPressure * 100; // Konvertera kPa till hPa
    console.log(`Konverterade lufttryck från kPa till hPa: ${currentPressure} hPa`);
  }
  
  if (firstPressure < 100) {
    firstPressure = firstPressure * 100; // Konvertera kPa till hPa
  }
  
  // Beräkna skillnad
  const pressureDifference = currentPressure - firstPressure;
  
  // Bestäm trend
  let pressureTrend;
  if (pressureDifference > TREND_THRESHOLD) {
    pressureTrend = "Stigande";
  } else if (pressureDifference < -TREND_THRESHOLD) {
    pressureTrend = "Fallande";
  } else {
    pressureTrend = "Stabilt";
  }
  
  return { currentPressure, pressureTrend };
}

/**
 * Hämtar och bearbetar lufttrycksdata för en vald plats
 * @param {string} locationName - Ortsnamn
 * @param {Array} locations - Array med ortskoordinater
 * @returns {Promise<Object>} Lufttrycksdata med trend
 */
async function getPressureData(locationName, locations) {
  try {
    // Hämta mappning
    const locationStationMap = await getLocationStationMap(locations);
    
    if (!locationStationMap[locationName]) {
      throw new Error(`Ingen station hittad för ${locationName}`);
    }
    
    const stationInfo = locationStationMap[locationName];
    
    // Hämta data från stationen
    const pressureData = await fetchPressureData(stationInfo.stationId);
    
    if (!pressureData || !pressureData.value || pressureData.value.length === 0) {
      throw new Error(`Ingen tryckdata tillgänglig för ${locationName}`);
    }
    
    // Beräkna trend
    const { currentPressure, pressureTrend } = calculatePressureTrend(pressureData.value);
    
    // Spara data i lagring
    chrome.storage.local.set({
      [STORAGE_KEYS.CURRENT_PRESSURE]: currentPressure,
      [STORAGE_KEYS.PRESSURE_TREND]: pressureTrend
    });
    
    return { 
      currentPressure, 
      pressureTrend,
      stationInfo
    };
  } catch (error) {
    console.error('Fel vid hämtning av lufttrycksdata:', error);
    // Returvärde vid fel för att UI kan hantera det
    return { 
      currentPressure: null, 
      pressureTrend: "okänt",
      error: error.message
    };
  }
}

// Exportera funktioner för användning i popup.js
export {
  getPressureData,
  getLocationStationMap,
  buildLocationStationMap
};