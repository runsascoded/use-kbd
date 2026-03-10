# og:image and favicon audit

Site: https://kbd.rbw.sh

## Completed

### Site og:image
- Added `<meta>` tags in `site/index.html`: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`
- og:image is a 1200x630 mosaic (`/screenshots/og-mosaic.png`, ~128KB) composited from 3 panels:
  - Left (598x630): Shortcuts modal open on table demo (dark theme)
  - Right top (598x313): Table demo content
  - Right bottom (598x313): Calendar demo with events
- Pipeline: `scripts/og-screenshots.ts` (Playwright) → `scripts/compose-og.sh` (ImageMagick)

### Favicon
SVG favicon was already in place. No changes needed.

## Remaining

### Set GitHub social preview
Upload the og:image as the repo's social preview (Settings → Social preview) at 1200x630.

### Apple touch icon
Optionally add `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180x180 PNG) for iOS home screen.
