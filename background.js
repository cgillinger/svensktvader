// background.js
// Bakgrundsskript för Svenskt väder Edge-tillägg
// Hanterar periodiska uppdateringar och notifikationer

// Importera pressure-service.js och uv-service.js
import { getPressureData, buildLocationStationMap } from './pressure-service.js';
import { getUVData, cleanOldUVCache } from './uv-service.js';
import swedishLocations from './locations.js';

// Konstanter
const UPDATE_INTERVAL = 30; // 30 minuter
const STORAGE_KEYS = {
  SELECTED_LOCATION: 'selectedLocation',
  SELECTED_LOCATION_NAME: 'selectedLocationName',
  LAST_UPDATED: 'lastUpdated',
  WEATHER_DATA: 'weatherData',
  API_KEY: 'ipGeolocationApiKey',
  WIND_SCALE: 'windScale',
  SUN_TIMES_CACHE: 'sunTimesCache', // Sol-cache
  // Nycklar för lufttryck
  CURRENT_PRESSURE: 'currentPressure',
  PRESSURE_TREND: 'pressureTrend',
  STATIONS_DATA: 'stationsData',
  STATIONS_UPDATED: 'stationsUpdated',
  LOCATION_STATION_MAP: 'locationStationMap',
  // Toolbar badge-display
  TOOLBAR_DISPLAY: 'toolbarDisplay'  // Värden: 'none', 'temp', 'uv', 'wind', 'pressure'
};

// Konfigurera periodiska uppdateringar när tillägget installeras
chrome.runtime.onInstalled.addListener(() => {
  console.log('Svenskt väder installerat. Konfigurerar periodiska uppdateringar.');
  setupPeriodicUpdates();
  updateToolbarIcon();
});

// Uppdatera toolbar-ikon vid start
chrome.runtime.onStartup.addListener(() => {
  updateToolbarIcon();
});

// Lyssna på inställningsändringar för toolbar-display
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEYS.TOOLBAR_DISPLAY]) {
    updateToolbarIcon();
  }
});

// Konfigurera alarm för periodiska uppdateringar
function setupPeriodicUpdates() {
  chrome.alarms.create('weatherUpdate', { periodInMinutes: UPDATE_INTERVAL });
  
  // Lägg till en daglig uppdatering för att rensa gammal sol-cache
  chrome.alarms.create('cleanSunCache', { periodInMinutes: 24 * 60 }); // En gång per dygn
  
  // Lägg till veckovis uppdatering av stationsdata
  chrome.alarms.create('updateStations', { periodInMinutes: 7 * 24 * 60 }); // En gång per vecka
  
  // NY: Lägg till veckovis rensning av UV-cache
  chrome.alarms.create('cleanUVCache', { periodInMinutes: 7 * 24 * 60 }); // En gång per vecka
}

// Lyssna efter alarm och uppdatera väderdata
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'weatherUpdate') {
    console.log('Alarm utlöst. Uppdaterar väderdata.');
    updateWeatherData();
  } else if (alarm.name === 'cleanSunCache') {
    console.log('Alarm utlöst. Rensar gammal sol-cache.');
    cleanOldSunCache();
  } else if (alarm.name === 'updateStations') {
    console.log('Alarm utlöst. Uppdaterar stationsdata.');
    updateStationsData();
  } else if (alarm.name === 'cleanUVCache') {
    console.log('Alarm utlöst. Rensar gammal UV-cache.');
    cleanOldUVCache();
  }
});

// Funktion för att uppdatera väderdata
function updateWeatherData() {
  // Hämta vald ort från lagring
  chrome.storage.local.get([STORAGE_KEYS.SELECTED_LOCATION, STORAGE_KEYS.SELECTED_LOCATION_NAME], (result) => {
    const selectedLocation = result[STORAGE_KEYS.SELECTED_LOCATION];
    const locationName = result[STORAGE_KEYS.SELECTED_LOCATION_NAME];
    
    if (!selectedLocation || !locationName) {
      console.log('Ingen ort vald. Hoppar över uppdatering.');
      return;
    }
    
    // Tolka orten
    const [lat, lon] = selectedLocation.split(',');
    
    // Hämta väderdata från SMHI API
    fetchWeatherData(lat, lon)
      .then(data => {
        // Spara den uppdaterade datan
        saveWeatherData(data);
        console.log('Väderdata uppdaterades framgångsrikt.');
        
        // Hämta och spara lufttrycksdata
        return getPressureData(locationName, swedishLocations);
      })
      .then(pressureData => {
        console.log('Lufttrycksdata uppdaterad:', pressureData);
        
        // Hämta och spara UV-data
        return getUVData(locationName, parseFloat(lat), parseFloat(lon));
      })
      .then(uvData => {
        console.log('UV-data uppdaterad:', uvData);
        updateToolbarIcon();
      })
      .catch(error => {
        console.error('Fel vid uppdatering av väder-, lufttrycks- eller UV-data:', error);
      });
  });
}

// Funktion för att uppdatera stationsdata
function updateStationsData() {
  buildLocationStationMap(swedishLocations)
    .then(map => {
      console.log('Stations-mappning uppdaterad:', Object.keys(map).length, 'orter mappade');
    })
    .catch(error => {
      console.error('Fel vid uppdatering av stationsdata:', error);
    });
}

