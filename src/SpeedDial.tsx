import { type ComponentType, useCallback, useEffect, useRef, useState } from 'react'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { SearchIcon } from './SearchTrigger'

export interface SpeedDialTooltipProps {
  /** Tooltip text */
  title: string
  /** The anchor element to position relative to */
  anchor: HTMLElement
}

export interface SpeedDialAction {
  /** Unique key for React rendering */
  key: string
  /** Accessible label */
  label: string
  /** Icon element */
  icon: React.ReactNode
  /** Click handler (for button actions) */
  onClick?: () => void
  /** Link href (renders as <a> instead of <button>) */
  href?: string
  /** Open link in new tab (defaults to true for links) */
  external?: boolean
}

export interface SpeedDialProps {
  /** Extra actions rendered above the built-in shortcuts action */
  actions?: SpeedDialAction[]
  /** Whether to show the built-in "Shortcuts" action that opens the omnibar (default: true) */
  showShortcuts?: boolean
  /** Position offset from viewport edges */
  position?: { top?: number; bottom?: number; left?: number; right?: number }
  /** Duration in ms for long-press to toggle sticky (default: 400) */
  longPressDuration?: number
  /** Custom icon for the primary button (defaults to SearchIcon) */
  primaryIcon?: React.ReactNode
  /** Accessible label for the primary button */
  ariaLabel?: string
  /** Custom CSS class for the container */
  className?: string
  /**
   * How to display the expand/collapse chevron:
   * - 'separate' (default): standalone button above the primary button
   * - 'badge': small overlapping badge on the primary button's top edge
   * - 'none': no chevron; expand via hover/long-press only
   */
  chevronMode?: 'separate' | 'badge' | 'none'
  /** Custom tooltip renderer for action buttons.
   *  Renders a positioned overlay anchored to the hovered button.
   *  Recommended placement: opposite the SD's viewport edge (typically 'left').
   *  use-kbd manages hover detection internally. */
  TooltipRenderer?: ComponentType<SpeedDialTooltipProps>
}

function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  const d = direction === 'up' ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '1em', height: '1em' }}
    >
      <path d={d} />
    </svg>
  )
}

function KeyboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '1em', height: '1em' }}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
    </svg>
  )
}

