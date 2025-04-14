// popup.js
// Uppdaterat huvudskript för Svenskt Väder Edge-tillägg

import swedishLocations from './locations.js';
import { getPressureData } from './pressure-service.js';

// Konstanter
const SMHI_API_BASE = 'https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point';
const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minuter
const STORAGE_KEYS = {
  SELECTED_LOCATION: 'selectedLocation',
  SELECTED_LOCATION_NAME: 'selectedLocationName',
  LAST_UPDATED: 'lastUpdated',
  WEATHER_DATA: 'weatherData',
  API_KEY: 'ipGeolocationApiKey',
  WIND_SCALE: 'windScale',
  // Nya nycklar för lufttryck
  CURRENT_PRESSURE: 'currentPressure',
  PRESSURE_TREND: 'pressureTrend'
};
// DOM-element
const locationSelect = document.getElementById('location-select');
const selectedLocationName = document.getElementById('selected-location-name');
const loadingIndicator = document.getElementById('loading-indicator');
const weatherDisplay = document.getElementById('weather-display');
const errorMessage = document.getElementById('error-message');
const currentTempValue = document.getElementById('current-temp-value');
const currentWeatherIcon = document.getElementById('current-weather-icon');
const weatherDescription = document.getElementById('weather-description');
const windSpeedIcon = document.getElementById('wind-speed-icon');
const windSpeed = document.getElementById('wind-speed');
const windDirection = document.getElementById('wind-direction');
const humidity = document.getElementById('humidity');
const sunriseTime = document.getElementById('sunrise-time');
const sunsetTime = document.getElementById('sunset-time');
const forecastItems = document.getElementById('forecast-items');
const lastUpdatedSpan = document.getElementById('last-updated');
const pressureValue = document.getElementById('pressure-value');
const pressureTrend = document.getElementById('pressure-trend');
const pressureTrendIcon = document.getElementById('pressure-trend-icon');

// DOM-element för inställningar
const settingsButton = document.getElementById('settings-button');
const closeSettingsButton = document.getElementById('close-settings');
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('api-key-input');
const saveSettingsButton = document.getElementById('save-settings');
const windScaleRadios = document.querySelectorAll('input[name="wind-scale"]');
// Initialisera tillägget
document.addEventListener('DOMContentLoaded', initializeExtension);
/**
 * Initialiserar tillägget, fyller ortsväljaren och laddar väderdata
 */
function initializeExtension() {
  // Fyll ortsväljaren
  populateLocationDropdown();
  
  // Läs tidigare vald ort från lagringen
  chrome.storage.local.get([STORAGE_KEYS.SELECTED_LOCATION, STORAGE_KEYS.SELECTED_LOCATION_NAME], (result) => {
    const savedLocation = result[STORAGE_KEYS.SELECTED_LOCATION];
    const savedLocationName = result[STORAGE_KEYS.SELECTED_LOCATION_NAME];
    
    if (savedLocation) {
      locationSelect.value = savedLocation;
      
      // Visa ortsnamnet
      if (savedLocationName) {
        selectedLocationName.textContent = savedLocationName;
      } else {
        // Om ingen lagrad ort finns, försök hitta ortsnamnet från koordinaterna
        const selectedLocationCoords = savedLocation;
        const locationObj = swedishLocations.find(loc => `${loc.lat},${loc.lon}` === selectedLocationCoords);
        if (locationObj) {
          selectedLocationName.textContent = locationObj.name;
          // Spara ortsnamnet
          chrome.storage.local.set({ [STORAGE_KEYS.SELECTED_LOCATION_NAME]: locationObj.name });
        }
      }
    }
    
    // Ladda väderdata
    loadWeatherData();
  });
  
  // Konfigurera händelselyssnare
  setupEventListeners();
}

/**
 * Fyller ortsväljaren med svenska orter
 */
