# Privacy

Last updated: November 11, 2026.

## Data flow

Shekel Converter reads text and currency-related metadata in supported HTTP and HTTPS pages to identify prices. Matching and conversion happen inside the browser. It inserts conversion badges and a small rate-provider attribution link into the page.

The background worker requests `https://open.er-api.com/v6/latest/ILS`. The extension does not put visited page URLs, page text, detected prices, account information, or preferences in that request. Like any network service, the provider can receive ordinary connection information, including an IP address and HTTP request metadata. Its handling of that information is covered by its own [terms and privacy information](https://www.exchangerate-api.com/terms).

The attribution link opens the provider's website only when clicked.

## Local storage

Chrome's local extension storage holds the cached exchange-rate table, its publication time and refresh expiry, automatic conversion and tax visibility preferences, and the fallback currencies for ambiguous symbols.

This data remains until the extension's storage is cleared or the extension is uninstalled. It is not deliberately synchronized through `chrome.storage.sync` or uploaded by this extension.

## Permissions

| Permission or access | Reason |
| --- | --- |
| `storage` | Save settings and cached rates locally. |
| `alarms` | Periodically check whether the cached rates need refreshing. |
| `https://open.er-api.com/*` | Fetch the rate table. |
| Content scripts on HTTP/HTTPS pages and their frames | Detect prices and add ILS conversions. Chrome may describe this as access to read and change website data. |

There is no analytics SDK, telemetry endpoint, advertising integration, account registration, or extension-operated server. The extension does not request cookies, browsing history, clipboard, or account permissions.

## Reporting a concern

For suspected vulnerabilities, follow [SECURITY.md](SECURITY.md). For privacy questions, open an issue without including private data.
