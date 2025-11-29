// popup.js
// Uppdaterat huvudskript för Svenskt Väder Edge-tillägg med UV-index

import swedishLocations from './locations.js';
import { getPressureData } from './pressure-service.js';
import { getUVData } from './uv-service.js';

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
  SHOW_UV_INDEX: 'showUVIndex',
  PRESSURE_UNIT: 'pressureUnit',
  CARD_LAYOUT: 'cardLayout',
  // Nycklar för lufttryck
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
const dailyForecastItems = document.getElementById('daily-forecast-items');
const lastUpdatedSpan = document.getElementById('last-updated');
const pressureValue = document.getElementById('pressure-value');
const pressureTrend = document.getElementById('pressure-trend');
const pressureTrendDescription = document.getElementById('pressure-trend-description');
const pressureTrendIcon = document.getElementById('pressure-trend-icon');

// DOM-element för UV-index
const uvIndexBar = document.getElementById('uv-index-bar');
const uvSunIcon = document.getElementById('uv-sun-icon');
const uvValue = document.getElementById('uv-value');
const uvRiskText = document.getElementById('uv-risk-text');

// DOM-element för inställningar
const settingsButton = document.getElementById('settings-button');
const closeSettingsButton = document.getElementById('close-settings');
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('api-key-input');
const saveSettingsButton = document.getElementById('save-settings');
const windScaleRadios = document.querySelectorAll('input[name="wind-scale"]');
const pressureUnitRadios = document.querySelectorAll('input[name="pressure-unit"]');
const showUVIndexCheckbox = document.getElementById('show-uv-index');

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
  
  // Initialisera kortlayout
  initializeCardLayout();
}

/**
 * Laddar sparade inställningar från lagring
 */
function loadSavedSettings() {
  chrome.storage.local.get([
    STORAGE_KEYS.API_KEY, 
    STORAGE_KEYS.WIND_SCALE, 
    STORAGE_KEYS.SHOW_UV_INDEX,
    STORAGE_KEYS.PRESSURE_UNIT
  ], (result) => {
    // Ladda API-nyckel
    const savedApiKey = result[STORAGE_KEYS.API_KEY];
    if (savedApiKey) {
      apiKeyInput.value = savedApiKey;
      // Uppdatera API-nyckelstatus till "Använder exakta soltider"
      updateApiKeyStatus(savedApiKey);
    } else {
      // Säkerställ att status visar "Använder förenklad beräkning" om ingen nyckel finns
      updateApiKeyStatus('');
    }
    
    // Ladda vindskala
    const savedWindScale = result[STORAGE_KEYS.WIND_SCALE] || 'beaufort';
    document.querySelector(`input[name="wind-scale"][value="${savedWindScale}"]`).checked = true;
    
    // Ladda tryckenhet
    const savedPressureUnit = result[STORAGE_KEYS.PRESSURE_UNIT] || 'hpa';
    document.querySelector(`input[name="pressure-unit"][value="${savedPressureUnit}"]`).checked = true;
    
    // Ladda UV-index visning (standard: true)
    const showUV = result[STORAGE_KEYS.SHOW_UV_INDEX] !== undefined ? result[STORAGE_KEYS.SHOW_UV_INDEX] : true;
    showUVIndexCheckbox.checked = showUV;
  });
}

/**
 * Uppdaterar status för API-nyckeln i UI
 * @param {string} apiKey - API-nyckeln att validera
 */