function populateLocationDropdown() {
  // Rensa befintliga alternativ
  locationSelect.innerHTML = '';
  
  // Lägg till standardalternativ
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Välj en plats...';
  locationSelect.appendChild(defaultOption);
  
  // Lägg till ortsalternativ
  swedishLocations.forEach(location => {
    const option = document.createElement('option');
    option.value = `${location.lat},${location.lon}`;
    option.textContent = location.name;
    locationSelect.appendChild(option);
  });
}

/**
 * Konfigurera händelselyssnare för användargränssnittet
 */
function setupEventListeners() {
  // Inställningsknappar
  settingsButton.addEventListener('click', openSettingsPanel);
  closeSettingsButton.addEventListener('click', closeSettingsPanel);
  saveSettingsButton.addEventListener('click', saveSettings);
  
  // Ändring av ortsväljar-händelse (nu bara i inställningar)
  locationSelect.addEventListener('change', handleLocationChange);
  
  // Ladda sparade inställningar
  loadSavedSettings();
}
/**
 * Laddar sparade inställningar från lagring
 */
function loadSavedSettings() {
  chrome.storage.local.get([STORAGE_KEYS.API_KEY, STORAGE_KEYS.WIND_SCALE], (result) => {
    // Ladda API-nyckel
    const savedApiKey = result[STORAGE_KEYS.API_KEY];
    if (savedApiKey) {
      apiKeyInput.value = savedApiKey;
    }
    
    // Ladda vindskala
    const savedWindScale = result[STORAGE_KEYS.WIND_SCALE] || 'beaufort';
    document.querySelector(`input[name="wind-scale"][value="${savedWindScale}"]`).checked = true;
  });
}

/**
 * Öppnar inställningspanelen
 */
function openSettingsPanel() {
  settingsPanel.style.display = 'block';
}

/**
 * Stänger inställningspanelen
 */
function closeSettingsPanel() {
  settingsPanel.style.display = 'none';
}

/**
 * Sparar inställningar och stänger panelen
 */
function saveSettings() {
  const apiKey = apiKeyInput.value.trim();
  
  // Hämta vald vindskala
  const selectedWindScale = document.querySelector('input[name="wind-scale"]:checked').value;
  
  // Spara inställningar
  chrome.storage.local.set({ 
    [STORAGE_KEYS.API_KEY]: apiKey,
    [STORAGE_KEYS.WIND_SCALE]: selectedWindScale
  });
  
  // Uppdatera väderdata med nya inställningar
  loadWeatherData();
  
  // Stäng inställningspanelen
  closeSettingsPanel();
}

/**
 * Hanterare för när ort ändras
 */
function handleLocationChange() {
  const selectedValue = locationSelect.value;
  const selectedOption = locationSelect.options[locationSelect.selectedIndex];
  const locationName = selectedOption.textContent;
  
  // Uppdatera visad ort
  selectedLocationName.textContent = locationName;
  
  // Spara vald ort i lagringen
  chrome.storage.local.set({ 
    [STORAGE_KEYS.SELECTED_LOCATION]: selectedValue,
    [STORAGE_KEYS.SELECTED_LOCATION_NAME]: locationName
  });
  
  // Ladda väderdata för vald ort
  loadWeatherData();
}

/**
 * Laddar väderdata för vald ort
 */
async function loadWeatherData() {
  const selectedValue = locationSelect.value;
  
  // Om ingen ort är vald, gör ingenting
  if (!selectedValue) {
    return;
  }
  
  // Visa laddningsindikator
  showLoadingState();
  
  // Tolka vald ort
  const [lat, lon] = selectedValue.split(',');
  
  // Hämta ortsnamnet
  const locationName = selectedLocationName.textContent;
  
  try {
    // Hämta väderdata från SMHI API
    const weatherData = await fetchWeatherData(lat, lon);
    
    // Behandla och visa väderdata
    processWeatherData(weatherData);
    
    // Spara data och uppdatera tidsstämpel
    saveWeatherData(weatherData);
    
    // Parallellt, hämta lufttrycksdata för platsen
    getPressureData(locationName, swedishLocations)
      .then(pressureData => {
        updatePressureDisplay(pressureData);
      })
      .catch(error => {
        console.error('Fel vid hämtning av lufttrycksdata:', error);
        hidePressureDisplay();
      });
    
    // Visa väderdisplayen
    showWeatherDisplay();
  } catch (error) {
    console.error('Fel vid laddning av väderdata:', error);
    showErrorState();
  }
}
/**
 * Hämtar väderdata från SMHI API
 * @param {string} lat - Latitud
 * @param {string} lon - Longitud
 * @returns {Promise} Promise med väderdata
 */
