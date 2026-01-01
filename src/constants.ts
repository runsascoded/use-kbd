/**
 * Default timeout in milliseconds before a key sequence auto-submits.
 * Used when no explicit `sequenceTimeout` is provided.
 */
export const DEFAULT_SEQUENCE_TIMEOUT = 1000

/**
 * Reserved action IDs for built-in UI components.
 * These are registered automatically by their respective components.
 */
export const ACTION_MODAL = '__hotkeys:modal'
export const ACTION_OMNIBAR = '__hotkeys:omnibar'
export const ACTION_LOOKUP = '__hotkeys:lookup'
