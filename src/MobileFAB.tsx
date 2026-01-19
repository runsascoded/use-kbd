import { useCallback } from 'react'
import { useMaybeHotkeysContext } from './HotkeysProvider'

export interface MobileFABProps {
  /**
   * Which modal to open when tapped.
   * - 'omnibar': Opens the command palette (default)
   * - 'lookup': Opens the key lookup modal
   */
  target?: 'omnibar' | 'lookup'
  /**
   * Whether to show the FAB.
   * - 'auto': Show on mobile/touch devices only (default)
   * - 'always': Always show
   * - 'never': Never show (useful for conditional rendering)
   */
  visibility?: 'auto' | 'always' | 'never'
  /** Custom CSS class for the FAB button */
  className?: string
  /** Accessible label for the button */
  ariaLabel?: string
  /** Custom icon (defaults to search icon) */
  icon?: React.ReactNode
}

/**
 * Search icon SVG for the FAB
 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/**
 * Floating Action Button for triggering omnibar/lookup on mobile devices.
 *
 * On mobile, keyboard shortcuts aren't available, but users can still benefit
 * from the omnibar's fuzzy search to discover and execute actions quickly.
 *
 * By default, the FAB only appears on mobile/touch devices (viewport < 640px
 * or no hover capability). Set `visibility="always"` to show it everywhere.
 *
 * @example
 * ```tsx
 * // Basic usage - shows on mobile, opens omnibar
 * <MobileFAB />
 *
 * // Open lookup modal instead
 * <MobileFAB target="lookup" />
 *
 * // Always visible (desktop + mobile)
 * <MobileFAB visibility="always" />
 * ```
 */
export function MobileFAB({
  target = 'omnibar',
  visibility = 'auto',
  className,
  ariaLabel,
  icon,
}: MobileFABProps) {
  const ctx = useMaybeHotkeysContext()

  const handleClick = useCallback(() => {
    if (!ctx) return

    if (target === 'lookup') {
      ctx.openLookup()
    } else {
      ctx.openOmnibar()
    }
  }, [ctx, target])

  // Don't render if explicitly hidden
  if (visibility === 'never') return null

  // Don't render if no context (not within HotkeysProvider)
  if (!ctx) return null

  // Build class names
  const classNames = ['kbd-fab']
  if (visibility === 'auto') {
    classNames.push('kbd-fab-auto')
  }
  if (className) {
    classNames.push(className)
  }

  const label = ariaLabel ?? (target === 'lookup' ? 'Open key lookup' : 'Open command palette')

  return (
    <button
      type="button"
      className={classNames.join(' ')}
      onClick={handleClick}
      aria-label={label}
    >
      {icon ?? <SearchIcon className="kbd-fab-icon" />}
    </button>
  )
}