async function fetchWeatherData(lat, lon) {
  const url = `${SMHI_API_BASE}/lon/${lon}/lat/${lat}/data.json`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`API svarade med status: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Behandlar och visar väderdata
 * @param {Object} data - Väderdata från SMHI API
 */
async function processWeatherData(data) {
  // Hämta aktuell väderdata (första tidsserien)
  const currentWeather = data.timeSeries[0];
  
  // Extrahera dataparametrar
  const temperature = getParameterValue(currentWeather, 't');
  const weatherSymbol = getParameterValue(currentWeather, 'Wsymb2');
  const windSpeedValue = getParameterValue(currentWeather, 'ws');
  const windDirectionValue = getParameterValue(currentWeather, 'wd');
  const humidityValue = getParameterValue(currentWeather, 'r');
  const precipitationValue = getParameterValue(currentWeather, 'pmin');
  const cloudCoverValue = getParameterValue(currentWeather, 'tcc_mean');
  
  // Uppdatera UI med aktuell väderinformation
  currentTempValue.textContent = temperature.toFixed(1);
  
  // Använd väderikonklassen baserat på väderförhållanden och tid på dygnet
  await updateWeatherIcon(weatherSymbol);
  
  // Sätt väderbeskrivningen
  weatherDescription.textContent = getWeatherDescription(weatherSymbol);
  
  // Formatera och visa vindhastighet baserat på användarinställning
  const windInfo = await formatWindSpeed(windSpeedValue);
  windSpeed.textContent = windInfo.text;
  
  // Uppdatera vindikon baserat på vindskala
  updateWindIcon(windInfo.beaufort, windInfo.scale);
  
  // Uppdatera vindriktningsikon och text
  updateWindDirection(windDirectionValue);
  
  // Uppdatera luftfuktighet (nu i den blå panelen)
  humidity.textContent = `${humidityValue}%`;
  
  // Beräkna och visa soluppgång/solnedgång baserat på ort
  const [lat, lon] = locationSelect.value.split(',');
  const sunTimes = await getSunTimes(parseFloat(lat), parseFloat(lon), new Date());
  sunriseTime.textContent = formatTime(sunTimes.sunrise);
  sunsetTime.textContent = formatTime(sunTimes.sunset);
  
  // Uppdatera prognos med mer detaljerad information
  updateForecast(data.timeSeries.slice(0, 24));
  
  // Uppdatera tidsstämpel
  const now = new Date();
  lastUpdatedSpan.textContent = formatTime(now);
}

/**
 * Uppdaterar lufttrycksdisplayen baserat på hämtad data
 * @param {Object} pressureData - Objekt med lufttrycksdata
 */
function updatePressureDisplay(pressureData) {
  const container = document.querySelector('.pressure-detail');
  
  if (!pressureData || pressureData.currentPressure === null) {
    // Dölj panelen om ingen data
    if (container) {
      container.style.display = 'none';
    }
    return;
  }
  
  // Visa panelen
  if (container) {
    container.style.display = 'flex';
  }
  
  // Uppdatera värden
  if (pressureValue) {
    pressureValue.textContent = `${pressureData.currentPressure.toFixed(1)} hPa`;
  }
  
  if (pressureTrend) {
    pressureTrend.textContent = pressureData.pressureTrend;
  }
  
  // Uppdatera trändikon baserat på trend
  if (pressureTrendIcon) {
    updatePressureTrendIcon(pressureData.pressureTrend);
  }
}

/**
 * Uppdaterar trycktrend-ikonen baserat på trend
 * @param {string} trend - Trycktrend ("Stigande", "Fallande" eller "Stabilt")
 */
function updatePressureTrendIcon(trend) {
  // Rensa befintliga klasser
  pressureTrendIcon.className = 'wi';
  
  // Lägg till lämplig ikon
  switch (trend) {
    case 'Stigande':
      pressureTrendIcon.classList.add('wi-direction-up');
      pressureTrendIcon.style.color = '#4caf50'; // Grön
      break;
    case 'Fallande':
      pressureTrendIcon.classList.add('wi-direction-down');
      pressureTrendIcon.style.color = '#f44336'; // Röd
      break;
    case 'Stabilt':
      pressureTrendIcon.classList.add('wi-direction-right');
      pressureTrendIcon.style.color = '#ff9800'; // Gul/orange
      break;
    default:
      pressureTrendIcon.classList.add('wi-na');
      pressureTrendIcon.style.color = '#9e9e9e'; // Grå
      break;
  }
}

/**
 * Döljer lufttrycksdisplayen vid fel
 */
function hidePressureDisplay() {
  const container = document.querySelector('.pressure-detail');
  if (container) {
    container.style.display = 'none';
  }
}
/**
 * Uppdaterar väderikon baserat på väderförhållanden och tid på dygnet
 * @param {number} symbol - SMHI vädersymbolkod
 */
async function updateWeatherIcon(symbol) {
  // Beräkna om det är dag eller natt baserat på aktuell tid och soluppgång/nedgång
  const now = new Date();
  const [lat, lon] = locationSelect.value.split(',');
  const sunTimes = await getSunTimes(parseFloat(lat), parseFloat(lon), now);
  const isDayTime = now > sunTimes.sunrise && now < sunTimes.sunset;
  
  // Sätt rätt ikoner (dag/natt version)
  currentWeatherIcon.className = `wi ${getWeatherIconClass(symbol, isDayTime)}`;
}

/**
 * Uppdaterar vindikon baserat på Beaufort-skala
 * @param {number} beaufortForce - Beaufort-styrka (0-12)
 * @param {string} scale - Vald vindskala (ms, beaufort, textsea)
 */
function updateWindIcon(beaufortForce, scale) {
  if (scale === 'beaufort') {
    // Använd Beaufort-specifika ikoner
    windSpeedIcon.className = `wi wi-wind-beaufort-${beaufortForce}`;
  } else {
    // Använd generella vindikoner baserat på vindstyrka
    if (beaufortForce >= 9) {
      windSpeedIcon.className = 'wi wi-hurricane';
    } else if (beaufortForce >= 7) {
      windSpeedIcon.className = 'wi wi-strong-wind';
    } else if (beaufortForce >= 4) {
      windSpeedIcon.className = 'wi wi-windy';
    } else if (beaufortForce >= 1) {
      windSpeedIcon.className = 'wi wi-day-light-wind';
    } else {
      windSpeedIcon.className = 'wi wi-day-sunny';
    }
  }
}

/**
 * Uppdaterar vindriktningsikon och text
 * @param {number} degrees - Vindriktning i grader
 */
function updateWindDirection(degrees) {
  const directionText = getWindDirection(degrees);
  
  // Uppdatera text
  windDirection.textContent = directionText;
  
  // Uppdatera vindriktningsikon (dynamisk rotation)
  // Viktigt: Vindriktning anger VARIFRÅN vinden kommer, inte VART den blåser
  const windDirectionIcon = document.querySelector('.direction-icon');
  if (windDirectionIcon) {
    windDirectionIcon.className = `wi wi-wind from-${degrees}-deg direction-icon`;
  }
}

/**
 * Hämtar en parametervärde från SMHI API-data
 * @param {Object} weatherData - Väderdata-objekt
 * @param {string} name - Parameternamn
 * @returns {number} Parametervärde
 */
function getParameterValue(weatherData, name) {
  const parameter = weatherData.parameters.find(p => p.name === name);
  return parameter ? parameter.values[0] : null;
}

/**
 * Uppdaterar prognosdelen med timsförutsägelser
 * @param {Array} timeSeries - Array med tidsseriedata
 */
function updateForecast(timeSeries) {
  // Rensa befintliga prognosobjekt
  forecastItems.innerHTML = '';
  
  // Loopa genom tidsserien (var tredje timme) för prognosen
  for (let i = 1; i < Math.min(13, timeSeries.length); i += 3) {
    const forecastData = timeSeries[i];
    const forecastTime = new Date(forecastData.validTime);
    const temp = getParameterValue(forecastData, 't');
    const symbol = getParameterValue(forecastData, 'Wsymb2');
    const precipitation = getParameterValue(forecastData, 'pmedian');
    
    // Skapa prognosobjekt
    const forecastItem = document.createElement('div');
    forecastItem.className = 'forecast-item';
    
    const timeElem = document.createElement('div');
    timeElem.className = 'forecast-time';
    timeElem.textContent = formatTime(forecastTime);
    
    const iconElem = document.createElement('div');
    iconElem.className = 'forecast-icon';
    // Beräkna om prognostiden är under dagtid
    const isDaytime = 
      forecastTime.getHours() >= 6 && 
      forecastTime.getHours() <= 20; // Förenklad dagtid 6:00-20:00
    iconElem.innerHTML = `<i class="wi ${getWeatherIconClass(symbol, isDaytime)}"></i>`;
    
    const tempElem = document.createElement('div');
    tempElem.className = 'forecast-temp';
    // ÄNDRAT: Visa temperaturen med en decimal istället för noll decimaler
    tempElem.textContent = `${temp.toFixed(1)}°C`;
    
    // Lägg till förhållandebeskrivning
    const conditionElem = document.createElement('div');
    conditionElem.className = 'forecast-condition';
    conditionElem.textContent = getShortWeatherDescription(symbol);
    
    // Lägg till temperaturfärgklass
    if (temp <= 0) {
      tempElem.classList.add('cold-temp');
    } else if (temp >= 20) {
      tempElem.classList.add('warm-temp');
    }
    
    // Lägg till element till prognosobjekt
    forecastItem.appendChild(timeElem);
    forecastItem.appendChild(iconElem);
    forecastItem.appendChild(tempElem);
    forecastItem.appendChild(conditionElem);
    
    // Lägg till prognosobjektet i behållaren
    forecastItems.appendChild(forecastItem);
  }
}

/**
 * Hämtar väderikonklass baserat på SMHI väderssymbol
 * @param {number} symbol - SMHI vädersymbolkod
 * @param {boolean} isDayTime - Om det är dag (true) eller natt (false)
 * @returns {string} Väderikonklass
 */
function getWeatherIconClass(symbol, isDayTime) {
  const timePrefix = isDayTime ? 'day' : 'night';
  
  switch (symbol) {
    case 1: return isDayTime ? 'wi-day-sunny' : 'wi-night-clear'; // Klart
    case 2: return `wi-${timePrefix}-sunny-overcast`; // Nästan klart
    case 3: return `wi-${timePrefix}-cloudy`; // Växlande molnighet
    case 4: return `wi-${timePrefix}-cloudy`; // Halvklart
    case 5: return 'wi-cloudy'; // Molnigt
    case 6: return 'wi-cloudy'; // Mulet
    case 7: return 'wi-fog'; // Dimma
    case 8: return isDayTime ? 'wi-day-showers' : 'wi-night-alt-showers'; // Lätta regnskurar
    case 9: return isDayTime ? 'wi-day-showers' : 'wi-night-alt-showers'; // Måttliga regnskurar
    case 10: return isDayTime ? 'wi-day-rain' : 'wi-night-alt-rain'; // Kraftiga regnskurar
    case 11: return isDayTime ? 'wi-day-thunderstorm' : 'wi-night-alt-thunderstorm'; // Åskväder
    case 12: return isDayTime ? 'wi-day-sleet' : 'wi-night-alt-sleet'; // Lätta snöblandade regnskurar
    case 13: return isDayTime ? 'wi-day-sleet' : 'wi-night-alt-sleet'; // Måttliga snöblandade regnskurar
    case 14: return isDayTime ? 'wi-day-sleet' : 'wi-night-alt-sleet'; // Kraftiga snöblandade regnskurar
    case 15: return isDayTime ? 'wi-day-snow' : 'wi-night-alt-snow'; // Lätta snöbyar
    case 16: return isDayTime ? 'wi-day-snow' : 'wi-night-alt-snow'; // Måttliga snöbyar
    case 17: return isDayTime ? 'wi-day-snow' : 'wi-night-alt-snow'; // Kraftiga snöbyar
    case 18: return 'wi-rain'; // Lätt regn
    case 19: return 'wi-rain'; // Måttligt regn
    case 20: return 'wi-rain'; // Kraftigt regn
    case 21: return 'wi-thunderstorm'; // Åska
    case 22: return 'wi-sleet'; // Lätt snöblandat regn
    case 23: return 'wi-sleet'; // Måttligt snöblandat regn
    case 24: return 'wi-sleet'; // Kraftigt snöblandat regn
    case 25: return 'wi-snow'; // Lätt snöfall
    case 26: return 'wi-snow'; // Måttligt snöfall
    case 27: return 'wi-snow'; // Kraftigt snöfall
    default: return 'wi-day-sunny'; // Standard
  }
}

/**
 * Hämtar väderbeskrivning baserat på SMHI vädersymbol
 * @param {number} symbol - SMHI vädersymbolkod
 * @returns {string} Väderbeskrivning på svenska
 */
function getWeatherDescription(symbol) {
  switch (symbol) {
    case 1: return 'Klart';
    case 2: return 'Nästan klart';
    case 3: return 'Växlande molnighet';
    case 4: return 'Halvklart';
    case 5: return 'Molnigt';
    case 6: return 'Mulet';
    case 7: return 'Dimma';
    case 8: return 'Lätta regnskurar';
    case 9: return 'Måttliga regnskurar';
    case 10: return 'Kraftiga regnskurar';
    case 11: return 'Åskväder';
    case 12: return 'Lätta snöblandade regnskurar';
    case 13: return 'Måttliga snöblandade regnskurar';
    case 14: return 'Kraftiga snöblandade regnskurar';
    case 15: return 'Lätta snöbyar';
    case 16: return 'Måttliga snöbyar';
    case 17: return 'Kraftiga snöbyar';
    case 18: return 'Lätt regn';
    case 19: return 'Måttligt regn';
    case 20: return 'Kraftigt regn';
    case 21: return 'Åska';
    case 22: return 'Lätt snöblandat regn';
    case 23: return 'Måttligt snöblandat regn';
    case 24: return 'Kraftigt snöblandat regn';
    case 25: return 'Lätt snöfall';
    case 26: return 'Måttligt snöfall';
    case 27: return 'Kraftigt snöfall';
    default: return 'Okänt väder';
  }
}

/**
 * Hämtar kortfattad väderbeskrivning för prognosvyer
 * @param {number} symbol - SMHI vädersymbolkod
 * @returns {string} Kortfattad väderbeskrivning
 */
function getShortWeatherDescription(symbol) {
  switch (symbol) {
    case 1: return 'Klart';
    case 2: case 3: case 4: return 'Delvis molnigt';
    case 5: return 'Molnigt';
    case 6: return 'Mulet';
    case 7: return 'Dimma';
    case 8: case 9: case 10: return 'Regnskurar';
    case 11: return 'Åska';
    case 12: case 13: case 14: return 'Snöblandat regn';
    case 15: case 16: case 17: return 'Snöbyar';
    case 18: case 19: case 20: return 'Regn';
    case 21: return 'Åska';
    case 22: case 23: case 24: return 'Snöblandat regn';
    case 25: case 26: case 27: return 'Snöfall';
    default: return '';
  }
}

/**
 * Hämtar vindriktning som kompasspunkt
 * @param {number} degrees - Vindriktning i grader
 * @returns {string} Vindriktning som kompasspunkt
 */
function getWindDirection(degrees) {
  if (degrees === null || degrees === undefined) {
    return 'N/A';
  }

  const compassPoints = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
  const index = Math.round(degrees / 22.5) % 16;
  return compassPoints[index];
}

/**
 * Konverterar vindhastighet till olika enheter baserat på användarval
 * @param {number} speedInMS - Vindhastighet i m/s
 * @returns {Object} Objekt med formaterad vindhastighet, beaufort-styrka och vald skala
 */
async function formatWindSpeed(speedInMS) {
  if (speedInMS === null || speedInMS === undefined) {
    return { 
      text: 'N/A', 
      beaufort: 0, 
      scale: 'ms' 
    };
  }
  
  // Hämta användarens val för vindskala
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.WIND_SCALE], resolve);
  });
  const windScale = result[STORAGE_KEYS.WIND_SCALE] || 'beaufort'; // Standard är nu Beaufort
  
  // Beräkna Beaufort-värde för vindikon oavsett visningsformat
  const beaufortForce = getBeaufortForce(speedInMS);
  
  // Formatera text baserat på vald skala
  let formattedText;
  switch (windScale) {
    case 'beaufort':
      formattedText = `${beaufortForce} Bft`;
      break;
      
    case 'textsea':
      formattedText = getTextSea(speedInMS);
      break;
      
    case 'ms':
    default:
      formattedText = `${speedInMS.toFixed(1)} m/s`;
      break;
  }
  
  return {
    text: formattedText,
    beaufort: beaufortForce,
    scale: windScale
  };
}

/**
 * Konverterar vindhastighet till Beaufort-skala
 * @param {number} speed - Vindhastighet i m/s
 * @returns {number} Beaufort-skalevärde (0-12)
 */
function getBeaufortForce(speed) {
  if (speed >= 32.7) return 12;  // Orkan
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
  return 0;  // Stiltje
}

/**
 * Konverterar vindhastighet till beskrivande text
 * @param {number} speed - Vindhastighet i m/s
 * @returns {string} Beskrivande text för vindhastigheten på svenska
 */
function getTextSea(speed) {
  if (speed >= 32.7) return "Orkan";
  if (speed >= 28.5) return "Svår storm";
  if (speed >= 24.5) return "Storm";
  if (speed >= 20.8) return "Hård storm";
  if (speed >= 17.2) return "Hård kuling";
  if (speed >= 13.9) return "Kuling";
  if (speed >= 10.8) return "Frisk kuling";
  if (speed >= 8.0) return "Frisk vind";
  if (speed >= 5.5) return "Måttlig vind";
  if (speed >= 3.4) return "Lätt vind";
  if (speed >= 1.6) return "Svag vind";
  if (speed >= 0.3) return "Bris";
  return "Stiltje";
}

/**
 * Beräknar soluppgång och solnedgång med IP Geolocation API om API-nyckel finns,
 * annars använd en förenklad beräkning.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {Date} date - Datum att beräkna för
 * @returns {Promise<Object>} Objekt med soluppgång och solnedgång
 */
async function getSunTimes(lat, lon, date) {
  // Kontrollera om API-nyckel finns
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.API_KEY], resolve);
  });
  const apiKey = result[STORAGE_KEYS.API_KEY];
  
  if (apiKey) {
    try {
      // Använd IP Geolocation API
      const url = `https://api.ipgeolocation.io/astronomy?apiKey=${apiKey}&lat=${lat}&long=${lon}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        // Omvandla till Date-objekt
        const sunriseDate = new Date(date);
        const sunsetDate = new Date(date);
        
        // Sätt timmar och minuter från API-data
        const [sunriseHours, sunriseMinutes] = data.sunrise.split(':');
        sunriseDate.setHours(parseInt(sunriseHours), parseInt(sunriseMinutes), 0);
        
        const [sunsetHours, sunsetMinutes] = data.sunset.split(':');
        sunsetDate.setHours(parseInt(sunsetHours), parseInt(sunsetMinutes), 0);
        
        return { 
          sunrise: sunriseDate, 
          sunset: sunsetDate,
          moonrise: data.moonrise,
          moonset: data.moonset 
        };
      }
    } catch (error) {
      console.error('Fel vid hämtning av soldata:', error);
    }
  }
  
  // Fallback till förenklad beräkning
  return calculateSunTimes(lat, lon, date);
}

