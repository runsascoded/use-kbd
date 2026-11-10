import { forwardRef } from 'react'
import type { HTMLAttributes, MouseEvent, Ref } from 'react'
import type { ActionHref } from './types'
import { resolveHref, type OmnibarExecutionEvent } from './omnibarNavigation'
import { ModifierIcon } from './ModifierIcons'
import { isMac } from './utils'

/** Shared link semantics for the built-in and cmdk palettes. */
interface OmnibarResultRowProps extends HTMLAttributes<HTMLElement> {
  href?: ActionHref
  onExecute: (event: OmnibarExecutionEvent) => void
}

export const OmnibarResultRow = forwardRef<HTMLElement, OmnibarResultRowProps>(
  function OmnibarResultRow({ href, onExecute, onClick, onAuxClick, ...props }, ref) {
    const handleClick = (event: MouseEvent<HTMLElement>) => {
      // auxclick also fires for the context-menu button; leave that native.
      if (event.button !== 0 && event.button !== 1) return
      event.preventDefault()
      onExecute(event.nativeEvent)
    }
    const url = resolveHref(href)
    const handlers = {
      onClick: (event: MouseEvent<HTMLElement>) => { handleClick(event); onClick?.(event) },
      onAuxClick: (event: MouseEvent<HTMLElement>) => { handleClick(event); onAuxClick?.(event) },
    }
    return url
      ? <a {...props} {...handlers} ref={ref as Ref<HTMLAnchorElement>} href={url} />
      : <div {...props} {...handlers} ref={ref as Ref<HTMLDivElement>} />
  },
)

export function OmnibarNewTabHint() {
  const mac = isMac()
  return (
    <div className="kbd-omnibar-new-tab-hint" aria-label={`${mac ? 'Command' : 'Ctrl'}+Enter: open in a new tab`}>
      <kbd className="kbd-kbd">{mac ? <ModifierIcon modifier="meta" aria-hidden="true" /> : 'Ctrl'}↵</kbd> new tab
    </div>
  )
}