function updateApiKeyStatus(apiKey) {
  const apiKeyStatus = document.getElementById('api-key-status');
  const apiKeyIcon = document.getElementById('api-key-icon');
  const apiKeyMessage = document.getElementById('api-key-message');
  
  if (!apiKey || apiKey.length < 10) {
    // Ingen eller för kort API-nyckel
    apiKeyStatus.className = 'api-key-status';
    apiKeyIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
    apiKeyMessage.textContent = 'Soldata: Använder förenklad beräkning';
  } else {
    // API-nyckel finns - anta att den är giltig
    apiKeyStatus.className = 'api-key-status valid';
    apiKeyIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
    apiKeyMessage.textContent = 'Soldata: Använder exakta soltider';
  }
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
  
  // Hämta vald tryckenhet
  const selectedPressureUnit = document.querySelector('input[name="pressure-unit"]:checked').value;
  
  // Hämta UV-visning inställning
  const showUV = showUVIndexCheckbox.checked;
  
  // Spara inställningar
  chrome.storage.local.set({ 
    [STORAGE_KEYS.API_KEY]: apiKey,
    [STORAGE_KEYS.WIND_SCALE]: selectedWindScale,
    [STORAGE_KEYS.PRESSURE_UNIT]: selectedPressureUnit,
    [STORAGE_KEYS.SHOW_UV_INDEX]: showUV
  });
  
  // Uppdatera API-nyckelstatus
  updateApiKeyStatus(apiKey);
  
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
    await processWeatherData(weatherData);
    
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
    
    // Hämta UV-index data (om aktiverat)
    chrome.storage.local.get([STORAGE_KEYS.SHOW_UV_INDEX], (result) => {
      const showUV = result[STORAGE_KEYS.SHOW_UV_INDEX] !== undefined ? result[STORAGE_KEYS.SHOW_UV_INDEX] : true;
      
      if (showUV) {
        getUVData(locationName, parseFloat(lat), parseFloat(lon))
          .then(uvData => {
            updateUVDisplay(uvData);
          })
          .catch(error => {
            console.error('Fel vid hämtning av UV-data:', error);
            hideUVDisplay();
          });
      } else {
        hideUVDisplay();
      }
    });
    
    // Visa väderdisplayen
    showWeatherDisplay();
  } catch (error) {
    console.error('Fel vid laddning av väderdata:', error);
    showErrorState();
  }
}

/**
 * Uppdaterar UV-displayen baserat på hämtad data
 * @param {Object} uvData - Objekt med UV-data
 */
function updateUVDisplay(uvData) {
  if (!uvData || uvData.uvIndex === null || uvData.uvIndex === undefined) {
    hideUVDisplay();
    return;
  }
  
  // Visa UV-baren
  uvIndexBar.style.display = 'flex';
  
  // Uppdatera UV-värde
  uvValue.textContent = uvData.uvIndex.toFixed(1);
  
  // Uppdatera risktextent
  uvRiskText.textContent = uvData.riskText;
  
  // Ta bort gamla risk-klasser
  uvIndexBar.classList.remove('uv-low', 'uv-moderate', 'uv-high', 'uv-very_high', 'uv-extreme');
  
  // Applicera ny färgklass
  uvIndexBar.classList.add(`uv-${uvData.riskLevel}`);
  
  console.log(`☀️ UV-display uppdaterad: UV ${uvData.uvIndex} (${uvData.riskLevel})`);
}

/**
 * Döljer UV-displayen om data inte är tillgänglig
 */
