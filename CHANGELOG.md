# CHANGELOG - Version 1.3.1

## Version 1.3.1 – Toolbar badge-display (2026-04-02)

### Ny funktion
- **Toolbar badge-display:** Visa aktuellt väderdata direkt i webbläsarens verktygsfält
- Valbara alternativ: Temperatur (default), UV-index, Vindstyrka (Beaufort), Lufttryckstrend (pil)
- Dynamisk färgkodning per datatyp (temperatur, UV SSM-skala, Beaufort, trendpil)
- Uppdateras automatiskt vid varje väderuppdatering (var 30:e minut)

### Tekniskt
- Använder OffscreenCanvas för dynamisk ikonrendering i MV3 service worker
- Stöd för 16px, 32px och 48px ikonstorlekar
- Automatisk fontstorleksanpassning (1–4 tecken, inkl. negativa temperaturer t.ex. "-10°")
- Fallback till standard-ikon när väder-/UV-data saknas

### Uppdaterade filer
- `manifest.json` — version 1.3.1
- `background.js` — ny TOOLBAR_DISPLAY storage key, updateToolbarIcon(), generateToolbarIcon(), färgfunktioner, Beaufort-konvertering, event listeners
- `popup.html` — nytt radio-group setting-item för toolbar-display
- `popup.js` — ny storage key, ladda/spara toolbar-display inställning
- `README.md` / `CHANGELOG.md` — denna post

---

## Version 1.3.0 – SMHI API-migrering (2026-03-31)

### Ändringar
- **API-migrering:** Bytt från avvecklade PMP3gv2 till nya SNOW1gv1
  - Ny API-URL: `snow1g/version/1` ersätter `pmp3g/version/2`
  - Ny svarsstruktur: `data`-dict istället för `parameters`-array
  - Nya parameternamn (t → air_temperature, ws → wind_speed, etc.)
  - Tidpunktsnyckel ändrad från `validTime` till `time`
- **Buggfix:** Intern mappningsfunktion säkerställer bakåtkompatibel parsning
- Version bumpas till 1.3.0

### Uppdaterade filer
- `manifest.json` — version 1.3.0
- `popup.js` — ny API-URL, ny parsningslogik, validTime → time
- `background.js` — ny API-URL
- `CHANGELOG.md` — denna post

---

## 🌧️ Nederbörd och prognos - Release 1.2.0 (2025-11-29)

### NYA FUNKTIONER

#### Nederbördsprognos (kommande 2 timmar)
- **Visuell nederbördsbar** som visas under UV-index-panelen
- **Smart visningslogik**: Visas endast när nederbörd ≥ 0.1 mm/h förväntas
- **Kompakt design** som matchar befintlig UI-stil med glaseffekt

#### Funktioner i nederbördsbaren:
1. **Värdevisning**
   - Nästa timme: Nederbörd kommande timme (mm/h)
   - Peak: Maximalt värde inom 2 timmar

2. **Visuell tidslinje** (3 tidpunkter)
   - Nu, +1h, +2h
   - Färgkodade prickar (●) som indikerar intensitet
   - Antal prickar: 1-4 (baserat på mm/h ÷ 2)

