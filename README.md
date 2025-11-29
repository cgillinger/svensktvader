# Svenskt väder – Edge/Chrome-tillägg

Ett vädertillägg för Microsoft Edge och Google Chrome som visar aktuell väderdata från SMHI för svenska orter.

---

## Funktioner

- Välj mellan 60+ svenska orter (inklusive stadsdelar i Stockholm, Göteborg och Malmö)
- Aktuellt väder med temperatur, molnighet och nederbörd
- **🌧️ NYTT: Nederbördsprognos för kommande 2 timmar** med visuell tidslinje och färgkodad intensitet
- Vindinformation i m/s, Beaufort eller beskrivande termer (Bris, Kuling, Storm)
- UV-index från CurrentUVIndex.com med färgkodad risknivå enligt Strålsäkerhetsmyndigheten
- Soluppgång och solnedgång (exakta tider med API-nyckel, annars förenklad beräkning)
- Lufttryck och trycktrend från närmaste SMHI-station
- 9-timmars prognos med 3 timmars intervall
- 4-dagarsprognos med min/max temperatur
- Automatisk uppdatering var 30:e minut

---

## 🌧️ Nederbörd och prognos

Tillägget visar nederbörd för kommande 2 timmar när regn, snö eller snöblandat regn förväntas:

### Visningslogik
- Baren visas endast när nederbörd ≥ 0.1 mm/h förväntas inom 2 timmar
- Döljs automatiskt vid uppehåll eller duggregn

### Färgkodning (svensk standard)
| Intensitet | mm/h | Färg |
|-----------|------|------|
| Duggregn | < 0.1 | Ljusblå (#90caf9) |
| Lätt regn | 0.1-1 | Grön (#4caf50) |
| Måttligt regn | 1-5 | Gul (#ffeb3b) |
| Kraftigt regn | 5-10 | Orange (#ff9800) |
| Skyfall | > 10 | Röd (#f44336) |

### Typ-identifiering
- Temperatur < 0°C → **Snö**
- Temperatur 0-2°C → **Snöblandat regn**
- Temperatur > 2°C → **Regn**

### Trend-analys
- Ökning > 50% → "intensifieras"
- Minskning > 30% → "avtar"
- Annars → ingen trendinformation

---

## Installation

### För utveckling

1. Klona repot:
   ```bash
   git clone https://github.com/cgillinger/svensktvader.git
   cd svensktvader
   ```

2. Ladda tillägget:
   - **Edge:** Öppna `edge://extensions`, aktivera utvecklarläge, klicka "Läs in packat tillägg"
   - **Chrome:** Öppna `chrome://extensions`, aktivera utvecklarläge, klicka "Load unpacked"
   - Välj projektmappen

---

## Inställningar

- **Plats:** Välj ort från listan (sparas automatiskt)
- **Soldata API-nyckel:** Valfri nyckel från [ipgeolocation.io](https://ipgeolocation.io/) för exakta soltider
- **Vindskala:** Välj mellan m/s, Beaufort (0–12) eller beskrivande termer
- **UV-index:** Toggle för att visa/dölja UV-data

---

## API-källor

- **SMHI Prognos API:** Väderdata och prognoser (inkl. nederbörd)
- **SMHI Observations API:** Lufttrycksdata från närmaste mätstation
- **CurrentUVIndex.com API:** UV-index (gratis, ingen nyckel krävs, 500 anrop/dag)
- **IP Geolocation API:** Exakta soltider (valfritt, kräver gratis API-nyckel)

---

## UV-index

Tillägget visar UV-index från CurrentUVIndex.com med färgkodning enligt Strålsäkerhetsmyndighetens skala:

- **0-2:** Låg UV-risk (grön)
- **3-5:** Måttlig UV-risk (gul)
- **6-7:** Hög UV-risk (orange)
- **8-10:** Mycket hög UV-risk (röd)
- **11+:** Extrem UV-risk (lila)

UV-data cachas i 6 timmar och uppdateras automatiskt.

---

## Lufttryck

Lufttryck visas i hPa med trend baserat på senaste timmen:

- **Stigande** (>+1.0 hPa): Stabilare väder på väg
- **Fallande** (<-1.0 hPa): Möjlig väderförändring
- **Stabilt** (±1.0 hPa): Oförändrat väderläge

Data hämtas från närmaste SMHI-station, vilket kan vara några kilometer från vald ort.

---

## Projektstruktur

```
svensktvader/
├── background.js       # Service worker, schemalagda uppdateringar
├── popup.html          # Tilläggets UI
├── popup.js            # Väderlogik, händelser, UI-uppdateringar
├── pressure-service.js # Lufttryckshantering
├── uv-service.js       # UV-index hantering
├── locations.js        # Svenska orter med koordinater
├── styles.css          # CSS för popup
├── manifest.json       # Manifest v3
└── weather-icons/      # Väderikoner (extern resurs)
```

---

## Ikoner och licenser

- **Weather Icons** av [Erik Flowers](https://github.com/erikflowers/weather-icons) – SIL OFL 1.1
- **SVG Weather Icons** av [amCharts](https://www.amcharts.com/free-animated-svg-weather-icons/) – CC BY 4.0
- **UV-data** från [CurrentUVIndex.com](https://currentuvindex.com/) – CC BY 4.0

---

## Changelog

### Version 1.2.0
**Ny funktion:**
- Nederbördsprognos för kommande 2 timmar
- Visuell tidslinje med färgkodade prickar (1-4 st baserat på intensitet)
- Automatisk typ-identifiering (regn/snö/snöblandat)
- Trend-analys (intensifieras/avtar)
- Kompakt design som matchar befintlig UI-stil

**Förbättringar:**
- Nederbördbaren visas endast vid förväntad nederbörd ≥ 0.1 mm/h
- Färgkodning enligt svensk standard (duggregn → skyfall)
- Platt design utan hårda skuggor för konsekvent utseende

### Version 1.1.1
**Ny funktion:**
- Lagt till UV-index från CurrentUVIndex.com API
- Färgkodad sol-ikon enligt SSM:s UV-riskskala
- 6-timmars cache för UV-data
- Automatisk veckovis rensning av gammal UV-cache
- Informationssektion om UV-index i inställningar

**Förbättringar:**
- Neutral bakgrund på UV-panelen för bättre läsbarhet
- Större och tydligare text på UV-risknivå
- Pulsande sol-ikon vid hög UV-risk (6+)

### Version 1.0.5
- Lufttrycksdata från SMHI observationer
- Trycktrend med visuell indikator
- Förbättrad cache-hantering

---

## Utvecklat av

[@cgillinger](https://github.com/cgillinger)

Buggrapporter och förslag: Skapa en issue på GitHub

---

## Licens

MIT License – se [LICENSE](LICENSE) för detaljer
