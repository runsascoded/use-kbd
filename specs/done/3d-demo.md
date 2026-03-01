# 3D Viewer Demo Page

**Status: Done** — implemented with additional features beyond original spec:
- `useActionPair` for zoom in/out (compact row)
- `useActionTriplet` for slice along X/Y/Z (compact row + clipping planes)
- Mouse wheel support (zoom, pan, roll via modifiers)
- Camera-relative panning (Shift+arrows globally, bare arrows in pan mode)
- Shift = 2x speed in orbit and pan modes
- Roll via Ctrl+Left/Right
- Full e2e test coverage (15+ tests)

## Purpose

A fourth demo page (`/3d`) in the docs site that renders a simple Three.js scene with orbit and pan camera modes. Primary goals:

1. Showcase **modes** — orbit mode vs pan mode with visual `ModeIndicator`
2. Showcase **arrow groups** — directional camera control with `useArrowGroup`
3. Provide **e2e test coverage** for mode switching, mode-scoped keys, mode indicators, and arrow groups in a mode context
4. Set the stage for **editable modes** (spec 11) — this demo will be the natural testbed for user-created modes and mode membership editing

## Dependency

Add `three` to the site's dependencies (not to the library). Raw Three.js, no `@react-three/fiber` — keeps deps minimal and the demo is about keyboard shortcuts, not 3D rendering.

```bash
cd /Users/ryan/c/js/use-kbd/site && pnpm add three && pnpm add -D @types/three
```

## Route setup

- Path: `/3d`
- Nav label: "3D"
- Nav binding: `g 3`
- Keywords: `['viewer', 'cube', '3d', 'orbit', 'pan']`
- File: `site/src/routes/ThreeDDemo.tsx`

Add to `App.tsx`:
- Import and route: `<Route path="/3d" element={<ThreeDDemo />} />`
- Nav link with `ActionLink` (between Canvas and Calendar)

## Scene

A simple, visually distinctive 3D scene using raw Three.js:

- **Geometry**: A single colored cube (each face a different color via `MeshFaceMaterial` or vertex colors) on a subtle grid floor
- **Lighting**: Ambient + directional light for depth perception
- **Camera**: `PerspectiveCamera` looking at the cube from a 45-degree angle
- **Background**: Theme-aware (`#f0f0f0` light / `#111111` dark)
- **Canvas size**: Fill the container width, 500px height

The scene is rendered into a `<canvas>` via a `useEffect` that creates the Three.js renderer, scene, camera, and animation loop. Clean up on unmount.

## Modes

Two modes, each with its own arrow group:

### Orbit mode (`view:orbit`)
- Activation: `g o` (sequence)
- Color: `#4fc3f7` (blue)
- Label: "Orbit"
- Arrow group (`orbit:rotate`):
  - Left/Right: rotate camera around Y axis (azimuth)
  - Up/Down: rotate camera around X axis (elevation)
  - Default modifiers: `[]` (bare arrows)
  - Extra bindings: `{ left: ['h'], right: ['l'], up: ['k'], down: ['j'] }`

### Pan mode (`view:pan`)
- Activation: `g p` (sequence)
- Color: `#ff9800` (orange)
- Label: "Pan"
- Arrow group (`pan:move`):
  - Left/Right: translate camera target horizontally
  - Up/Down: translate camera target vertically
  - Default modifiers: `[]` (bare arrows)
  - Extra bindings: `{ left: ['h'], right: ['l'], up: ['k'], down: ['j'] }`

### Global actions (not mode-scoped)
- `view:zoom-in`: `=` / `+` — zoom in (move camera closer)
- `view:zoom-out`: `-` — zoom out (move camera farther)
- `view:reset`: `0` — reset camera to default position
- `view:wireframe`: `f` — toggle wireframe rendering

## Camera model

Use a spherical coordinate system for the camera:
- `azimuth` (θ): horizontal angle, default 45°
- `elevation` (φ): vertical angle, default 30°, clamped to [-85°, 85°]
- `distance`: camera distance from target, default 5
- `target`: Vec3 that the camera looks at, default (0, 0, 0)

Orbit mode modifies `azimuth`/`elevation`. Pan mode modifies `target`. Zoom modifies `distance`. This is simpler than using Three.js's `OrbitControls` and gives us full keyboard control.

Store camera state in `sessionStorage` (like the Canvas demo) so it persists across HMR/navigation.

