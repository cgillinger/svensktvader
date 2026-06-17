# Privacy Policy — Svenskt väder

_Last updated: 2026-06-17_

Svenskt väder ("the extension") shows weather information for locations in
Sweden in a toolbar popup. This short policy explains what data it handles.

## Short version

The extension does **not** collect, transmit, or sell any personal data to the
developer or to any third party for tracking or advertising. There is no
account, no login, no analytics, and no tracking.

## What is stored

The following is stored **locally on your device** (via the browser's `storage`
API) and is never sent to the developer:

- Your selected location and display preferences (units, the descriptive
  pressure-word option, etc.).
- Your optional [ipgeolocation.io](https://ipgeolocation.io/) API key, if you
  choose to enter one.
- A local cache of fetched weather data (forecasts, observations, UV index,
  sunrise/sunset times, and the SMHI station list).

You can remove all of this at any time by uninstalling the extension.

## Data sent to third parties

To show weather, the coordinates of the location **you choose** are sent
directly from your browser to public weather services to retrieve data:

- **SMHI** (`opendata-download-metfcst.smhi.se`, `opendata-download-metobs.smhi.se`)
  — forecasts and observations.
- **CurrentUVIndex.com** — UV index.
- **ipgeolocation.io** — only if you enter your own API key, to get exact
  sunrise/sunset times for the selected location. Your API key is sent only to
  this service.

The extension does **not** detect your physical location — there is no GPS or
IP-based geolocation. It uses only the location you select. These requests are
read-only and are made solely to provide the weather information you requested.
Each service processes the request under its own privacy policy.

## Permissions

- `storage` — to save your settings and cache weather data locally.
- `alarms` — to periodically refresh the displayed weather and clean up the
  local cache.

## Contact

Svenskt väder is maintained by Christian Gillinger. Questions or concerns:
please open an issue at <https://github.com/cgillinger/svensktvader>.
