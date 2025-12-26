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
export type { ShortcutGroup, ShortcutsModalProps } from './ShortcutsModal'
export type {
  KeyboardShortcutsContextValue,
  KeyboardShortcutsProviderProps,
} from './KeyboardShortcutsContext'

// Context & Provider
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
