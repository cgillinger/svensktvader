// background.js
// Bakgrundsskript för Svenskt väder Edge-tillägg
// Hanterar periodiska uppdateringar och notifikationer

// Importera pressure-service.js
import { getPressureData, buildLocationStationMap } from './pressure-service.js';
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
  LOCATION_STATION_MAP: 'locationStationMap'
};

// Konfigurera periodiska uppdateringar när tillägget installeras
chrome.runtime.onInstalled.addListener(() => {
  console.log('Svenskt väder installerat. Konfigurerar periodiska uppdateringar.');
  setupPeriodicUpdates();
});

// Konfigurera alarm för periodiska uppdateringar
function setupPeriodicUpdates() {
  chrome.alarms.create('weatherUpdate', { periodInMinutes: UPDATE_INTERVAL });
  
  // Lägg till en daglig uppdatering för att rensa gammal sol-cache
  chrome.alarms.create('cleanSunCache', { periodInMinutes: 24 * 60 }); // En gång per dygn
  
  // Lägg till veckovis uppdatering av stationsdata
  chrome.alarms.create('updateStations', { periodInMinutes: 7 * 24 * 60 }); // En gång per vecka
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
      })
      .catch(error => {
        console.error('Fel vid uppdatering av väder- eller lufttrycksdata:', error);
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
  const url = `https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/${lon}/lat/${lat}/data.json`;
  
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