import { useMemo } from 'react'
import { useMaybeHotkeysContext } from './HotkeysProvider'

export type ModeIndicatorPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface ModeIndicatorProps {
  /** Position on screen (default: 'bottom-right') */
  position?: ModeIndicatorPosition
  /** Additional CSS class */
  className?: string
}

/**
 * Optional UI component that shows the currently active mode as a fixed pill.
 *
 * Displays the mode label with its accent color and a dismiss button.
 * Automatically hides when no mode is active.
 *
 * @example
 * ```tsx
 * <HotkeysProvider>
 *   <App />
 *   <ModeIndicator position="bottom-right" />
 * </HotkeysProvider>
 * ```
 */
export function ModeIndicator({
  position = 'bottom-right',
  className,
}: ModeIndicatorProps) {
  const ctx = useMaybeHotkeysContext()

  const activeMode = ctx?.activeMode
  const modeInfo = useMemo(() => {
    if (!activeMode || !ctx?.modes) return null
    return ctx.modes.get(activeMode) ?? null
  }, [activeMode, ctx?.modes])

  if (!modeInfo || !activeMode) return null

  const positionClass = `kbd-mode-${position}`
  const classes = ['kbd-mode-indicator', positionClass, className].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      style={modeInfo.config.color ? { '--kbd-mode-color': modeInfo.config.color } as React.CSSProperties : undefined}
    >
      <span className="kbd-mode-indicator-label">{modeInfo.config.label}</span>
      <button
        className="kbd-mode-indicator-dismiss"
        onClick={() => ctx?.deactivateMode()}
        aria-label={`Exit ${modeInfo.config.label} mode`}
      >
        ×
      </button>
    </div>
  )
}
