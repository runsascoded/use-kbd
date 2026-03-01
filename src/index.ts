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
  ModeConfig,
  ModeCustomizations,
  ModeState,
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
  RegisteredMode,
  SeqElem,
  UserModeConfig,
  SeqElemState,
  SeqMatchState,
  SequenceCompletion,
  Direction,
  ModifierName,
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
export type { ActionPairShortcut, ActionShortcut, ActionTripletShortcut, ArrowGroupShortcut, GroupRenderer, GroupRendererProps, ShortcutEntry, ShortcutGroup, ShortcutsModalProps, ShortcutsModalRenderProps, TooltipComponent, TooltipProps } from './ShortcutsModal'
export type { TwoColumnConfig, TwoColumnRow } from './TwoColumnRenderer'
export { createTwoColumnRenderer } from './TwoColumnRenderer'
export type { OmnibarProps, OmnibarRenderProps } from './Omnibar'

// HotkeysProvider (high-level integration with dynamic action registration)
export type { HotkeysConfig, HotkeysContextValue, HotkeysProviderProps } from './HotkeysProvider'
export { HotkeysProvider, useHotkeysContext, useMaybeHotkeysContext } from './HotkeysProvider'

// Action registration
export type { ActionConfig, ActionHandler } from './useAction'
export { useAction, useActions } from './useAction'
export type { ArrowGroupConfig } from './useArrowGroup'
export { useArrowGroup } from './useArrowGroup'
export type { ActionPairConfig, ActionPairEntry } from './useActionPair'
export { useActionPair } from './useActionPair'
export type { ActionTripletConfig, ActionTripletEntry } from './useActionTriplet'
export { useActionTriplet } from './useActionTriplet'
export type { ActionsRegistryValue, RegisteredAction } from './ActionsRegistry'
export { ActionsRegistryContext, useActionsRegistry } from './ActionsRegistry'

// Mode registration
export { useMode } from './useMode'
export type { ModesRegistryValue } from './ModesRegistry'
export { ModesRegistryContext, useModesRegistry } from './ModesRegistry'

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
export { ModeIndicator } from './ModeIndicator'
export type { ModeIndicatorPosition, ModeIndicatorProps } from './ModeIndicator'
export { MobileFAB } from './MobileFAB'
export type { MobileFABProps } from './MobileFAB'
export { SpeedDial } from './SpeedDial'
export type { SpeedDialAction, SpeedDialProps } from './SpeedDial'
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
  ArrowsMove,
  ArrowsDpad,
  ArrowsDouble,
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
  ACTION_LOOKUP,
  ACTION_MODAL,
  ACTION_MODE_PREFIX,
  ACTION_OMNIBAR,
  DEFAULT_BUILTIN_GROUP,
  DEFAULT_SEQUENCE_TIMEOUT,
} from './constants'
