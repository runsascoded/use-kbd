/**
 * Default timeout for key sequences (no timeout).
 * Set to a finite number (ms) to auto-submit sequences after that duration.
 */
export const DEFAULT_SEQUENCE_TIMEOUT = Infinity

/**
 * Reserved action IDs for built-in UI components.
 * These are registered automatically by their respective components.
 */
export const ACTION_MODAL = '__hotkeys:modal'
export const ACTION_OMNIBAR = '__hotkeys:omnibar'
export const ACTION_LOOKUP = '__hotkeys:lookup'

/**
 * Default group name for built-in actions (shortcuts modal, omnibar, lookup).
 * Override via `builtinGroup` in HotkeysConfig.
 */
export const DEFAULT_BUILTIN_GROUP = 'Meta'

/**
 * Prefix for mode activation actions.
 * Mode activation actions are registered with ID `__mode:{modeId}`.
 */
export const ACTION_MODE_PREFIX = '__mode:'
