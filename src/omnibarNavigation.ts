import { isMac } from './utils'
import type { ActionHref } from './types'

/** Native input event accepted by the headless palette's execute method. */
export type OmnibarExecutionEvent = KeyboardEvent | MouseEvent

export function resolveHref(href?: ActionHref): string | undefined {
  return typeof href === 'function' ? href() : href
}

export function opensNewTab(event?: OmnibarExecutionEvent): boolean {
  return !!event && (('button' in event && event.button === 1) || (isMac() ? event.metaKey : event.ctrlKey))
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
