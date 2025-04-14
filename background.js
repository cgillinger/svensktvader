// background.js
// Bakgrundsskript för Svenskt Väder Edge-tillägg
// Hanterar periodiska uppdateringar och notifikationer

// Konstanter
const UPDATE_INTERVAL = 30; // 30 minuter
const STORAGE_KEYS = {
  SELECTED_LOCATION: 'selectedLocation',
  LAST_UPDATED: 'lastUpdated',
  WEATHER_DATA: 'weatherData',
  API_KEY: 'ipGeolocationApiKey',
  WIND_SCALE: 'windScale',
  SUN_TIMES_CACHE: 'sunTimesCache' // Ny konstant för sol-cache
};

// Konfigurera periodiska uppdateringar när tillägget installeras
chrome.runtime.onInstalled.addListener(() => {
  console.log('Svenskt Väder installerat. Konfigurerar periodiska uppdateringar.');
  setupPeriodicUpdates();
});

// Konfigurera alarm för periodiska uppdateringar
function setupPeriodicUpdates() {
  chrome.alarms.create('weatherUpdate', { periodInMinutes: UPDATE_INTERVAL });
  
  // Lägg till en daglig uppdatering för att rensa gammal sol-cache
  chrome.alarms.create('cleanSunCache', { periodInMinutes: 24 * 60 }); // En gång per dygn
}

// Lyssna efter alarm och uppdatera väderdata
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'weatherUpdate') {
    console.log('Alarm utlöst. Uppdaterar väderdata.');
    updateWeatherData();
  } else if (alarm.name === 'cleanSunCache') {
    console.log('Alarm utlöst. Rensar gammal sol-cache.');
    cleanOldSunCache();
  }
});

// Funktion för att uppdatera väderdata
function updateWeatherData() {
  // Hämta vald ort från lagring
  chrome.storage.local.get([STORAGE_KEYS.SELECTED_LOCATION], (result) => {
    const selectedLocation = result.SELECTED_LOCATION;
    
    if (!selectedLocation) {
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
      })
      .catch(error => {
        console.error('Fel vid uppdatering av väderdata:', error);
      });
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