/**
 * Beräknar soluppgång och solnedgång för en plats (förenklad beräkning)
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {Date} date - Datum att beräkna för
 * @returns {Object} Objekt med soluppgång och solnedgång
 */
function calculateSunTimes(lat, lon, date) {
  // Detta är en förenklad beräkning. För en mer exakt beräkning
  // skulle vi behöva ett ordentligt astronomiskt bibliotek.
  
  // För närvarande använder vi en enkel approximation
  const day = date.getDate();
  const month = date.getMonth() + 1;
  
  // Väldigt grov uppskattning baserad på månad och latitud
  let sunriseHour, sunsetHour;
  
  if (month >= 4 && month <= 9) {
    // Sommarmånader
    sunriseHour = 4 + (60 - lat) / 15;
    sunsetHour = 21 - (60 - lat) / 15;
  } else {
    // Vintermånader
    sunriseHour = 7 + (60 - lat) / 12;
    sunsetHour = 16 - (60 - lat) / 12;
  }
  
  // Begränsa värden
  sunriseHour = Math.max(0, Math.min(23, sunriseHour));
  sunsetHour = Math.max(0, Math.min(23, sunsetHour));
  
  const sunrise = new Date(date);
  sunrise.setHours(Math.floor(sunriseHour), Math.round((sunriseHour % 1) * 60), 0);
  
  const sunset = new Date(date);
  sunset.setHours(Math.floor(sunsetHour), Math.round((sunsetHour % 1) * 60), 0);
  
  return { sunrise, sunset };
}

