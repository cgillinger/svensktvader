// popup.js (Uppdaterad med API-nyckelstatus)

...

// Sparar inställningar och stänger panelen
function saveSettings() {
  const apiKey = apiKeyInput.value.trim();

  const selectedWindScale = document.querySelector('input[name="wind-scale"]:checked').value;

  chrome.storage.local.set({ 
    [STORAGE_KEYS.API_KEY]: apiKey,
    [STORAGE_KEYS.WIND_SCALE]: selectedWindScale
  });

  updateApiKeyStatus(apiKey);

  loadWeatherData();

  closeSettingsPanel();
}

// Laddar sparade inställningar från lagring
function loadSavedSettings() {
  chrome.storage.local.get([STORAGE_KEYS.API_KEY, STORAGE_KEYS.WIND_SCALE], (result) => {
    const savedApiKey = result[STORAGE_KEYS.API_KEY];
    if (savedApiKey) {
      apiKeyInput.value = savedApiKey;
      // Uppdatera API-nyckelstatus till "Använder exakta soltider"
      updateApiKeyStatus(savedApiKey);
    }

    const savedWindScale = result[STORAGE_KEYS.WIND_SCALE] || 'beaufort';
    document.querySelector(`input[name="wind-scale"][value="${savedWindScale}"]`).checked = true;
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
    apiKeyStatus.className = 'api-key-status';
    apiKeyIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
    apiKeyMessage.textContent = 'Soldata: Använder förenklad beräkning';
  } else {
    apiKeyStatus.className = 'api-key-status valid';
    apiKeyIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
    apiKeyMessage.textContent = 'Soldata: Använder exakta soltider';
  }
}
