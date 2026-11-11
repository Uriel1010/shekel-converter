# Changelog

## 1.3.1 — 2026-11-11

- Split page traversal into short tasks and render conversion badges in batches of up to 20 per animation frame, with a Scheduler API fallback.
- Cancel obsolete scans when preferences change, preserving tax and conversion toggles during long scans.
- Keep watching page changes between batches and allow scans to recover after DOM errors.
- Report failed settings saves in the popup and restore the previous values.
- Use async/await for background messages and handle initialization and refresh failures.
- Recreate the rate-refresh alarm when Chrome starts; keep durable rate data in local storage.
- Add scheduling, cancellation, error recovery, storage failure, request-sharing, and worker-restart regression checks.

## 1.3.0 — 2026-11-11

- Add a custom shekel-and-conversion icon in Chrome toolbar and extension-manager sizes.
- Clarify the independent import tax visibility control in the popup.
- Add English installation, privacy, contribution, security, and troubleshooting documentation.
- Add automated checks and clean extension ZIP packaging.

## Earlier local versions

- **1.2.1:** Persist a separate switch for showing or hiding tax estimates.
- **1.2.0:** Add an optional 18% estimate for amounts above the equivalent of US$75.
- **1.1.1:** Recognize ASOS regional URL paths, including `/au/` for AUD.
- **1.1.0:** Add contextual currency detection from page controls and price metadata.
- **1.0.0:** Initial inline conversions, cached daily rates, and fallback currency settings.
