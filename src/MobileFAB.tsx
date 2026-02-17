import { useCallback, useEffect, useState } from 'react'
import { useMaybeHotkeysContext } from './HotkeysProvider'

/**
 * @deprecated Use {@link SpeedDialProps} from `SpeedDial` instead.
 */
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
  /**
   * Hide the FAB while scrolling (default: true)
   */
  hideOnScroll?: boolean
  /**
   * Delay in ms before showing FAB after scroll stops (default: 800)
   */
  scrollIdleDelay?: number
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
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}

/**
 * @deprecated Use `SpeedDial` instead, which supports expandable secondary actions,
 * hover-peek + click-to-pin, and cross-device support.
 *
 * Floating Action Button for triggering omnibar/lookup on mobile devices.
 *
 * On mobile, keyboard shortcuts aren't available, but users can still benefit
 * from the omnibar's fuzzy search to discover and execute actions quickly.
 *
 * By default, the FAB only appears on mobile/touch devices (viewport < 640px
 * or no hover capability). Set `visibility="always"` to show it everywhere.
 *
 * The FAB hides while scrolling and reappears after the user stops scrolling.
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
 *
 * // Disable hide-on-scroll
 * <MobileFAB hideOnScroll={false} />
 * ```
 */
export function MobileFAB({
  target = 'omnibar',
  visibility = 'auto',
  hideOnScroll = true,
  scrollIdleDelay = 800,
  className,
  ariaLabel,
  icon,
}: MobileFABProps) {
  const ctx = useMaybeHotkeysContext()
  const [isScrolling, setIsScrolling] = useState(false)

  // Hide on scroll behavior
  useEffect(() => {
    if (!hideOnScroll) return

    let scrollTimeout: ReturnType<typeof setTimeout>

    const handleScroll = () => {
      setIsScrolling(true)
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false)
      }, scrollIdleDelay)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [hideOnScroll, scrollIdleDelay])

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
  if (isScrolling) {
    classNames.push('kbd-fab-hidden')
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
