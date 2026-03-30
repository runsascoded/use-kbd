# og:image and favicon audit

Site: https://kbd.rbw.sh

## Completed

### Site og:image
- Added `<meta>` tags in `site/index.html`: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`
- og:image is a 1200x630 mosaic (`/screenshots/og-mosaic.png`, ~128KB) composited from 2 panels:
  - Left (718x630): Omnibar with command palette and search results (dark theme)
  - Right (478x630): Shortcuts modal with keyboard bindings grid (dark theme)
- Pipeline: `scripts/og-screenshots.ts` (Playwright) → `scripts/compose-og.sh` (ImageMagick)

### Favicon
SVG favicon was already in place. No changes needed.

### GitHub social preview
Uploaded `og-mosaic.png` as repo social preview (2026-03-30).

## Remaining

### Apple touch icon
Optionally add `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180x180 PNG) for iOS home screen.
