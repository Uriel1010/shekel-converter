# Contributing

## Local setup

1. Clone the repository and load its root folder using **Load unpacked** at `chrome://extensions`.
2. Use Node.js 22+ to run `npm test` and `npm run check`. No dependencies need installing.
3. Reload the extension card and refresh the test page after editing code.

Keep runtime code local, dependency-free, and compatible with Manifest V3. Avoid broadening permissions unless a change requires it and its privacy implications are documented.

## Verification

For parser or conversion changes, include a regression case in `test.cjs`. Rate tests use a mocked provider, without live financial values or network access.

For content or popup changes, manually check:

- Explicit currencies (`EUR 100`, `AUD 100`, `US$100`).
- A bare `$` on ASOS `/au/` and a page without currency context.
- Dynamically added or changed prices; repeated scans should not duplicate badges.
- Conversion off and on, including cleanup of existing badges.
- Tax estimates off and on while conversion remains enabled; reopen the popup to verify persistence.
- Values at, below, and above the equivalent of US$75.
- An initial rate failure and an offline cached-rate fallback.

## Issues and pull requests

Describe expected and observed behavior. Include a public URL, Chrome version, extension version, and redacted screenshot when useful. Never include tokens, cookies, order information, or account details.

Keep pull requests focused, explain the resulting behavior, and state what you checked. Update documentation for changes to permissions, settings, packaging, or detection behavior.

## Packaging and releases

Run `python scripts/package.py` (Python 3 standard library) to create a clean runtime ZIP in the ignored `dist/` directory. Keep manifest, package, and changelog versions aligned. Pushing a `v*` tag runs checks, verifies the tag matches the manifest, and attaches the ZIP to a GitHub release.

## Artwork

`icons/icon.svg` is the editable icon source. PNG files are pre-rendered for Chrome. `scripts/artwork.py` recreates the PNG sizes and illustrative README preview with Pillow, an optional maintainer dependency. The preview uses fictional prices and rates and must remain labeled as illustrative.