// Funktion för att rensa gammal cache för soldata
function cleanOldSunCache() {
  chrome.storage.local.get(null, (items) => {
    const today = new Date().toISOString().split('T')[0]; // Dagens datum i YYYY-MM-DD
    const keysToRemove = [];
    
    // Hitta alla sol-cache nycklar
    for (const key in items) {
      if (key.startsWith(STORAGE_KEYS.SUN_TIMES_CACHE)) {
        // Extrahera datumet från nyckeln
        const parts = key.split('_');
        const dateInKey = parts[parts.length - 1];
        
        // Om datumet är äldre än idag, markera för borttagning
        if (dateInKey < today) {
          keysToRemove.push(key);
        }
      }
    }
    
    // Ta bort gamla nycklar om det finns några
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, () => {
        console.log(`Borttagna ${keysToRemove.length} gamla sol-cache poster.`);
      });
    } else {
      console.log('Ingen gammal sol-cache hittades för borttagning.');
    }
  });
}

// Funktion för att hämta väderdata från SMHI API
async function fetchWeatherData(lat, lon) {
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon}/lat/${lat}/data.json`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`API svarade med status: ${response.status}`);
  }
  
  return await response.json();
}

// Funktion för att spara väderdata till lagring
function saveWeatherData(data) {
  const timestamp = new Date().toISOString();

  chrome.storage.local.set({
    [STORAGE_KEYS.WEATHER_DATA]: data,
    [STORAGE_KEYS.LAST_UPDATED]: timestamp
  });
}

// ── Toolbar badge-display ─────────────────────────────────────────────────────

// Konvertera m/s till Beaufort (kopia från popup.js, service worker har ej tillgång till popup)
function getBeaufortForce(speed) {
  if (speed >= 32.7) return 12;
  if (speed >= 28.5) return 11;
  if (speed >= 24.5) return 10;
  if (speed >= 20.8) return 9;
  if (speed >= 17.2) return 8;
  if (speed >= 13.9) return 7;
  if (speed >= 10.8) return 6;
  if (speed >= 8.0) return 5;
  if (speed >= 5.5) return 4;
  if (speed >= 3.4) return 3;
  if (speed >= 1.6) return 2;
  if (speed >= 0.3) return 1;
  return 0;
}

function getTempColor(temp) {
  if (temp <= -10) return '#9F79EE';
  if (temp <= 0)   return '#00BFFF';
  if (temp <= 10)  return '#4A90D9';
  if (temp <= 20)  return '#3CB371';
  if (temp <= 25)  return '#FF8C00';
  return '#FF4500';
}

function getUVColor(uv) {
  if (uv <= 2)  return '#3CB371';
  if (uv <= 5)  return '#FFD700';
  if (uv <= 7)  return '#FF8C00';
  if (uv <= 10) return '#DC143C';
  return '#9400D3';
}

function getWindColor(beaufort) {
  if (beaufort <= 1) return '#85C1E9';
  if (beaufort <= 3) return '#3CB371';
  if (beaufort <= 5) return '#FFD700';
  if (beaufort <= 7) return '#FF8C00';
  if (beaufort <= 9) return '#FF4500';
  return '#DC143C';
}

// Hämta ett parametervärde ur en SMHI-tidsserie
function getParameterValue(timeSeries, paramName) {
  if (!timeSeries || !timeSeries.parameters) return null;
  const param = timeSeries.parameters.find(p => p.name === paramName);
  return param ? param.values[0] : null;
}

// Uppdatera toolbar-badge baserat på TOOLBAR_DISPLAY-inställningen
async function updateToolbarIcon() {
  const storageResult = await chrome.storage.local.get([
    STORAGE_KEYS.TOOLBAR_DISPLAY,
    STORAGE_KEYS.WEATHER_DATA,
    STORAGE_KEYS.SELECTED_LOCATION_NAME,
    STORAGE_KEYS.PRESSURE_TREND
  ]);

  const displayMode = storageResult[STORAGE_KEYS.TOOLBAR_DISPLAY] || 'temp';

  if (displayMode === 'none') {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  let text = null;
  let bgColor = '#888888';

  if (displayMode === 'temp' || displayMode === 'wind') {
    const weatherData = storageResult[STORAGE_KEYS.WEATHER_DATA];
    if (!weatherData || !weatherData.timeSeries || weatherData.timeSeries.length === 0) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }
    const currentWeather = weatherData.timeSeries[0];

    if (displayMode === 'temp') {
      const temp = getParameterValue(currentWeather, 't');
      if (temp === null) { chrome.action.setBadgeText({ text: '' }); return; }
      text = Math.round(temp) + '°';
      bgColor = getTempColor(temp);
    } else {
      const ws = getParameterValue(currentWeather, 'ws');
      if (ws === null) { chrome.action.setBadgeText({ text: '' }); return; }
      const beaufort = getBeaufortForce(ws);
      text = beaufort.toString();
      bgColor = getWindColor(beaufort);
    }
  } else if (displayMode === 'uv') {
    const locationName = storageResult[STORAGE_KEYS.SELECTED_LOCATION_NAME];
    if (!locationName) { chrome.action.setBadgeText({ text: '' }); return; }
    const uvCacheKey = `uv_cache_${locationName}`;
    const uvResult = await chrome.storage.local.get(uvCacheKey);
    const uvData = uvResult[uvCacheKey];
    if (!uvData || uvData.uvIndex === undefined) { chrome.action.setBadgeText({ text: '' }); return; }
    text = Math.round(uvData.uvIndex).toString();
    bgColor = getUVColor(uvData.uvIndex);
  } else if (displayMode === 'pressure') {
    const trend = storageResult[STORAGE_KEYS.PRESSURE_TREND];
    if (trend === 'Stigande') {
      text = '▲';
    } else if (trend === 'Fallande') {
      text = '▼';
    } else {
      text = '►';
    }
    bgColor = '#5B8DD9';
  }

  if (text === null) { chrome.action.setBadgeText({ text: '' }); return; }

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: bgColor });
  chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
}
