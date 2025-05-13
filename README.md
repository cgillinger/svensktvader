# 🌦️ Svenskt väder – Microsoft Edge-tillägg

Svenskt väder är ett stilrent och funktionellt vädertillägg för Microsoft Edge som visar **uppdaterad väderdata från SMHI** för svenska orter. Tillägget innehåller dagliga prognoser, 9-timmarsprognoser, lufttrycksinformation, vindinformation, luftfuktighet, samt solens upp- och nedgång.

---

## 🚀 Funktioner

- 🔍 Välj mellan **60+ svenska orter** (inkl. stadsdelar)
- 🌤 Aktuellt väder, temperatur, molnighet, nederbörd m.m.
- 💨 Vindinformation i **m/s, Beaufort** eller **beskrivande termer**
- 🌅 Exakta tider för **soluppgång/solnedgång** (med eller utan API-nyckel)
- 📊 **Lufttryck och trycktrend** från närmaste mätstation
- 🕒 **9-timmars prognos** med symboler och temperaturfärg
- 📅 **4-dagarsprognos** med min/max temperatur och väderförhållanden
- 🔔 Automatisk uppdatering var 30:e minut
- 📦 Kräver ingen inloggning eller konto

---

## 🖼️ Skärmdumpar

> _Lägg gärna till egna screenshots här via GitHub UI eller `README-assets/`_

---

## 🛠 Installation för utveckling

1. **Kloning av repo**
   ```bash
   git clone https://github.com/cgillinger/svensktvader.git
   cd svensktvader
   ```

2. **Ladda som okomplierat tillägg i Edge**
   - Öppna `edge://extensions`
   - Aktivera **Utvecklarläge**
   - Klicka på **"Läs in packat tillägg"**
   - Välj projektmappen

---

## ⚙️ Inställningar

- **Plats:** Välj ort från listan (sparas automatiskt)
- **API-nyckel:** (valfritt) från [ipgeolocation.io](https://ipgeolocation.io/) för exakta soltider
- **Vindskala:**
  - m/s (SI-enhet)
  - Beaufort (0–12)
  - Beskrivande (ex. "Frisk vind", "Kuling")

---

## 📡 Använda SMHI och IPGeolocation API

- **SMHI API (offentligt):** 
  - **Prognos API:** Hämtar väderdata för vald ort
  - **Observations API:** Hämtar lufttrycksdata från närmaste väderstation
- **IP Geolocation API (frivillig):** Ger exakta tider för soluppgång/-nedgång. Du kan skaffa en gratis nyckel på https://ipgeolocation.io/

Om ingen API-nyckel anges används en **förenklad solberäkning** (visas med tydlig indikator i tillägget).

---

## 📊 Lufttryck och trycktrend

Tillägget visar nu aktuellt lufttryck och trycktrend från SMHI:s observationsstationer:

- **Aktuellt lufttryck** i hPa (millibar)
- **Trycktrend** med indikation:
  - 📈 **Stigande** (>+1.0 hPa) - Stabilare väder på väg
  - 📉 **Fallande** (<-1.0 hPa) - Möjlig väderförändring
  - ➡️ **Stabilt** (±1.0 hPa) - Oförändrat väderläge

Observera att lufttrycksdata hämtas från närmaste väderstation, vilket kan vara några kilometer från vald ort.

---

## 📱 Prognostyper

Tillägget erbjuder två olika prognostyper:

- **9-timmars prognos** - Visar temperatur och väderförhållanden för kommande 9 timmar, med 3 timmars intervall
- **4-dagarsprognos** - Visar dagliga min/max temperaturer och dominerande väderförhållanden för aktuell dag plus 3 kommande dagar

Båda prognostyperna visar passande väderikoner och kan bläddras sidledes vid behov.

---

## 📁 Projektstruktur

```plaintext
.
├── background.js       # Service worker – schemalagda uppdateringar
├── popup.html          # Tilläggets gränssnitt
├── popup.js            # All väderlogik, händelser och UI
├── pressure-service.js # Lufttryckshantering och API-koppling
├── locations.js        # Lista över orter i Sverige
├── styles.css          # Stilar för popup-gränssnittet
├── manifest.json       # Manifest v3 för Edge/Chrome
└── weather-icons/      # Ikoner för väder och vind (extern resurs)
```

---

## 🖼 Ikoner och licenser

- **Weather Icons** av [Erik Flowers](https://github.com/erikflowers/weather-icons) – SIL OFL 1.1  
- **SVG Weather Icons** av [amCharts](https://www.amcharts.com/free-animated-svg-weather-icons/) – CC BY 4.0  
- Ikonerna får användas kommersiellt med korrekt attribution.

---

## 🧪 Utvecklingstips

- Förhandsgranska tillägget via `edge://extensions`
- Alla data sparas med `chrome.storage.local`
- `popup.js` innehåller UI, logik och API-koppling
- `pressure-service.js` hanterar lufttrycksdata
- Du kan mocka väderdata vid behov för test

---

## 📌 Planerade förbättringar (förslag)

- 🔥 **Brandriskvisning** (via SMHI)
- 📍 Automatisk platsupptäckt
- 🌙 Måndata (måne, fas, uppgång)
- 📲 Export av väderhistorik
- 🌍 Stöd för internationella platser

---

## 🧑‍💻 Kontakt

Utvecklat av [@cgillinger](https://github.com/cgillinger)

> Har du förbättringsförslag eller buggrapporter? Skicka gärna en issue via GitHub!

---

## 📝 Licens

MIT License. Se [LICENSE](LICENSE) för mer information.