3. **Färgkodning** (svensk standard)
   - < 0.1 mm/h: Duggregn (ljusblå #90caf9)
   - 0.1-1 mm/h: Lätt regn (grön #4caf50)
   - 1-5 mm/h: Måttligt regn (gul #ffeb3b)
   - 5-10 mm/h: Kraftigt regn (orange #ff9800)
   - > 10 mm/h: Skyfall (röd #f44336)

4. **Typ-identifiering**
   - Temperatur < 0°C → "snö"
   - Temperatur 0-2°C → "snöblandat regn"
   - Temperatur > 2°C → "regn"

5. **Trend-analys**
   - Ökning > 50% → "intensifieras"
   - Minskning > 30% → "avtar"
   - Annars ingen trend visas

---

## UPPDATERADE FILER

### 1. manifest.json
**Ändring:** Version 1.1.1 → 1.2.0
```json
{
  "version": "1.2.0"
}
```

### 2. popup.html
**Tillägg:** Nederbördsbar mellan UV-index och väderdetaljer (rad 66-105)

**Nya element:**
```html
<div class="precipitation-bar" id="precipitation-bar" style="display: none;">
  <div class="precipitation-header">
    <i class="wi wi-raindrops precipitation-icon"></i>
    <span class="precipitation-title">NEDERBÖRD KOMMANDE 2 TIMMAR</span>
  </div>
  
  <div class="precipitation-info">
    <div class="precipitation-text">
      <span class="precip-label">Nästa timme:</span>
      <span class="precip-value" id="precip-next-hour">--</span>
      <span class="precip-separator">•</span>
      <span class="precip-label">Peak:</span>
      <span class="precip-value" id="precip-peak">--</span>
    </div>
  </div>
  
  <div class="precipitation-timeline">
    <!-- 3 timeline-items med dots, time, value -->
  </div>
  
  <div class="precipitation-description" id="precipitation-description">
    Lätt regn
  </div>
</div>
```

### 3. popup.js
**Nya funktioner (3 st):**

#### a) `updatePrecipitationBar(timeSeries, currentTemp)` - rad 1285-1367
**Ansvar:** Huvudfunktion för att uppdatera nederbördsbaren
**Logik:**
```javascript
// 1. Extrahera pmedian för timmar 0, 1, 2
const precipValues = [];
for (let i = 0; i < 3; i++) {
  const pmedian = getParameterValue(timeSeries[i], 'pmedian');
  precipValues.push(pmedian !== null ? pmedian : 0);
}

// 2. Beräkna peak
const peak = Math.max(...precipValues);

// 3. Visa/dölj baserat på threshold
if (peak < 0.1) {
  precipBar.style.display = 'none';
  return;
}

// 4. Uppdatera värden
document.getElementById('precip-next-hour').textContent = `${precipValues[0].toFixed(1)} mm/h`;
document.getElementById('precip-peak').textContent = `${peak.toFixed(1)} mm/h`;

// 5. Uppdatera tidslinje (färg + prickar)
for (let i = 0; i < 3; i++) {
  const value = precipValues[i];
  const color = getPrecipitationColor(value);
  const dotCount = Math.min(4, Math.max(1, Math.ceil(value / 2)));
  const dots = '●'.repeat(dotCount);
  // Uppdatera DOM...
}

// 6. Generera beskrivning
const description = getPrecipitationDescription({
  values: precipValues,
  peak: peak
}, currentTemp);
```

#### b) `getPrecipitationColor(mmPerHour)` - rad 1369-1378
**Ansvar:** Returnera färgkod baserat på intensitet
**Returnerar:** Hex-färg enligt svensk standard

#### c) `getPrecipitationDescription(precipData, currentTemp)` - rad 1380-1428
**Ansvar:** Generera beskrivande text
**Returnerar:** String som "Måttligt regn → intensifieras"

**Integration i processWeatherData:**
Rad 444 (efter updateDailyForecast):
```javascript
// NYTT: Uppdatera nederbördsbar
updatePrecipitationBar(data.timeSeries, temperature);
```

### 4. styles.css
**Tillägg:** Nederbörd-styling (rad 1498-1628, 132 nya rader)

**Nya CSS-klasser:**
- `.precipitation-bar` - Huvudcontainer med glaseffekt
- `.precipitation-header` - Rubriksektion med ikon
- `.precipitation-info` - Värdevisning (nästa timme + peak)
- `.precipitation-timeline` - Tidslinje-container
- `.timeline-item` - Enskild tidpunkt (3 st)
- `.timeline-dots` - Färgkodade prickar
- `.timeline-time` - Tidstext (Nu, +1h, +2h)
- `.timeline-value` - mm-värde
- `.precipitation-description` - Beskrivande text

**Stil-egenskaper:**
- Bakgrund: `var(--primary-color-light)` (matchande UV-bar)
- Border-radius: `var(--item-radius)` (10px)
- Box-shadow: `0 3px 8px rgba(0, 0, 0, 0.1)` (mjuk skugga)
- Glaseffekt: `::before` pseudo-element med gradient
- z-index: 1 (alla interaktiva element)

---

## BEVARADE FUNKTIONER

### ✅ Alla befintliga funktioner fungerar:
- UV-index display och toggle
- Lufttryck med trend
- Vindinformation (3 format)
- Sol upp/ner
- 9-timmars prognos
- 4-dagarsprognos
- Temperatur med färgkodning

---

## TESTSCENARIER

### Scenario 1: Ingen nederbörd
**Förväntad:** Baren visas INTE
**Test:**
```javascript
// pmedian = 0 för alla 3 timmar
updatePrecipitationBar([
  { parameters: [{ name: 'pmedian', values: [0] }] },
  { parameters: [{ name: 'pmedian', values: [0] }] },
  { parameters: [{ name: 'pmedian', values: [0] }] }
], 15);
// Result: precipitation-bar har display: none
```

### Scenario 2: Lätt duggregn (under threshold)
**Förväntad:** Baren visas INTE (< 0.1 mm/h)
```javascript
updatePrecipitationBar([...], 15); // pmedian = 0.05
// Result: precipitation-bar har display: none
```

### Scenario 3: Måttligt regn (konstant)
**Förväntad:**
- Baren visas
- Gul färg (#ffeb3b)
- 2 prickar (3 mm/h ÷ 2 = 1.5 → ceil = 2)
- Text: "Måttligt regn"

**Test:**
```javascript
updatePrecipitationBar([
  { parameters: [{ name: 'pmedian', values: [3] }] },
  { parameters: [{ name: 'pmedian', values: [3] }] },
  { parameters: [{ name: 'pmedian', values: [3] }] }
], 15);
// Nästa timme: 3.0 mm/h
// Peak: 3.0 mm/h
// Färg: Gul
// Prickar: ●● (2 st)
// Beskrivning: "Måttligt regn"
```

### Scenario 4: Intensifierande regn
**Förväntad:**
- Text: "Kraftigt regn → intensifieras"
- Trend visas (0.5 → 7 = ökning > 50%)

**Test:**
```javascript
updatePrecipitationBar([
  { parameters: [{ name: 'pmedian', values: [0.5] }] },
  { parameters: [{ name: 'pmedian', values: [3] }] },
  { parameters: [{ name: 'pmedian', values: [7] }] }
], 15);
// Beskrivning: "Kraftigt regn → intensifieras"
```

### Scenario 5: Avtagande snö
**Förväntad:**
- Typ: "snö" (temp < 0°C)
- Text: "Lätt snö → avtar"

**Test:**
```javascript
updatePrecipitationBar([
  { parameters: [{ name: 'pmedian', values: [2] }] },
  { parameters: [{ name: 'pmedian', values: [1] }] },
  { parameters: [{ name: 'pmedian', values: [0.5] }] }
], -3); // Temperatur under 0
// Beskrivning: "Måttligt snö → avtar"
```

### Scenario 6: Snöblandat regn
**Förväntad:**
- Typ: "snöblandat regn" (temp 0-2°C)

**Test:**
```javascript
updatePrecipitationBar([...], 1.5); // Temperatur 1.5°C
// Beskrivning: "... snöblandat regn ..."
```

---

## INSTALLATION

### Steg 1: Ersätt filer
Kopiera dessa filer till din svensktvader-mapp:
```
manifest.json      → /svensktvader/
popup.html         → /svensktvader/
popup.js           → /svensktvader/
styles.css         → /svensktvader/
```

### Steg 2: Ladda om tillägget
1. Öppna `edge://extensions` (eller `chrome://extensions`)
2. Hitta "Svenskt väder"
3. Klicka på "Uppdatera" (🔄) -knappen
4. Verifiera att versionen är 1.2.0

### Steg 3: Testa
1. Välj en ort med regn förväntad (kolla SMHI.se först)
2. Verifiera att nederbördsbaren visas
3. Kontrollera färgkodning och prickar
4. Välj en ort utan regn → baren ska döljas

---

## VERIFIERING

### Checklista:
- [ ] Version 1.2.0 visas i edge://extensions
- [ ] Nederbördbaren visas vid förväntad nederbörd
- [ ] Nederbördbaren döljs vid ingen nederbörd
- [ ] Färgkodning fungerar (5 nivåer)
- [ ] Prickar visas korrekt (1-4 st)
- [ ] Typ identifieras: regn/snö/snöblandat
- [ ] Trend visas: intensifieras/avtar
- [ ] UV-index fungerar fortfarande
- [ ] Lufttryck fungerar fortfarande
- [ ] Inga konsolfel i DevTools

---

## TEKNISKA DETALJER

### Dataflöde:
```
1. loadWeatherData()
   ↓
2. processWeatherData(data)
   ↓
3. updatePrecipitationBar(data.timeSeries, temperature)
   ↓
4. Extrahera pmedian [0, 1, 2]
   ↓
5. Beräkna peak = max(values)
   ↓
6. if (peak < 0.1) → hide bar, return
   ↓
7. Uppdatera DOM:
   - Värden (nästa timme + peak)
   - Tidslinje (färg + prickar)
   - Beskrivning (typ + intensitet + trend)
```

### Prestanda:
- Minimal påverkan: Data redan hämtad från SMHI
- Endast UI-rendering (~150 nya kodrader totalt)
- CSS transitions för smooth animation

---

## FELSÖKNING

### Problem: Nederbörsbaren visas inte
**Lösning:**
1. Kontrollera att det faktiskt förväntas nederbörd (>0.1 mm/h)
2. Öppna DevTools (F12) → Console
3. Kolla efter felmeddelanden
4. Verifiera att `pmedian` finns i SMHI-data

### Problem: Fel färg visas
**Lösning:**
- Kontrollera `getPrecipitationColor()` logic
- Verifiera thresholds: 0.1, 1, 5, 10 mm/h

### Problem: Konsole fel "Cannot read property..."
**Lösning:**
- Säkerställ att alla DOM-element finns i popup.html
- Kontrollera ID:n: `precipitation-bar`, `precip-next-hour`, etc.

---

## FRAMTIDA FÖRBÄTTRINGAR

Förslag för version 1.3.0:
- [ ] Ackumulerad nederbörd (summa 2h)
- [ ] Stopptid-estimat ("Slutar ~14:30")
- [ ] Klickbar bar → expanderad vy med 12h prognos
- [ ] Animerade droppar vid kraftigt regn
- [ ] Ljud-varning vid skyfall (>10 mm/h)
- [ ] Widget-läge med minimerad vy

---

## SUPPORT

**Buggrapport:** Skapa issue på [GitHub](https://github.com/cgillinger/svensktvader/issues)

**Utvecklare:** [@cgillinger](https://github.com/cgillinger)

**Licens:** MIT License

---

## UPPDATERING: Nederbörd-information i inställningar

### Nytt tillagt (efter initial release):

**Informationssektion i inställningar** (liknande UV-info)
- Förklarar när nederbördsbaren visas/döljs
- Visar färgkodning med prickar (●)
- Beskriver vad som visas (nästa timme, peak, tidslinje, typ, trend)
- Notis om uppdateringsfrekvens och prickarnas antal

**Location:** Efter UV-index-information, före Spara-knapp

**CSS-klasser tillagda:**
- `.precipitation-info-section` - Huvudcontainer
- `.precipitation-visibility-guide` - Visningsregler (ljusblå box)
- `.precipitation-scale-guide` - Färgkodning
- `.precipitation-features-guide` - Funktionslista
- `.precip-dot` - Färgkodade prickar (5 varianter)

**Total tillägg:** +50 rader HTML, +160 rader CSS
