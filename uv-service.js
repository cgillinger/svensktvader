// uv-service.js
// UV-Index Service för Svenskt Väder Edge-tillägg
// Hämtar UV-index från CurrentUVIndex.com API

/**
 * UV-Index klassificering enligt Strålskyddsmyndigheten
 */
const UV_RISK_LEVELS = {
  low: { max: 2, text: 'Låg UV-risk', color: '#3cb371' },
  moderate: { max: 5, text: 'Måttlig UV-risk', color: '#ffd700' },
  high: { max: 7, text: 'Hög UV-risk', color: '#ff8c00' },
  very_high: { max: 10, text: 'Mycket hög UV-risk', color: '#dc143c' },
  extreme: { max: Infinity, text: 'Extrem UV-risk', color: '#9400d3' }
};

/**
 * CurrentUVIndex.com API endpoint
 */
const UV_API_BASE = 'https://currentuvindex.com/api/v1/uvi';

/**
 * Klassificerar UV-index enligt SSM-skala
 * @param {number} uvIndex - UV-index värde
 * @returns {Object} Risk-information
 */
function classifyUVRisk(uvIndex) {
  for (const [level, config] of Object.entries(UV_RISK_LEVELS)) {
    if (uvIndex <= config.max) {
      return {
        riskLevel: level,
        riskText: config.text,
        color: config.color
      };
    }
  }
  return {
    riskLevel: 'extreme',
    riskText: 'Extrem UV-risk',
    color: '#9400d3'
  };
}

/**
 * Hämtar UV-index data från cache eller API
 * @param {string} locationName - Ortsnamn
 * @param {number} latitude - Latitud
 * @param {number} longitude - Longitud
 * @returns {Promise<Object>} UV-data eller null
 */
export async function getUVData(locationName, latitude, longitude) {
  // Kontrollera cache först
  const cacheKey = `uv_cache_${locationName}`;
  const cacheTimeKey = `uv_cache_time_${locationName}`;
  
  try {
    const result = await chrome.storage.local.get([cacheKey, cacheTimeKey]);
    const cachedData = result[cacheKey];
    const cacheTime = result[cacheTimeKey];
    
    // Cache är giltig i 6 timmar (UV ändras under dagen)
    if (cachedData && cacheTime) {
      const cacheAge = Date.now() - cacheTime;
      const sixHours = 6 * 60 * 60 * 1000;
      
      if (cacheAge < sixHours) {
        console.log(`UV: Använder cache för ${locationName} (ålder: ${Math.round(cacheAge / 3600000)}h)`);
        return cachedData;
      }
    }
  } catch (error) {
    console.warn('UV: Cache-läsning misslyckades:', error);
  }

  // Hämta ny data från CurrentUVIndex.com API
  console.log(`UV: Hämtar ny data för ${locationName} (${latitude}, ${longitude})`);
  
  try {
    const uvData = await fetchUVFromAPI(latitude, longitude);
    
    if (uvData) {
      // Spara i cache
      await chrome.storage.local.set({
        [cacheKey]: uvData,
        [cacheTimeKey]: Date.now()
      });
      
      console.log(`UV: Data cachad för ${locationName}, UV-index: ${uvData.uvIndex}`);
      return uvData;
    }
    
    return null;
  } catch (error) {
    console.error('UV: API-fel:', error);
    
    // Fallback till gammal cache om API misslyckas
    try {
      const result = await chrome.storage.local.get(cacheKey);
      if (result[cacheKey]) {
        console.log(`UV: Använder gammal cache som fallback för ${locationName}`);
        return result[cacheKey];
      }
    } catch (e) {
      console.warn('UV: Fallback-cache misslyckades:', e);
    }
    
    return null;
  }
}

/**
 * Hämtar UV-index från CurrentUVIndex.com API
 * @param {number} latitude - Latitud
 * @param {number} longitude - Longitud
 * @returns {Promise<Object>} UV-data
 */
async function fetchUVFromAPI(latitude, longitude) {
  const url = `${UV_API_BASE}?latitude=${latitude}&longitude=${longitude}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`CurrentUVIndex API svarade med status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extrahera nuvarande UV-index
    const currentUV = data.now?.uvi || 0;
    
    // Hitta max UV från prognosen (nästa 24h)
    let maxUV = currentUV;
    let peakHour = new Date().getHours();
    
    if (data.forecast && Array.isArray(data.forecast)) {
      data.forecast.forEach(forecast => {
        if (forecast.uvi > maxUV) {
          maxUV = forecast.uvi;
          // Extrahera timme från ISO-timestamp
          const forecastTime = new Date(forecast.hour);
          peakHour = forecastTime.getHours();
        }
      });
    }
    
    // Klassificera risknivå
    const riskInfo = classifyUVRisk(maxUV);
    
    return {
      uvIndex: Math.round(maxUV * 10) / 10, // Avrunda till 1 decimal
      currentUV: Math.round(currentUV * 10) / 10,
      peakHour: peakHour,
      riskLevel: riskInfo.riskLevel,
      riskText: riskInfo.riskText,
      color: riskInfo.color,
      timestamp: new Date().toISOString(),
      coordinates: { latitude, longitude },
      source: 'CurrentUVIndex.com',
      cloudCover: data.now?.cloudcover || null,
      ozone: data.now?.ozone || null
    };
    
  } catch (error) {
    console.error('UV: CurrentUVIndex.com API-anrop misslyckades:', error);
    throw error;
  }
}

/**
 * Rensa gammal UV-cache (körs periodiskt från background.js)
 */
export async function cleanOldUVCache() {
  try {
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = [];
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    for (const key in allData) {
      if (key.startsWith('uv_cache_time_')) {
        const cacheTime = allData[key];
        if (now - cacheTime > sevenDays) {
          const dataKey = key.replace('_time_', '_');
          keysToRemove.push(key, dataKey);
        }
      }
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`UV: Borttog ${keysToRemove.length / 2} gamla cache-poster`);
    }
  } catch (error) {
    console.warn('UV: Cache-rensning misslyckades:', error);
  }
}

// Exportera konstanter och hjälpfunktioner
export { UV_RISK_LEVELS, classifyUVRisk };
