import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { KbdModal, ModeIndicator, ShortcutsModal, useAction, useArrowGroup, useMode } from 'use-kbd'
import 'use-kbd/styles.css'
import { useTheme } from '../contexts/ThemeContext'

const STORAGE_KEY = 'use-kbd-3d'

const DEG = Math.PI / 180
const ORBIT_STEP = 10  // degrees per keypress
const PAN_STEP = 0.3
const ZOOM_FACTOR = 1.25
const ROLL_STEP = 15  // degrees per keypress

const DEFAULTS = {
  azimuth: 45,
  elevation: 30,
  distance: 5,
  roll: 0,
  target: { x: 0, y: 0, z: 0 },
}

const BG = {
  light: '#f0f0f0',
  dark: '#111111',
}

function getStored<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(`${STORAGE_KEY}-${key}`)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

function Viewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const cubeRef = useRef<THREE.Mesh | null>(null)
  const gridRef = useRef<THREE.GridHelper | null>(null)
  const frameRef = useRef<number>(0)

  const { resolvedTheme } = useTheme()
  const bg = BG[resolvedTheme]

  const [azimuth, setAzimuth] = useState(() => getStored('azimuth', DEFAULTS.azimuth))
  const [elevation, setElevation] = useState(() => getStored('elevation', DEFAULTS.elevation))
  const [distance, setDistance] = useState(() => getStored('distance', DEFAULTS.distance))
  const [roll, setRoll] = useState(() => getStored('roll', DEFAULTS.roll))
  const [target, setTarget] = useState(() => getStored('target', DEFAULTS.target))
  const [wireframe, setWireframe] = useState(() => getStored('wireframe', false))

  // Persist to sessionStorage
  useEffect(() => { sessionStorage.setItem(`${STORAGE_KEY}-azimuth`, JSON.stringify(azimuth)) }, [azimuth])
  useEffect(() => { sessionStorage.setItem(`${STORAGE_KEY}-elevation`, JSON.stringify(elevation)) }, [elevation])
  useEffect(() => { sessionStorage.setItem(`${STORAGE_KEY}-distance`, JSON.stringify(distance)) }, [distance])
  useEffect(() => { sessionStorage.setItem(`${STORAGE_KEY}-roll`, JSON.stringify(roll)) }, [roll])
  useEffect(() => { sessionStorage.setItem(`${STORAGE_KEY}-target`, JSON.stringify(target)) }, [target])
  useEffect(() => { sessionStorage.setItem(`${STORAGE_KEY}-wireframe`, JSON.stringify(wireframe)) }, [wireframe])

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, 500)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / 500, 0.1, 100)
    cameraRef.current = camera

    // Colored cube: each face a different color
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5)
    const materials = [
      new THREE.MeshStandardMaterial({ color: '#ef4444' }), // +X red
      new THREE.MeshStandardMaterial({ color: '#f97316' }), // -X orange
      new THREE.MeshStandardMaterial({ color: '#22c55e' }), // +Y green
      new THREE.MeshStandardMaterial({ color: '#3b82f6' }), // -Y blue
      new THREE.MeshStandardMaterial({ color: '#a855f7' }), // +Z purple
      new THREE.MeshStandardMaterial({ color: '#eab308' }), // -Z yellow
    ]
    const cube = new THREE.Mesh(geometry, materials)
    cube.position.y = 0.75
    scene.add(cube)
    cubeRef.current = cube

    // Grid floor
    const grid = new THREE.GridHelper(10, 10, '#888888', '#444444')
    scene.add(grid)
    gridRef.current = grid

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const directional = new THREE.DirectionalLight(0xffffff, 0.8)
    directional.position.set(5, 10, 7)
    scene.add(directional)

    // Handle resize
    const onResize = () => {
      const w = container.clientWidth
      camera.aspect = w / 500
      camera.updateProjectionMatrix()
      renderer.setSize(w, 500)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frameRef.current)
      renderer.dispose()
      geometry.dispose()
      materials.forEach(m => m.dispose())
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      rendererRef.current = null
    }
  }, [])

  // Render loop: update camera position from spherical coords
  useEffect(() => {
    const render = () => {
      const renderer = rendererRef.current
      const scene = sceneRef.current
      const camera = cameraRef.current
      if (!renderer || !scene || !camera) return

      // Update background
      scene.background = new THREE.Color(bg)

      // Update wireframe
      const cube = cubeRef.current
      if (cube) {
        const mats = cube.material as THREE.MeshStandardMaterial[]
        mats.forEach(m => { m.wireframe = wireframe })
      }

      // Spherical to Cartesian
      const theta = azimuth * DEG
      const phi = elevation * DEG
      const x = distance * Math.cos(phi) * Math.sin(theta)
      const y = distance * Math.sin(phi)
      const z = distance * Math.cos(phi) * Math.cos(theta)

      camera.position.set(target.x + x, target.y + y, target.z + z)
      camera.lookAt(target.x, target.y, target.z)

      // Apply roll
      if (roll !== 0) {
        const rollRad = roll * DEG
        const up = new THREE.Vector3(0, 1, 0)
        const forward = new THREE.Vector3()
        camera.getWorldDirection(forward)
        up.applyAxisAngle(forward, rollRad)
        camera.up.copy(up)
        camera.lookAt(target.x, target.y, target.z)
      } else {
        camera.up.set(0, 1, 0)
      }

      renderer.render(scene, camera)
      frameRef.current = requestAnimationFrame(render)
    }
    render()
    return () => cancelAnimationFrame(frameRef.current)
  }, [azimuth, elevation, distance, roll, target, wireframe, bg])

  // Modes
  const orbitMode = useMode('view:orbit', {
    label: 'Orbit',
    color: '#4fc3f7',
    defaultBindings: ['o'],
  })

  useMode('view:pan', {
    label: 'Pan',
    color: '#ff9800',
    defaultBindings: ['p'],
  })

  // ===== Handlers =====
  const orbitLeft  = useCallback(() => setAzimuth(a => a - ORBIT_STEP), [])
  const orbitRight = useCallback(() => setAzimuth(a => a + ORBIT_STEP), [])
  const orbitUp    = useCallback(() => setElevation(e => Math.min(85, e + ORBIT_STEP)), [])
  const orbitDown  = useCallback(() => setElevation(e => Math.max(-85, e - ORBIT_STEP)), [])
  const panLeft  = useCallback(() => setTarget(t => ({ ...t, x: t.x - PAN_STEP })), [])
  const panRight = useCallback(() => setTarget(t => ({ ...t, x: t.x + PAN_STEP })), [])
  const panUp    = useCallback(() => setTarget(t => ({ ...t, y: t.y + PAN_STEP })), [])
  const panDown  = useCallback(() => setTarget(t => ({ ...t, y: t.y - PAN_STEP })), [])
  const fastOrbitLeft  = useCallback(() => setAzimuth(a => a - ORBIT_STEP * 2), [])
  const fastOrbitRight = useCallback(() => setAzimuth(a => a + ORBIT_STEP * 2), [])
  const fastOrbitUp    = useCallback(() => setElevation(e => Math.min(85, e + ORBIT_STEP * 2)), [])
  const fastOrbitDown  = useCallback(() => setElevation(e => Math.max(-85, e - ORBIT_STEP * 2)), [])
  const fastPanLeft  = useCallback(() => setTarget(t => ({ ...t, x: t.x - PAN_STEP * 2 })), [])
  const fastPanRight = useCallback(() => setTarget(t => ({ ...t, x: t.x + PAN_STEP * 2 })), [])
  const fastPanUp    = useCallback(() => setTarget(t => ({ ...t, y: t.y + PAN_STEP * 2 })), [])
  const fastPanDown  = useCallback(() => setTarget(t => ({ ...t, y: t.y - PAN_STEP * 2 })), [])

  // ===== Global (no mode) — always active, group: "3D: Camera" =====

  // Bare arrows → orbit
  useArrowGroup('camera:orbit', {
    label: 'Orbit',
    group: '3D: Camera',
    defaultModifiers: [],
    handlers: { left: orbitLeft, right: orbitRight, up: orbitUp, down: orbitDown },
  })

  // Shift+arrows → pan
  useArrowGroup('camera:pan', {
    label: 'Pan',
    group: '3D: Camera',
    defaultModifiers: ['shift'],
    handlers: { left: panLeft, right: panRight, up: panUp, down: panDown },
  })

  // Ctrl+arrows → roll (left/right) + orbit (up/down)
  const rollLeft  = useCallback(() => setRoll(r => r - ROLL_STEP), [])
  const rollRight = useCallback(() => setRoll(r => r + ROLL_STEP), [])

  useArrowGroup('camera:orbit-roll', {
    label: 'Orbit / Roll',
    group: '3D: Camera',
    defaultModifiers: ['ctrl'],
    handlers: { left: rollLeft, right: rollRight, up: orbitUp, down: orbitDown },
  })

  // ===== Orbit mode (o) — mode: view:orbit =====

  // Bare arrows orbit + vim hjkl
  useArrowGroup('orbit:rotate', {
    label: 'Orbit',
    mode: 'view:orbit',
    defaultModifiers: [],
    extraBindings: { left: ['h'], right: ['l'], up: ['k'], down: ['j'] },
    handlers: { left: orbitLeft, right: orbitRight, up: orbitUp, down: orbitDown },
  })

  // Shift+arrows = 2× orbit step
  useArrowGroup('orbit:fast', {
    label: 'Fast orbit',
    mode: 'view:orbit',
    defaultModifiers: ['shift'],
    handlers: { left: fastOrbitLeft, right: fastOrbitRight, up: fastOrbitUp, down: fastOrbitDown },
  })

  // ===== Pan mode (p) — mode: view:pan =====

  // Bare arrows pan + vim hjkl
  useArrowGroup('pan:move', {
    label: 'Pan',
    mode: 'view:pan',
    defaultModifiers: [],
    extraBindings: { left: ['h'], right: ['l'], up: ['k'], down: ['j'] },
    handlers: { left: panLeft, right: panRight, up: panUp, down: panDown },
  })

  // Shift+arrows = 2× pan step
  useArrowGroup('pan:fast', {
    label: 'Fast pan',
    mode: 'view:pan',
    defaultModifiers: ['shift'],
    handlers: { left: fastPanLeft, right: fastPanRight, up: fastPanUp, down: fastPanDown },
  })

  // ===== Global view actions =====
  useAction('view:zoom-in', {
    label: 'Zoom in',
    group: '3D: View',
    defaultBindings: ['='],
    handler: useCallback(() => setDistance(d => d / ZOOM_FACTOR), []),
  })

  useAction('view:zoom-out', {
    label: 'Zoom out',
    group: '3D: View',
    defaultBindings: ['-'],
    handler: useCallback(() => setDistance(d => d * ZOOM_FACTOR), []),
  })

  useAction('view:reset', {
    label: 'Reset camera',
    group: '3D: View',
    defaultBindings: ['0'],
    handler: useCallback(() => {
      setAzimuth(DEFAULTS.azimuth)
      setElevation(DEFAULTS.elevation)
      setDistance(DEFAULTS.distance)
      setRoll(DEFAULTS.roll)
      setTarget(DEFAULTS.target)
    }, []),
  })

  useAction('view:wireframe', {
    label: 'Toggle wireframe',
    group: '3D: View',
    defaultBindings: ['f'],
    handler: useCallback(() => setWireframe(w => !w), []),
  })

  return (
    <div className="viewer-app">
      <h1 id="demo">3D Viewer Demo</h1>
      <p className="hint">
        Press <KbdModal /> for shortcuts. Arrow keys orbit, Shift+arrows pan, Ctrl+L/R roll.
        Activate <strong>Orbit</strong> (<kbd>o</kbd>) or <strong>Pan</strong> (<kbd>p</kbd>) mode for vim keys + Shift=fast.
      </p>

      <div className={`viewer-container${orbitMode.active ? ' viewer-orbit-active' : ''}`} ref={containerRef} />

      <div className="viewer-status">
        <span data-testid="camera-azimuth">&theta;={azimuth}&deg;</span>
        <span data-testid="camera-elevation">&phi;={elevation}&deg;</span>
        <span data-testid="camera-distance">d={distance.toFixed(1)}</span>
        <span data-testid="camera-roll">roll={roll}&deg;</span>
        <span data-testid="camera-target">
          Target: ({target.x.toFixed(1)}, {target.y.toFixed(1)}, {target.z.toFixed(1)})
        </span>
        <span data-testid="wireframe">Wireframe: {wireframe ? 'on' : 'off'}</span>
      </div>

      <ModeIndicator position="bottom-left" />

      <ShortcutsModal
        editable
        arrowIcon="move"
        groupOrder={['Orbit', 'Pan', '3D: Camera', '3D: View', 'Global', 'Navigation']}
      />
    </div>
  )
}

export function ThreeDDemo() {
  return <Viewer />
}
