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
export type { Action, ActionMetadata, ActionMetadataRegistry, Actions, ActionsByRoute, RouteMatcher } from './actions'
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

// HotkeysProvider (high-level integration with static actions)
export type { HotkeysConfig, HotkeysContextValue, HotkeysProviderProps } from './HotkeysProvider'
export { HotkeysProvider, useHotkeysContext, useMaybeHotkeysContext, useHotkeysUI } from './HotkeysProvider'

// DynamicHotkeysProvider (high-level integration with dynamic action registration)
export type { DynamicHotkeysConfig, DynamicHotkeysContextValue, DynamicHotkeysProviderProps } from './DynamicHotkeysProvider'
export { DynamicHotkeysProvider, useDynamicHotkeysContext, useMaybeDynamicHotkeysContext } from './DynamicHotkeysProvider'

// Dynamic action registration
export type { ActionConfig } from './useAction'
export { useAction, useActions } from './useAction'
export type { ActionsRegistryValue, RegisteredAction } from './ActionsRegistry'
export { ActionsRegistryContext, useActionsRegistry } from './ActionsRegistry'

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
export { Omnibar } from './Omnibar'
export { SequenceModal } from './SequenceModal'
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
