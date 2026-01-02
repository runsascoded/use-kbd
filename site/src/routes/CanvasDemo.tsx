import { Tooltip } from '@mui/material'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Kbd, KbdModal, ShortcutsModal, useAction, useActions } from 'use-kbd'
import 'use-kbd/styles.css'
import { useTheme } from '../contexts/ThemeContext'

// Canvas background colors for each theme
const CANVAS_BG = {
  light: '#e8e8e8',
  dark: '#1a1a1a',
}

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle'

interface Point {
  x: number
  y: number
}

interface Stroke {
  tool: Tool
  color: string
  size: number
  points: Point[]
  startPoint?: Point
  endPoint?: Point
}

const COLORS = [
  { name: 'Black', value: '#000000', key: '1' },
  { name: 'Red', value: '#ef4444', key: '2' },
  { name: 'Orange', value: '#f97316', key: '3' },
  { name: 'Yellow', value: '#eab308', key: '4' },
  { name: 'Green', value: '#22c55e', key: '5' },
  { name: 'Blue', value: '#3b82f6', key: '6' },
  { name: 'Purple', value: '#a855f7', key: '7' },
  { name: 'White', value: '#ffffff', key: '8' },
]

const SIZES = [2, 4, 8, 16, 32]

const STORAGE_KEY = 'use-kbd-canvas'

function getStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const stored = sessionStorage.getItem(`${STORAGE_KEY}-${key}`)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const canvasBg = CANVAS_BG[resolvedTheme]
  const [tool, setTool] = useState<Tool>(() => getStoredValue('tool', 'pen'))
  const [color, setColor] = useState(() => getStoredValue('color', '#000000'))
  const [size, setSize] = useState(() => getStoredValue('size', 4))

  // Persist tool, color, size to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(`${STORAGE_KEY}-tool`, JSON.stringify(tool))
  }, [tool])
  useEffect(() => {
    sessionStorage.setItem(`${STORAGE_KEY}-color`, JSON.stringify(color))
  }, [color])
  useEffect(() => {
    sessionStorage.setItem(`${STORAGE_KEY}-size`, JSON.stringify(size))
  }, [size])
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [history, setHistory] = useState<Stroke[][]>([])
  const [redoStack, setRedoStack] = useState<Stroke[][]>([])

  // Draw all strokes to canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getContext('2d')
    if (!c) return

    c.fillStyle = canvasBg
    c.fillRect(0, 0, canvas.width, canvas.height)

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes
    for (const stroke of allStrokes) {
      c.strokeStyle = stroke.color
      c.lineWidth = stroke.size
      c.lineCap = 'round'
      c.lineJoin = 'round'

      if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
        if (stroke.points.length < 2) continue
        c.beginPath()
        c.moveTo(stroke.points[0].x, stroke.points[0].y)
        for (let i = 1; i < stroke.points.length; i++) {
          c.lineTo(stroke.points[i].x, stroke.points[i].y)
        }
        c.stroke()
      } else if (stroke.tool === 'line' && stroke.startPoint && stroke.endPoint) {
        c.beginPath()
        c.moveTo(stroke.startPoint.x, stroke.startPoint.y)
        c.lineTo(stroke.endPoint.x, stroke.endPoint.y)
        c.stroke()
      } else if (stroke.tool === 'rect' && stroke.startPoint && stroke.endPoint) {
        c.beginPath()
        const w = stroke.endPoint.x - stroke.startPoint.x
        const h = stroke.endPoint.y - stroke.startPoint.y
        c.strokeRect(stroke.startPoint.x, stroke.startPoint.y, w, h)
      } else if (stroke.tool === 'circle' && stroke.startPoint && stroke.endPoint) {
        c.beginPath()
        // Circle inscribed in bbox, tangent to the two edges meeting at start point
        const dx = stroke.endPoint.x - stroke.startPoint.x
        const dy = stroke.endPoint.y - stroke.startPoint.y
        const radius = Math.min(Math.abs(dx), Math.abs(dy)) / 2
        // Center is offset from start by radius in the drag direction
        const centerX = stroke.startPoint.x + Math.sign(dx) * radius
        const centerY = stroke.startPoint.y + Math.sign(dy) * radius
        c.arc(centerX, centerY, radius, 0, Math.PI * 2)
        c.stroke()
      }
    }
  }, [strokes, currentStroke, canvasBg])

  useEffect(() => {
    redraw()
  }, [redraw])

  // Resize canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    canvas.width = parent.clientWidth
    canvas.height = 400
    redraw()
  }, [redraw])

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getPoint(e)
    setIsDrawing(true)
    const effectiveColor = tool === 'eraser' ? canvasBg : color
    setCurrentStroke({
      tool,
      color: effectiveColor,
      size: tool === 'eraser' ? size * 2 : size,
      points: [point],
      startPoint: point,
      endPoint: point,
    })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke) return
    const point = getPoint(e)

    if (tool === 'pen' || tool === 'eraser') {
      setCurrentStroke(s => s ? { ...s, points: [...s.points, point] } : null)
    } else {
      setCurrentStroke(s => s ? { ...s, endPoint: point } : null)
    }
  }

  const handleMouseUp = () => {
    if (currentStroke) {
      setHistory(h => [...h, strokes])
      setRedoStack([])
      setStrokes(s => [...s, currentStroke])
      setCurrentStroke(null)
    }
    setIsDrawing(false)
  }

  // Tool actions
  useAction('tool:pen', {
    label: 'Pen tool',
    group: 'Canvas: Tools',
    defaultBindings: ['p'],
    handler: useCallback(() => setTool('pen'), []),
  })

  useAction('tool:eraser', {
    label: 'Eraser',
    group: 'Canvas: Tools',
    defaultBindings: ['e'],
    handler: useCallback(() => setTool('eraser'), []),
  })

  useAction('tool:line', {
    label: 'Line tool',
    group: 'Canvas: Tools',
    defaultBindings: ['l'],
    handler: useCallback(() => setTool('line'), []),
  })

  useAction('tool:rect', {
    label: 'Rectangle',
    group: 'Canvas: Tools',
    defaultBindings: ['r'],
    handler: useCallback(() => setTool('rect'), []),
  })

  useAction('tool:circle', {
    label: 'Circle',
    group: 'Canvas: Tools',
    defaultBindings: ['c'],
    handler: useCallback(() => setTool('circle'), []),
  })

  // Color actions (prefix with key number for proper sort order in modal)
  useActions(
    Object.fromEntries(
      COLORS.map(c => [
        `color:${c.key}-${c.name.toLowerCase()}`,
        {
          label: c.name,
          group: 'Canvas: Colors',
          defaultBindings: [c.key],
          handler: () => setColor(c.value),
        },
      ])
    )
  )

  // Size actions
  useAction('size:decrease', {
    label: 'Smaller brush',
    group: 'Canvas: Brush Size',
    defaultBindings: ['['],
    handler: useCallback(() => {
      setSize(s => {
        const idx = SIZES.indexOf(s)
        return idx > 0 ? SIZES[idx - 1] : s
      })
    }, []),
  })

  useAction('size:increase', {
    label: 'Larger brush',
    group: 'Canvas: Brush Size',
    defaultBindings: [']'],
    handler: useCallback(() => {
      setSize(s => {
        const idx = SIZES.indexOf(s)
        return idx < SIZES.length - 1 ? SIZES[idx + 1] : s
      })
    }, []),
  })

  // Edit actions (prefixed for sort order: undo, redo, clear)
  useAction('edit:0-undo', {
    label: 'Undo',
    group: 'Canvas: Edit',
    defaultBindings: ['z'],
    handler: useCallback(() => {
      if (history.length > 0) {
        const prev = history[history.length - 1]
        setRedoStack(r => [...r, strokes])
        setStrokes(prev)
        setHistory(h => h.slice(0, -1))
      }
    }, [history, strokes]),
  })

  useAction('edit:1-redo', {
    label: 'Redo',
    group: 'Canvas: Edit',
    defaultBindings: ['shift+z'],
    handler: useCallback(() => {
      if (redoStack.length > 0) {
        const next = redoStack[redoStack.length - 1]
        setHistory(h => [...h, strokes])
        setStrokes(next)
        setRedoStack(r => r.slice(0, -1))
      }
    }, [redoStack, strokes]),
  })

  useAction('edit:2-clear', {
    label: 'Clear canvas',
    group: 'Canvas: Edit',
    defaultBindings: ['meta+backspace'],
    handler: useCallback(() => {
      if (strokes.length > 0) {
        setHistory(h => [...h, strokes])
        setRedoStack([])
        setStrokes([])
      }
    }, [strokes]),
  })


  return (
    <div className="canvas-app">
      <h1 id="demo">Canvas Demo</h1>
      <p className="hint">
        Press <KbdModal /> for shortcuts. Draw with mouse, use number keys for colors.
      </p>

      <div className="canvas-toolbar">
        <div className="tool-group">
          <span className="group-label">Tool:</span>
          {([
            { id: 'pen', icon: '✏', label: 'Pen' },
            { id: 'eraser', icon: '⌫', label: 'Eraser' },
            { id: 'line', icon: '╱', label: 'Line' },
            { id: 'rect', icon: '▢', label: 'Rectangle' },
            { id: 'circle', icon: '◯', label: 'Circle' },
          ] as const).map(t => (
            <Tooltip key={t.id} title={<>{t.label} <Kbd action={`tool:${t.id}`} /></>} enterDelay={0} arrow>
              <button
                className={`tool-btn ${tool === t.id ? 'active' : ''}`}
                onClick={() => setTool(t.id)}
              >
                {t.icon}
              </button>
            </Tooltip>
          ))}
        </div>

        <div className="tool-group">
          <span className="group-label">Color:</span>
          {COLORS.map(c => (
            <Tooltip key={c.value} title={<>{c.name} <Kbd action={`color:${c.key}-${c.name.toLowerCase()}`} /></>} enterDelay={0} arrow>
              <button
                className={`color-btn ${color === c.value ? 'active' : ''}`}
                style={{ backgroundColor: c.value }}
                onClick={() => setColor(c.value)}
              />
            </Tooltip>
          ))}
        </div>

        <div className="tool-group">
          <span className="group-label">Size:</span>
          {SIZES.map(s => (
            <button
              key={s}
              className={`size-btn ${size === s ? 'active' : ''}`}
              onClick={() => setSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      <div className="canvas-status">
        <span>Tool: {tool}</span>
        <span>Size: {size}px</span>
        <span>Strokes: {strokes.length}</span>
        <span>History: {history.length}</span>
      </div>

      <ShortcutsModal
        editable
        multipleBindings={false}
        groupOrder={['Canvas: Tools', 'Canvas: Colors', 'Canvas: Brush Size', 'Canvas: Edit', 'Global', 'Navigation']}
      />
    </div>
  )
}

export function CanvasDemo() {
  return <Canvas />
}