function hideUVDisplay() {
  if (uvIndexBar) {
    uvIndexBar.style.display = 'none';
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
  
  // Tillämpa temperaturklass på aktuell temperatur
  setTemperatureClass(currentTempValue, temperature);
  
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
  
  // Uppdatera timprognos med mer detaljerad information
  updateForecast(data.timeSeries.slice(0, 24));
  
  // Uppdatera dagsprognos
  updateDailyForecast(data.timeSeries);
  
  // NYTT: Uppdatera nederbördsbar
  updatePrecipitationBar(data.timeSeries, temperature);
  
  // Uppdatera tidsstämpel
  const now = new Date();
  lastUpdatedSpan.textContent = formatTime(now);
}

/**
 * Uppdaterar dagsprognos baserat på tidsseriedata
 * @param {Array} timeSeries - Array med tidsseriedata från SMHI API
 */
function updateDailyForecast(timeSeries) {
  // Rensa befintliga dagsprognosobjekt
  dailyForecastItems.innerHTML = '';
  
  // Gruppera data per dag
  const daysData = groupByDay(timeSeries);
  
  // Hämta dagens datum i YYYY-MM-DD format för att kunna exkludera det
  const today = new Date().toISOString().split('T')[0];
  
  // Sortera dagar och filtrera bort dagens datum - visa bara framtida dagar
  const days = Object.keys(daysData)
    .filter(day => day > today)  // Filtrera bort dagens datum
    .sort()                      // Sortera i stigande ordning
    .slice(0, 4);                // Begränsa till 4 dagar
  
  // Loopa genom dagarna och skapa prognosobjekt
  days.forEach(day => {
    const dayData = daysData[day];
    
    // Om ingen data finns för dagen, hoppa över
    if (!dayData || dayData.length === 0) return;
    
    // Beräkna min/max temperatur för dagen
    const temps = dayData.map(data => getParameterValue(data, 't')).filter(t => t !== null);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    
    // Hitta middag/dag-väderförhållandet (12-15)
    let dayWeatherSymbol = null;
    for (const data of dayData) {
      const time = new Date(data.validTime);
      const hour = time.getHours();
      
      // Använd väderikon för mitt på dagen om möjligt (typiskt väder för dagen)
      if (hour >= 12 && hour <= 15) {
        dayWeatherSymbol = getParameterValue(data, 'Wsymb2');
        break;
      }
    }
    
    // Fallback om ingen middag hittas, använd det vanligaste vädret under dagen
    if (dayWeatherSymbol === null) {
      const symbolCounts = {};
      dayData.forEach(data => {
        const symbol = getParameterValue(data, 'Wsymb2');
        if (symbol !== null) {
          symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
        }
      });
      
      let maxCount = 0;
      for (const symbol in symbolCounts) {
        if (symbolCounts[symbol] > maxCount) {
          maxCount = symbolCounts[symbol];
          dayWeatherSymbol = parseInt(symbol);
        }
      }
    }
    
    // Fallback om fortfarande ingen symbol, använd första
    if (dayWeatherSymbol === null && dayData.length > 0) {
      dayWeatherSymbol = getParameterValue(dayData[0], 'Wsymb2');
    }
    
    // Skapa ett datum för visning
    const date = new Date(dayData[0].validTime);
    
    // Skapa prognosobjekt för dagen
    createDailyForecastItem(date, dayWeatherSymbol, minTemp, maxTemp);
  });
}

/**
 * Grupperar tidsserier efter dag
 * @param {Array} timeSeries - Array med tidsseriedata från SMHI API
 * @returns {Object} Objekt med dagar som nycklar och array med data för varje dag
 */
function groupByDay(timeSeries) {
  const days = {};
  
  timeSeries.forEach(data => {
    const date = new Date(data.validTime);
    const day = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (!days[day]) {
      days[day] = [];
    }
    
    days[day].push(data);
  });
  
  return days;
}

/**
 * Skapar och lägger till ett dagsprognosobjekt i UI
 * @param {Date} date - Datum för prognosen
 * @param {number} symbol - Vädersymbol
 * @param {number} minTemp - Minimum temperatur
 * @param {number} maxTemp - Maximum temperatur
 */
function createDailyForecastItem(date, symbol, minTemp, maxTemp) {
  // Skapa prognosobjekt
  const forecastItem = document.createElement('div');
  forecastItem.className = 'daily-forecast-item';
  
  // Hämta veckodagsnamn och datum
  const dayName = getDayName(date);
  const dateString = formatDate(date);
  
  // Skapa datumsektion
  const dateElem = document.createElement('div');
  dateElem.className = 'daily-date';
  dateElem.textContent = dateString;
  
  // Skapa veckodagssektion
  const dayElem = document.createElement('div');
  dayElem.className = 'daily-day';
  dayElem.textContent = dayName;
  
  // Skapa ikonsektion
  const iconElem = document.createElement('div');
  iconElem.className = 'daily-icon';
  // Använd alltid dag-variant för dygnsprognos
  iconElem.innerHTML = `<i class="wi ${getWeatherIconClass(symbol, true)}"></i>`;
  
  // Skapa temperatursektion
  const tempElem = document.createElement('div');
  tempElem.className = 'daily-temp-range';
  
  // Lägg till max-temp
  const maxTempElem = document.createElement('span');
  maxTempElem.className = 'daily-high';
  maxTempElem.textContent = `${maxTemp.toFixed(1)}°`;
  // Tillämpa anpassad temperaturklass
  setTemperatureClass(maxTempElem, maxTemp);
  
  // Separator
  const separator = document.createElement('span');
  separator.className = 'daily-separator';
  separator.textContent = '/';
  
  // Lägg till min-temp
  const minTempElem = document.createElement('span');
  minTempElem.className = 'daily-low';
  minTempElem.textContent = `${minTemp.toFixed(1)}°`;
  // Tillämpa anpassad temperaturklass
  setTemperatureClass(minTempElem, minTemp);
  
  // Lägg till väderinformation
  const conditionElem = document.createElement('div');
  conditionElem.className = 'daily-condition';
  conditionElem.textContent = getWeatherDescription(symbol);
  
  // Lägg till alla element i prognosobjektet
  tempElem.appendChild(maxTempElem);
  tempElem.appendChild(separator);
  tempElem.appendChild(minTempElem);
  
  forecastItem.appendChild(dateElem);
  forecastItem.appendChild(dayElem);
  forecastItem.appendChild(iconElem);
  forecastItem.appendChild(tempElem);
  forecastItem.appendChild(conditionElem);
  
  // Lägg till prognosobjektet i behållaren
  dailyForecastItems.appendChild(forecastItem);
}

/**
 * Hämtar veckodagsnamn på svenska
 * @param {Date} date - Datum
 * @returns {string} Veckodagsnamn på svenska
 */
function getDayName(date) {
  const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  
  // Kontrollera om dagen är idag, imorgon eller i övermorgon
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Idag';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Imorgon';
  } else {
    return days[date.getDay()];
  }
}

