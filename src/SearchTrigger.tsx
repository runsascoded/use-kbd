import { useCallback } from 'react'
import { useMaybeHotkeysContext } from './HotkeysProvider'

export interface SearchTriggerProps {
  /**
   * Which modal to open when clicked.
   * - 'omnibar': Opens the command palette (default)
   * - 'lookup': Opens the key lookup modal
   */
  target?: 'omnibar' | 'lookup'
  /** Custom CSS class */
  className?: string
  /** Accessible label for the button */
  ariaLabel?: string
  /** Custom children (defaults to search icon) */
  children?: React.ReactNode
}

/**
 * Search icon SVG
 */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '1em', height: '1em' }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}

/**
 * A simple button to trigger the omnibar or lookup modal.
 *
 * Use this to integrate search into your existing UI (FABs, menus, toolbars).
 * For a standalone floating action button, use `SpeedDial` instead.
 *
 * @example
 * ```tsx
 * // In a custom FAB or menu
 * <SearchTrigger className="my-menu-item" />
 *
 * // Open lookup instead of omnibar
 * <SearchTrigger target="lookup" />
 *
 * // Custom content
 * <SearchTrigger>
 *   <MyCustomIcon /> Search
 * </SearchTrigger>
 * ```
 */
export function SearchTrigger({
  target = 'omnibar',
  className,
  ariaLabel,
  children,
}: SearchTriggerProps) {
  const ctx = useMaybeHotkeysContext()

  const handleClick = useCallback(() => {
    if (!ctx) return

    if (target === 'lookup') {
      ctx.openLookup()
    } else {
      ctx.openOmnibar()
    }
  }, [ctx, target])

  // Don't render if no context (not within HotkeysProvider)
  if (!ctx) return null

  const label = ariaLabel ?? (target === 'lookup' ? 'Open key lookup' : 'Open command palette')

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-label={label}
    >
      {children ?? <SearchIcon />}
    </button>
  )
}
