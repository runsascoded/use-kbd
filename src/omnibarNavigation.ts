import { isMac } from './utils'
import type { ActionHref } from './types'

/** Native input event accepted by the headless palette's execute method. */
export type OmnibarExecutionEvent = KeyboardEvent | MouseEvent

export function resolveHref(href?: ActionHref): string | undefined {
  return typeof href === 'function' ? href() : href
}

export function opensNewContext(event?: OmnibarExecutionEvent): boolean {
  return !!event && (event.shiftKey || ('button' in event && event.button === 1) || (isMac() ? event.metaKey : event.ctrlKey))
}

/** Preserve all native modified-click gestures, including the browser's Alt action. */
export function isModifiedLinkClick(event: MouseEvent): boolean {
  return event.button === 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

export function openHref(href: string, event?: OmnibarExecutionEvent): void {
  // Use the browser's link disposition rules for background/foreground tabs and
  // normal windows, preserving noopener without needing a window handle.
  const link = document.createElement('a')
  link.href = href
  link.target = '_blank'
  link.rel = 'noopener'
  document.body.append(link)
  const middle = !!event && 'button' in event && event.button === 1
  link.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
    metaKey: event?.metaKey || (middle && isMac()),
    ctrlKey: event?.ctrlKey || (middle && !isMac()),
    shiftKey: event?.shiftKey,
    altKey: event?.altKey,
  }))
  link.remove()
}

/** Keep the existing KeyboardEvent handler API, including modifiers on clicks. */
export function executionKeyEvent(event?: OmnibarExecutionEvent): KeyboardEvent {
  return event instanceof KeyboardEvent ? event : new KeyboardEvent('keydown', {
    key: 'Enter',
    metaKey: event?.metaKey,
    ctrlKey: event?.ctrlKey,
    shiftKey: event?.shiftKey,
    altKey: event?.altKey,
  })
}
