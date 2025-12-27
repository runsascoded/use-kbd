// Types
export type {
  ActionDefinition,
  ActionRegistry,
  ActionSearchResult,
  HotkeySequence,
  KeyCombination,
  KeyCombinationDisplay,
  RecordHotkeyOptions,
  RecordHotkeyResult,
  SequenceCompletion,
} from './types'

export type { HandlerMap, HotkeyMap, UseHotkeysOptions, UseHotkeysResult } from './useHotkeys'
export type { UseEditableHotkeysOptions, UseEditableHotkeysResult } from './useEditableHotkeys'
export type { UseOmnibarOptions, UseOmnibarResult } from './useOmnibar'
export type {
  BindingInfo,
  KeybindingEditorProps,
  KeybindingEditorRenderProps,
} from './KeybindingEditor'
export type { ShortcutGroup, ShortcutsModalProps, ShortcutsModalRenderProps } from './ShortcutsModal'
export type { OmnibarProps, OmnibarRenderProps } from './Omnibar'
export type {
  KeyboardShortcutsContextValue,
  KeyboardShortcutsProviderProps,
} from './KeyboardShortcutsContext'

// Action types and helpers
export type { Action, Actions, ActionsByRoute, RouteMatcher } from './actions'
export {
  defineActions,
  defineActionsByRoute,
  filterActionsByRoute,
  getActionRegistry,
  getDefaultKeymap,
  getGroups,
  getHandlers,
  groupActions,
  matchesRoute,
} from './actions'

// HotkeysProvider (high-level integration)
export type { HotkeysConfig, HotkeysContextValue, HotkeysProviderProps } from './HotkeysProvider'
export { HotkeysProvider, useHotkeysContext, useHotkeysUI } from './HotkeysProvider'

// Context & Provider (lower-level)
export {
  KeyboardShortcutsProvider,
  useKeyboardShortcutsContext,
  useRegisteredHotkeys,
} from './KeyboardShortcutsContext'

// Hooks
export { useHotkeys } from './useHotkeys'
export { useRecordHotkey } from './useRecordHotkey'
export { useEditableHotkeys } from './useEditableHotkeys'
export { useOmnibar } from './useOmnibar'

// Components
export { KeybindingEditor } from './KeybindingEditor'
export { ShortcutsModal } from './ShortcutsModal'
export { Omnibar } from './Omnibar'
export {
  CommandIcon,
  CtrlIcon,
  ShiftIcon,
  OptIcon,
  AltIcon,
  ModifierIcon,
  getModifierIcon,
} from './ModifierIcons'
export type { ModifierIconProps, ModifierType } from './ModifierIcons'

// Utilities
export {
  findConflicts,
  formatCombination,
  formatKeyForDisplay,
  fuzzyMatch,
  getActionBindings,
  getConflictsArray,
  getSequenceCompletions,
  hasConflicts,
  isMac,
  isModifierKey,
  isSequence,
  normalizeKey,
  parseCombinationId,
  parseHotkeyString,
  searchActions,
} from './utils'

export type { FuzzyMatchResult, KeyConflict } from './utils'
