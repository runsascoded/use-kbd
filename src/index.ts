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
export type { GroupRenderer, GroupRendererProps, ShortcutGroup, ShortcutsModalProps, ShortcutsModalRenderProps } from './ShortcutsModal'
export type { TwoColumnConfig, TwoColumnRow } from './TwoColumnRenderer'
export { createTwoColumnRenderer } from './TwoColumnRenderer'
export type { OmnibarProps, OmnibarRenderProps } from './Omnibar'

// HotkeysProvider (high-level integration with dynamic action registration)
export type { HotkeysConfig, HotkeysContextValue, HotkeysProviderProps } from './HotkeysProvider'
export { HotkeysProvider, useHotkeysContext, useMaybeHotkeysContext } from './HotkeysProvider'

// Action registration
export type { ActionConfig } from './useAction'
export { useAction, useActions } from './useAction'
export type { ActionsRegistryValue, RegisteredAction } from './ActionsRegistry'
export { ActionsRegistryContext, useActionsRegistry } from './ActionsRegistry'

// Hooks
export { useHotkeys } from './useHotkeys'
export { useRecordHotkey } from './useRecordHotkey'
export { useEditableHotkeys } from './useEditableHotkeys'
export { useOmnibar } from './useOmnibar'

// Components
export { Kbd } from './Kbd'
export type { KbdProps } from './Kbd'
export { KeybindingEditor } from './KeybindingEditor'
export { Omnibar } from './Omnibar'
export { SequenceModal } from './SequenceModal'
export { ShortcutsModal } from './ShortcutsModal'
export {
  Command,
  Ctrl,
  Shift,
  Option,
  Alt,
  ModifierIcon,
  getModifierIcon,
} from './ModifierIcons'
export type { ModifierIconProps, ModifierType } from './ModifierIcons'
export {
  Up,
  Down,
  Left,
  Right,
  Enter,
  Backspace,
  getKeyIcon,
} from './KeyIcons'
export type { KeyIconProps, KeyIconType } from './KeyIcons'

// Utilities
export {
  findConflicts,
  formatBinding,
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

// Constants
export { DEFAULT_SEQUENCE_TIMEOUT } from './constants'