/**
 * Formaterar datum på det svenska sättet
 * @param {Date} date - Datum
 * @returns {string} Formaterat datum (d/m)
 */
function formatDate(date) {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

/**
 * Konverterar lufttryck till vald enhet
 * @param {number} hpa - Tryck i hPa
 * @param {string} unit - Enhet (hpa, mbar, mmhg)
 * @returns {Object} Objekt med värde och enhet
 */
function formatPressure(hpa, unit) {
  switch(unit) {
    case 'mbar':
      return { value: hpa.toFixed(1), unit: 'mbar' };
    case 'mmhg':
      return { value: (hpa * 0.750062).toFixed(1), unit: 'mmHg' };
    case 'hpa':
    default:
      return { value: hpa.toFixed(1), unit: 'hPa' };
  }
}

/**
 * Uppdaterar lufttrycksdisplayen baserat på hämtad data
 * @param {Object} pressureData - Objekt med lufttrycksdata
 */
async function updatePressureDisplay(pressureData) {
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
  
  // Hämta vald tryckenhet
  const result = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.PRESSURE_UNIT], resolve);
  });
  const pressureUnit = result[STORAGE_KEYS.PRESSURE_UNIT] || 'hpa';
  
  // Formatera tryckvärdet
  const formatted = formatPressure(pressureData.currentPressure, pressureUnit);
  
  // Uppdatera värden
  if (pressureValue) {
    pressureValue.textContent = `${formatted.value} ${formatted.unit}`;
  }
  
  // Uppdatera med trend och beskrivning på separata rader
  let trendName = '';
  let trendDescription = '';
  
  switch(pressureData.pressureTrend) {
    case 'Stigande':
      trendName = 'Stigande';
      trendDescription = 'Stabilare väder på väg';
      break;
    case 'Fallande':
      trendName = 'Fallande';
      trendDescription = 'Möjlig väderförändring';
      break;
    case 'Stabilt':
      trendName = 'Stabilt';
      trendDescription = 'Oförändrat väderläge';
      break;
    default:
      trendName = pressureData.pressureTrend;
      trendDescription = '';
  }
  
  // Uppdatera trendtexten
  if (pressureTrend) {
    pressureTrend.textContent = trendName;
  }
  
  // Uppdatera beskrivningstexten
  if (pressureTrendDescription) {
    pressureTrendDescription.textContent = trendDescription;
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
    // Tillämpa temperaturklass baserat på värdet
    setTemperatureClass(tempElem, temp);
    
    // Lägg till förhållandebeskrivning
    const conditionElem = document.createElement('div');
    conditionElem.className = 'forecast-condition';
    conditionElem.textContent = getShortWeatherDescription(symbol);
    
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
 * Tilldelar CSS-klass baserat på temperatur för svenska förhållanden
 * @param {Element} element - DOM-element att tilldela klass till
 * @param {number} temperature - Temperaturvärde
 */
function setTemperatureClass(element, temperature) {
  // Rensa befintliga temperaturklasser först
  element.classList.remove('temp-very-cold', 'temp-cold', 'temp-mild', 'temp-warm', 'temp-hot');
  
  // Tilldela lämplig klass baserat på svenska förhållanden
  if (temperature < 0) {
    element.classList.add('temp-very-cold');  // Mörkblå för under 0°C
  } else if (temperature >= 0 && temperature < 10) {
    element.classList.add('temp-cold');       // Blå för 0-10°C
  } else if (temperature >= 10 && temperature < 20) {
    element.classList.add('temp-mild');       // Normal (svart) för 10-20°C
  } else if (temperature >= 20 && temperature < 25) {
    element.classList.add('temp-warm');       // Orange för 20-25°C
  } else {
    element.classList.add('temp-hot');        // Röd endast för 25°C+ (ovanligt i Sverige)
  }
  
  // Spara också temperaturen som data-attribut för CSS-selektorer
  element.setAttribute('data-temp', Math.floor(temperature));
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

/**
 * Uppdaterar nederbördsbaren baserat på kommande 2 timmar
 * @param {Array} timeSeries - Väderdata tidsserie
 * @param {number} currentTemp - Aktuell temperatur för att identifiera typ
 */
function updatePrecipitationBar(timeSeries, currentTemp) {
  const precipBar = document.getElementById('precipitation-bar');
  
  if (!precipBar || !timeSeries || timeSeries.length < 3) {
    if (precipBar) precipBar.style.display = 'none';
    return;
  }
  
  // Extrahera nederbörd för kommande 3 timmar (0, 1, 2)
  const precipValues = [];
  for (let i = 0; i < 3 && i < timeSeries.length; i++) {
    const pmedian = getParameterValue(timeSeries[i], 'pmedian');
    precipValues.push(pmedian !== null ? pmedian : 0);
  }
  
  // Beräkna peak-värde
  const peak = Math.max(...precipValues);
  
  // Visa bara om nederbörd förväntas (>0.1 mm/h)
  if (peak < 0.1) {
    precipBar.style.display = 'none';
    return;
  }
  
  // Visa baren
  precipBar.style.display = 'block';
  
  // Uppdatera värden
  document.getElementById('precip-next-hour').textContent = `${precipValues[0].toFixed(1)} mm/h`;
  document.getElementById('precip-peak').textContent = `${peak.toFixed(1)} mm/h`;
  
  // Uppdatera tidslinje
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const value = precipValues[i];
    const color = getPrecipitationColor(value);
    
    // Beräkna antal prickar (1-4 baserat på intensitet)
    const dotCount = Math.min(4, Math.max(1, Math.ceil(value / 2)));
    const dots = '●'.repeat(dotCount);
    
    // Uppdatera DOM
    const dotsElem = document.getElementById(`timeline-dots-${i}`);
    const timeElem = document.getElementById(`timeline-time-${i}`);
    const valueElem = document.getElementById(`timeline-value-${i}`);
    
    if (dotsElem) {
      dotsElem.textContent = dots;
      dotsElem.style.color = color;
    }
    
    if (timeElem) {
      if (i === 0) {
        timeElem.textContent = 'Nu';
      } else {
        const futureTime = new Date(now.getTime() + i * 60 * 60 * 1000);
        timeElem.textContent = formatTime(futureTime);
      }
    }
    
    if (valueElem) {
      valueElem.textContent = `${value.toFixed(1)} mm`;
    }
  }
  
  // Generera beskrivning
  const description = getPrecipitationDescription({
    values: precipValues,
    peak: peak
  }, currentTemp);
  
  const descElem = document.getElementById('precipitation-description');
  if (descElem) {
    descElem.textContent = description;
  }
  
  console.log(`🌧️ Nederbörd: Peak ${peak.toFixed(1)} mm/h`);
}

/**
 * Returnerar färg baserat på nederbördsintensitet (svensk standard)
 * @param {number} mmPerHour - Nederbörd i mm/h
 * @returns {string} Hex-färgkod
 */
function getPrecipitationColor(mmPerHour) {
  if (mmPerHour < 0.1) return '#90caf9';      // Duggregn - Ljusblå
  if (mmPerHour < 1) return '#4caf50';        // Lätt regn - Grön
  if (mmPerHour < 5) return '#ffeb3b';        // Måttligt regn - Gul
  if (mmPerHour < 10) return '#ff9800';       // Kraftigt regn - Orange
  return '#f44336';                            // Skyfall - Röd
}

/**
 * Genererar beskrivande text för nederbörd
 * @param {Object} precipData - Objekt med values och peak
 * @param {number} currentTemp - Temperatur för att identifiera typ
 * @returns {string} Beskrivande text
 */
function getPrecipitationDescription(precipData, currentTemp) {
  const { values, peak } = precipData;
  
  // Identifiera typ baserat på temperatur
  let type = 'regn';
  if (currentTemp < 0) {
    type = 'snö';
  } else if (currentTemp <= 2) {
    type = 'snöblandat regn';
  }
  
  // Identifiera intensitet
  let intensity = '';
  if (peak < 0.5) {
    intensity = 'Mycket lätt';
  } else if (peak < 1) {
    intensity = 'Lätt';
  } else if (peak < 5) {
    intensity = 'Måttligt';
  } else if (peak < 10) {
    intensity = 'Kraftigt';
  } else {
    intensity = 'Mycket kraftigt';
  }
  
  // Identifiera trend
  let trend = '';
  if (values.length >= 2) {
    const firstHalf = values[0];
    const secondHalf = values[values.length - 1];
    
    if (secondHalf > firstHalf * 1.5) {
      trend = ' → intensifieras';
    } else if (secondHalf < firstHalf * 0.7) {
      trend = ' → avtar';
    }
  }
  
  return `${intensity} ${type}${trend}`;
}

// ===== KORTLAYOUT FUNKTIONER =====

/**
 * Default kortlayout (5 block)
 */
const DEFAULT_CARD_LAYOUT = {
  pos1: 'precipitation',
  pos2: 'uv',
  pos3: 'wind',
  pos4: 'pressure',
  pos5: 'sun'
};

/**
 * Sparar kortlayout till storage (gör ingenting ännu - bara UI)
 */
function saveCardLayout() {
  const layout = {
    pos1: document.getElementById('card-position-1')?.value || 'uv',
    pos2: document.getElementById('card-position-2')?.value || 'wind',
    pos3: document.getElementById('card-position-3')?.value || 'pressure',
    pos4: document.getElementById('card-position-4')?.value || 'sun',
    pos5: document.getElementById('card-position-5')?.value || 'precipitation'
  };
  
  chrome.storage.local.set({ cardLayout: layout }, () => {
    console.log('💾 Kortlayout sparad:', layout);
  });
}

/**
 * Laddar kortlayout från storage
 */
function loadCardLayout() {
  chrome.storage.local.get(['cardLayout'], (result) => {
    const layout = result.cardLayout || DEFAULT_CARD_LAYOUT;
    
    const pos1 = document.getElementById('card-position-1');
    const pos2 = document.getElementById('card-position-2');
    const pos3 = document.getElementById('card-position-3');
    const pos4 = document.getElementById('card-position-4');
    const pos5 = document.getElementById('card-position-5');
    
    if (pos1) pos1.value = layout.pos1;
    if (pos2) pos2.value = layout.pos2;
    if (pos3) pos3.value = layout.pos3;
    if (pos4) pos4.value = layout.pos4;
    if (pos5) pos5.value = layout.pos5;
  });
}

/**
 * Återställer kortlayout till standard
 */
function resetCardLayout() {
  chrome.storage.local.set({ cardLayout: DEFAULT_CARD_LAYOUT }, () => {
    console.log('🔄 Kortlayout återställd');
    loadCardLayout();
  });
}

/**
 * Initierar kortlayout event listeners
 */
function initializeCardLayout() {
  const pos1 = document.getElementById('card-position-1');
  const pos2 = document.getElementById('card-position-2');
  const pos3 = document.getElementById('card-position-3');
  const pos4 = document.getElementById('card-position-4');
  const pos5 = document.getElementById('card-position-5');
  const resetBtn = document.getElementById('reset-layout');
  
  if (pos1) pos1.addEventListener('change', saveCardLayout);
  if (pos2) pos2.addEventListener('change', saveCardLayout);
  if (pos3) pos3.addEventListener('change', saveCardLayout);
  if (pos4) pos4.addEventListener('change', saveCardLayout);
  if (pos5) pos5.addEventListener('change', saveCardLayout);
  if (resetBtn) resetBtn.addEventListener('click', resetCardLayout);
  
  loadCardLayout();
}