export function SpeedDial({
  actions,
  showShortcuts = true,
  position,
  longPressDuration = 400,
  primaryIcon,
  ariaLabel = 'Open command palette',
  className,
  chevronMode = 'separate',
  TooltipRenderer,
}: SpeedDialProps) {
  const ctx = useMaybeHotkeysContext()
  const [isSticky, setIsSticky] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [tooltip, setTooltip] = useState<{ title: string; anchor: HTMLElement } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const primaryBtnRef = useRef<HTMLButtonElement>(null)

  const isExpanded = isSticky || isHovered

  // Click-outside to clear sticky
  useEffect(() => {
    if (!isSticky) return
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (!document.contains(target)) return
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsSticky(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [isSticky])

  // Long-press on primary button (non-passive touch)
  useEffect(() => {
    const btn = primaryBtnRef.current
    if (!btn) return

    let timer: ReturnType<typeof setTimeout> | null = null
    let longPressFired = false

    const onTouchStart = (_e: TouchEvent) => {
      longPressFired = false
      timer = setTimeout(() => {
        longPressFired = true
        setIsSticky(s => !s)
      }, longPressDuration)
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (longPressFired) {
        e.preventDefault()
      }
    }
    const onTouchMove = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    btn.addEventListener('touchstart', onTouchStart, { passive: false })
    btn.addEventListener('touchend', onTouchEnd, { passive: false })
    btn.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      btn.removeEventListener('touchstart', onTouchStart)
      btn.removeEventListener('touchend', onTouchEnd)
      btn.removeEventListener('touchmove', onTouchMove)
      if (timer) clearTimeout(timer)
    }
  }, [longPressDuration])

  const handlePrimaryClick = useCallback(() => {
    if (!ctx) return
    ctx.openOmnibar()
  }, [ctx])

  const handleChevronClick = useCallback(() => {
    setIsSticky(s => !s)
  }, [])

  if (!ctx) return null

  const verticalProp = position?.top != null ? 'top' : 'bottom'
  const verticalVal = position?.top ?? position?.bottom ?? 20
  const horizontalProp = position?.left != null ? 'left' : 'right'
  const horizontalVal = position?.left ?? position?.right ?? 20

  const containerClasses = ['kbd-speed-dial']
  if (isExpanded) containerClasses.push('kbd-speed-dial-expanded')
  if (chevronMode === 'badge') containerClasses.push('kbd-speed-dial-badge-mode')
  if (className) containerClasses.push(className)

  const chevronClasses = ['kbd-speed-dial-chevron']
  if (isSticky) chevronClasses.push('kbd-speed-dial-sticky')
  if (chevronMode === 'badge') chevronClasses.push('kbd-speed-dial-badge')

  // Built-in shortcuts action
  const builtinActions: SpeedDialAction[] = []
  if (showShortcuts) {
    builtinActions.push({
      key: '_kbd_shortcuts',
      label: 'Shortcuts',
      icon: <KeyboardIcon />,
      onClick: () => ctx.openModal(),
    })
  }

  const allSecondaryActions = [...builtinActions, ...(actions ?? [])]

  return (
    <div
      ref={containerRef}
      className={containerClasses.join(' ')}
      style={{
        position: 'fixed',
        [verticalProp]: `calc(${verticalVal}px + env(safe-area-inset-${verticalProp}, 0px))`,
        [horizontalProp]: `${horizontalVal}px`,
      }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setIsHovered(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setIsHovered(false) }}
    >
      {/* DOM order = visual bottom-to-top via column-reverse */}

      {/* Primary button (bottom) */}
      <button
        ref={primaryBtnRef}
        type="button"
        className="kbd-speed-dial-primary"
        onClick={handlePrimaryClick}
        aria-label={ariaLabel}
        title={TooltipRenderer ? undefined : ariaLabel}
        onMouseEnter={TooltipRenderer ? (e) => setTooltip({ title: ariaLabel, anchor: e.currentTarget }) : undefined}
        onMouseLeave={TooltipRenderer ? () => setTooltip(null) : undefined}
      >
        {primaryIcon ?? <SearchIcon className="kbd-speed-dial-icon" />}
      </button>

      {/* Chevron toggle (above primary) */}
      {chevronMode !== 'none' && (() => {
        const chevronTitle = isExpanded ? 'Collapse actions' : 'Expand actions'
        return (
          <button
            type="button"
            className={chevronClasses.join(' ')}
            onClick={handleChevronClick}
            aria-label={chevronTitle}
            aria-expanded={isExpanded}
            title={TooltipRenderer ? undefined : chevronTitle}
            onMouseEnter={TooltipRenderer ? (e) => setTooltip({ title: chevronTitle, anchor: e.currentTarget }) : undefined}
            onMouseLeave={TooltipRenderer ? () => setTooltip(null) : undefined}
          >
            <ChevronIcon direction={isExpanded ? 'down' : 'up'} />
          </button>
        )
      })()}

      {/* Secondary actions (above chevron, visible when expanded) */}
      {isExpanded && allSecondaryActions.map(action => {
        const cls = 'kbd-speed-dial-action'
        const tipProps = TooltipRenderer ? {
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => setTooltip({ title: action.label, anchor: e.currentTarget }),
          onMouseLeave: () => setTooltip(null),
        } : { title: action.label }
        if (action.href) {
          const external = action.external ?? true
          return (
            <a
              key={action.key}
              className={cls}
              href={action.href}
              aria-label={action.label}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              {...tipProps}
            >
              {action.icon}
            </a>
          )
        }
        return (
          <button
            key={action.key}
            type="button"
            className={cls}
            onClick={action.onClick}
            aria-label={action.label}
            {...tipProps}
          >
            {action.icon}
          </button>
        )
      })}

      {/* Custom tooltip renderer (positioned overlay) */}
      {TooltipRenderer && tooltip && (
        <TooltipRenderer title={tooltip.title} anchor={tooltip.anchor} />
      )}
    </div>
  )
}