/**
 * Formaterar ett Date-objekt till en tidssträng (HH:MM)
 * @param {Date} date - Date-objekt
 * @returns {string} Formaterad tidssträng
 */
function formatTime(date) {
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Visar laddningstillstånd i UI
 */
function showLoadingState() {
  loadingIndicator.style.display = 'flex';
  weatherDisplay.style.display = 'none';
  errorMessage.style.display = 'none';
  settingsPanel.style.display = 'none';
}

/**
 * Visar väderdisplayen
 */
function showWeatherDisplay() {
  loadingIndicator.style.display = 'none';
  weatherDisplay.style.display = 'block';
  errorMessage.style.display = 'none';
}

/**
 * Visar feltillstånd i UI
 */
function showErrorState() {
  loadingIndicator.style.display = 'none';
  weatherDisplay.style.display = 'none';
  errorMessage.style.display = 'flex';
  settingsPanel.style.display = 'none';
}

/**
 * Sparar väderdata till lagring
 * @param {Object} data - Väderdata att spara
 */
function saveWeatherData(data) {
  const timestamp = new Date().toISOString();
  
  // Spara till Chrome-lagring
  chrome.storage.local.set({
    [STORAGE_KEYS.WEATHER_DATA]: data,
    [STORAGE_KEYS.LAST_UPDATED]: timestamp
  });
}