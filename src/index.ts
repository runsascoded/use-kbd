// Types
export type {
  ActionDefinition,
  ActionRegistry,
  ActionSearchResult,
  BindingsExport,
  EndpointPagination,
  EndpointPaginationMode,
  EndpointResponse,
  HotkeySequence,
  KeyCombination,
  KeyCombinationDisplay,
  KeySeq,
  Modifiers,
  OmnibarActionEntry,
  OmnibarEndpointAsyncConfig,
  OmnibarEndpointConfig,
  OmnibarEndpointConfigBase,
  OmnibarEndpointSyncConfig,
  OmnibarEntry,
  OmnibarEntryBase,
  OmnibarLinkEntry,
  RecordHotkeyOptions,
  RecordHotkeyResult,
  SeqElem,
  SeqElemState,
  SeqMatchState,
  SequenceCompletion,
} from './types'

// Sequence type utilities
export { countPlaceholders, extractCaptures, isDigitPlaceholder } from './types'

export type { HandlerMap, HotkeyHandler, HotkeyMap, UseHotkeysOptions, UseHotkeysResult } from './useHotkeys'
export type { UseEditableHotkeysOptions, UseEditableHotkeysResult } from './useEditableHotkeys'
export type { EndpointPaginationInfo, RemoteOmnibarResult, UseOmnibarOptions, UseOmnibarResult } from './useOmnibar'
export type {
  BindingInfo,
  KeybindingEditorProps,
  KeybindingEditorRenderProps,
} from './KeybindingEditor'
export type { GroupRenderer, GroupRendererProps, ShortcutGroup, ShortcutsModalProps, ShortcutsModalRenderProps, TooltipComponent, TooltipProps } from './ShortcutsModal'
export type { TwoColumnConfig, TwoColumnRow } from './TwoColumnRenderer'
export { createTwoColumnRenderer } from './TwoColumnRenderer'
export type { OmnibarProps, OmnibarRenderProps } from './Omnibar'

// HotkeysProvider (high-level integration with dynamic action registration)
export type { HotkeysConfig, HotkeysContextValue, HotkeysProviderProps } from './HotkeysProvider'
export { HotkeysProvider, useHotkeysContext, useMaybeHotkeysContext } from './HotkeysProvider'

// Action registration
export type { ActionConfig, ActionHandler } from './useAction'
export { useAction, useActions } from './useAction'
export type { ActionsRegistryValue, RegisteredAction } from './ActionsRegistry'
export { ActionsRegistryContext, useActionsRegistry } from './ActionsRegistry'

// Omnibar endpoint registration
export type { EndpointQueryResult, OmnibarEndpointsRegistryValue, RegisteredEndpoint } from './OmnibarEndpointsRegistry'
export { OmnibarEndpointsRegistryContext, useOmnibarEndpointsRegistry } from './OmnibarEndpointsRegistry'
export { useOmnibarEndpoint } from './useOmnibarEndpoint'

// Hooks
export { useHotkeys } from './useHotkeys'
export { useRecordHotkey } from './useRecordHotkey'
export { useEditableHotkeys } from './useEditableHotkeys'
export { useOmnibar } from './useOmnibar'
export { useParamEntry } from './useParamEntry'
export type { PendingAction, UseParamEntryOptions, UseParamEntryReturn } from './useParamEntry'

// Components
export { Kbd, Kbds, Key, KbdModal, KbdOmnibar, KbdLookup } from './Kbd'
export type { KbdProps } from './Kbd'
export { KeybindingEditor } from './KeybindingEditor'
export { LookupModal } from './LookupModal'
export { MobileFAB } from './MobileFAB'
export type { MobileFABProps } from './MobileFAB'
export { SearchTrigger, SearchIcon } from './SearchTrigger'
export type { SearchTriggerProps } from './SearchTrigger'
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
  bindingHasPlaceholders,
  findConflicts,
  formatBinding,
  formatCombination,
  formatKeyForDisplay,
  formatKeySeq,
  fuzzyMatch,
  getActionBindings,
  getConflictsArray,
  getSequenceCompletions,
  hasAnyPlaceholderBindings,
  hasConflicts,
  hasDigitPlaceholders,
  hotkeySequenceToKeySeq,
  isMac,
  isModifierKey,
  isSequence,
  isPlaceholderSentinel,
  isShiftedSymbol,
  DIGIT_PLACEHOLDER,
  DIGITS_PLACEHOLDER,
  FLOAT_PLACEHOLDER,
  keySeqToHotkeySequence,
  normalizeKey,
  parseHotkeyString,
  parseKeySeq,
  parseQueryNumbers,
  searchActions,
} from './utils'

export type { FuzzyMatchResult, KeyConflict } from './utils'

// Constants
export {
  DEFAULT_SEQUENCE_TIMEOUT,
  ACTION_MODAL,
  ACTION_OMNIBAR,
  ACTION_LOOKUP,
} from './constants'