## UI

```
┌─ nav ──────────────────────────────────────────────┐
│ Home  Demos: Table | Canvas | 3D | Calendar        │
├────────────────────────────────────────────────────┤
│                                                     │
│  3D Viewer Demo                                     │
│  Press [?] for shortcuts.                           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │           [colored cube on grid]            │   │
│  │                                             │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Camera: θ=45° φ=30° d=5.0  Target: (0, 0, 0)     │
│  Wireframe: off                                     │
│                                                     │
│  [ModeIndicator bottom-left]                        │
│                                                     │
├─ ShortcutsModal ───────────────────────────────────┤
│  (editable, groups: Orbit, Pan, 3D View, ...)      │
└────────────────────────────────────────────────────┘
```

### Status bar

Below the canvas, show camera state as a status line with `data-testid` attributes for e2e assertions:

```tsx
<div className="viewer-status">
  <span data-testid="camera-azimuth">θ={azimuth}°</span>
  <span data-testid="camera-elevation">φ={elevation}°</span>
  <span data-testid="camera-distance">d={distance.toFixed(1)}</span>
  <span data-testid="camera-target">
    Target: ({target.x.toFixed(1)}, {target.y.toFixed(1)}, {target.z.toFixed(1)})
  </span>
  <span data-testid="wireframe">Wireframe: {wireframe ? 'on' : 'off'}</span>
</div>
```

## ShortcutsModal config

```tsx
<ShortcutsModal
  editable
  groupOrder={['Orbit', 'Pan', '3D: View', 'Global', 'Navigation']}
/>
```

## ModeIndicator

```tsx
<ModeIndicator position="bottom-left" />
```

## Files

| File | Change |
|---|---|
| `site/package.json` | Add `three`, `@types/three` |
| `site/src/routes/ThreeDDemo.tsx` | New — 3D viewer component |
| `site/src/App.tsx` | Add route, nav link |
| `site/src/styles/` | Styles for `.viewer-*` classes (minimal) |
| `site/e2e/hotkeys.spec.ts` | New test section: "3D Viewer Demo" |

## E2E tests

### `3D Viewer Demo` test group

Tests navigate to `/3d` before each test.

1. **orbit mode: arrow keys rotate camera**
   - Press `g o` to activate orbit mode
   - Verify ModeIndicator shows "Orbit" with blue color
   - Press `ArrowRight` → verify azimuth increased
   - Press `ArrowUp` → verify elevation increased

2. **pan mode: arrow keys pan camera**
   - Press `g p` to activate pan mode
   - Verify ModeIndicator shows "Pan" with orange color
   - Press `ArrowRight` → verify target.x increased
   - Press `ArrowUp` → verify target.y increased

3. **mode switching: orbit → pan → escape**
   - Press `g o` → verify orbit mode active
   - Press `g p` → verify pan mode active (orbit deactivated)
   - Press `Escape` → verify no mode active
   - Press arrow key → verify no camera change (arrows are mode-scoped, not global)

4. **zoom works in any mode (global action)**
   - Press `=` → verify distance decreased
   - Press `-` → verify distance increased
   - Press `0` → verify camera reset to defaults

5. **vim keys work as extra bindings in orbit mode**
   - Press `g o` to activate orbit mode
   - Press `l` → verify azimuth increased (same as ArrowRight)
   - Press `k` → verify elevation increased (same as ArrowUp)

6. **wireframe toggle**
   - Press `f` → verify wireframe status shows "on"
   - Press `f` → verify wireframe status shows "off"

7. **mode-scoped keys inactive outside mode**
   - Without activating any mode, press arrow keys
   - Verify camera state unchanged (arrows are mode-scoped)

8. **shortcuts modal shows mode groups with colored borders**
   - Press `?` to open shortcuts modal
   - Verify "Orbit" group exists with blue left border
   - Verify "Pan" group exists with orange left border
   - Verify both groups contain arrow group entries

## CSS

Minimal styles in `site/src/styles/_3d.scss` (or inline in the component):

```scss
.viewer-app {
  // Match the pattern of .canvas-app, .calendar-app
}

.viewer-container {
  width: 100%;
  height: 500px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
}

.viewer-status {
  display: flex;
  gap: 16px;
  font-family: monospace;
  font-size: 13px;
  padding: 8px 0;
  color: var(--text-secondary);
}
```
