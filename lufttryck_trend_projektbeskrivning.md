# 🧠 Projektbeskrivning: Lufttryck och Trycktrend för Svenskt Väder

## 🎯 Syfte

Implementera funktionalitet i Edge-tillägget **Svenskt Väder** som gör det möjligt att visa:

1. **Aktuellt lufttryck** (i hPa) för den plats användaren valt.
2. **Trycktrend** – ett av följande värden:
   - `"Stigande"`
   - `"Fallande"`
   - `"Stabilt"`

Detta ska göras i realtid baserat på SMHI:s observationsdata (inte prognos), och anpassas efter platsvalet i `locations.js`.

---

## 🔗 Datakälla

- **SMHI:s observations-API (metobs)**  
  Endpoint för lufttryck (parameter 1):  
  `https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/1/station.json`  
  Samt:  
  `https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/1/station/{station-id}/period/latest-day/data.json`

---

## 📍 Platskoppling

Användaren väljer plats via `locations.js`, som innehåller lat/lon.

AI:n ska:
1. Vid första körning ladda listan med stationer från `station.json`.
2. För varje plats i `locations.js`, hitta **närmsta station** (utifrån lat/lon).
3. Cacha mappning: `plats → stationId`.

---

## 📉 Tryckdata och trend

Vid varje väderuppdatering:

1. Hämta lufttrycksdata (`latest-day`) för närmaste station.
2. Extrahera minst **tre mätpunkter** (ex. senaste 6 timmar).
3. Jämför trenden:

   - Om skillnaden från första till sista > `+1.0` hPa → `"Stigande"`
   - Om skillnaden < `-1.0` hPa → `"Fallande"`
   - Annars → `"Stabilt"`

4. Spara både:
   - `currentPressure` (senaste tryck i hPa)
   - `pressureTrend` (en av tre trendvärden)

---

## 🧩 Integration

- Denna funktionalitet ska köras parallellt med befintlig `fetchWeatherData`.
- Resultaten (`currentPressure`, `pressureTrend`) ska:
  - Sparas i `chrome.storage.local`
  - Visas i UI:t som en ny detaljpanel

---

## 🔒 Robusthet

- Hantera fel: om ingen data hittas, returnera `"okänt"` eller dölja sektionen.
- Uppdatera mappning stationer <-> platser 1 gång per vecka.

---

## ✅ Testbarhet

- Mocka tryckdata för test.
- Bekräfta att rätt station-ID används.
- Kontrollera att trendlogik fungerar med simulerad ökning/minskning/stabilitet.

---

## 🧑‍💻 Outputformat

```json
{
  "currentPressure": 1013.2,
  "pressureTrend": "Stigande"
}
```
