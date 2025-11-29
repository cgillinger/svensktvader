Changelog - Svenskt väder

## 1.1.0
### Nya funktioner
- **UV-index:** Tillägget visar nu UV-index från CurrentUVIndex.com API
  - Färgkodad sol-ikon enligt Strålsäkerhetsmyndighetens skala (grön → gul → orange → röd → lila)
  - Visar dagens maximala UV-värde med risknivå (Låg, Måttlig, Hög, Mycket hög, Extrem)
  - Pulsande sol-ikon vid hög UV-risk (6+) för att uppmärksamma användaren
  - 6-timmars cache för optimal prestanda
  - Kräver ingen API-nyckel - fungerar direkt
  - Informationssektion i inställningar med förklaring av UV-risknivåer

### Förbättringar
- UV-panel med neutral bakgrund och glaseffekt för bättre läsbarhet
- Textstorlekar på UV-information anpassade för konsekvent design
- Automatisk veckovis rensning av gammal UV-cache i bakgrunden
- Lagt till host_permission för CurrentUVIndex.com API

### Tekniska förbättringar
- Ny modul: `uv-service.js` för UV-datahantering
- Uppdaterad `background.js` med UV-cache underhåll
- Utökad CSS med UV-styling integrerad i huvudfilen

## 1.0.5
- Nya orter tillagda

## 1.0.4
### Förbättringar
- Rättad stavning i appens titel ("Svenskt Väder" → "Svenskt väder")
- Förbättrat gränssnitt med Frutiger Aero-inspirerad design
- Förbättrad visuell framtoning på väderpanelen med jämnare gradienter
- Korrigerad placering av luftfuktighetsindikator för bättre synlighet
- Optimerade glaseffekter för ett mer polerat utseende

## 1.0.3
### Förbättringar
- Förbättrad fyradagarsprognos - Fyradagarsprognosen visar nu tydligare min- och maxtemperaturer för varje dag samt dominerande väderförhållanden med förbättrad ikonvisning.

### Buggfixar
- Korrigerad beräkning av vindriktning för att korrekt visa varifrån vinden kommer
- Fixade layoutproblem i den kompakta detaljpanelen på mindre skärmar
- Åtgärdade problem med att hämta lufttrycksdata från vissa väderstationer
- Förbättrad cachningslogik för soluppgång/solnedgång för att minska datamängden
- Korrigerade språkfel i vissa väderbeskrivningar
- Korrigerade fel i tryckmätningen

### Underhåll
- Mindre kodoptimering för snabbare laddning
- Uppdaterad dokumentation

Tack till alla som rapporterat buggar och kommit med förbättringsförslag!
