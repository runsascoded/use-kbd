import * as react_jsx_runtime from 'react/jsx-runtime';
import React$1 from 'react';

/**
 * Represents a captured key combination
 */
interface KeyCombination {
    /** The main key (lowercase, e.g., 'k', 'enter', 'arrowup') */
    key: string;
    /** Modifier keys pressed */
    modifiers: {
        ctrl: boolean;
        alt: boolean;
        shift: boolean;
        meta: boolean;
    };
}
/**
 * Platform-aware display format for a key combination
 */
interface KeyCombinationDisplay {
    /** Human-readable string (e.g., "⌘+Shift+K" on Mac, "Ctrl+Shift+K" elsewhere) */
    display: string;
    /** Canonical ID for storage/comparison (e.g., "ctrl+shift+k") */
    id: string;
}
/**
 * Result from the useRecordHotkey hook
 */
interface RecordHotkeyResult {
    /** Whether currently recording */
    isRecording: boolean;
    /** Start recording - returns cancel function */
    startRecording: () => () => void;
    /** Cancel recording */
    cancel: () => void;
    /** The captured combination (null until complete) */
    combination: KeyCombination | null;
    /** Display strings for the combination */
    display: KeyCombinationDisplay | null;
    /** Keys currently held down (for UI feedback during recording) */
    activeKeys: KeyCombination | null;
}
/**
 * Options for useRecordHotkey
 */
interface RecordHotkeyOptions {
    /** Called when a combination is captured */
    onCapture?: (combo: KeyCombination, display: KeyCombinationDisplay) => void;
    /** Called when recording is cancelled */
    onCancel?: () => void;
    /** Prevent default on captured keys (default: true) */
    preventDefault?: boolean;
}

/**
 * Hotkey definition - maps key combinations to action names
 */
type HotkeyMap = Record<string, string | string[]>;
/**
 * Handler map - maps action names to handler functions
 */
type HandlerMap = Record<string, (e: KeyboardEvent) => void>;
interface UseHotkeysOptions {
    /** Whether hotkeys are enabled (default: true) */
    enabled?: boolean;
    /** Element to attach listeners to (default: window) */
    target?: HTMLElement | Window | null;
    /** Prevent default on matched hotkeys (default: true) */
    preventDefault?: boolean;
    /** Stop propagation on matched hotkeys (default: true) */
    stopPropagation?: boolean;
    /** Enable hotkeys even when focused on input/textarea/select (default: false) */
    enableOnFormTags?: boolean;
}
/**
 * Hook to register keyboard shortcuts.
 *
 * @example
 * ```tsx
 * useHotkeys(
 *   {
 *     't': 'setTemp',
 *     'c': 'setCO2',
 *     'ctrl+s': 'save',
 *     'shift+?': 'showHelp',
 *   },
 *   {
 *     setTemp: () => setMetric('temp'),
 *     setCO2: () => setMetric('co2'),
 *     save: () => handleSave(),
 *     showHelp: () => setShowHelp(true),
 *   }
 * )
 * ```
 */
declare function useHotkeys(keymap: HotkeyMap, handlers: HandlerMap, options?: UseHotkeysOptions): void;

interface UseEditableHotkeysOptions extends UseHotkeysOptions {
    /** localStorage key for persistence (omit to disable persistence) */
    storageKey?: string;
    /** When true, keys with multiple actions bound are disabled (default: true) */
    disableConflicts?: boolean;
}
interface UseEditableHotkeysResult {
    /** Current keymap (defaults merged with user overrides) */
    keymap: HotkeyMap;
    /** Update a single keybinding */
    setBinding: (action: string, key: string) => void;
    /** Update multiple keybindings at once */
    setKeymap: (overrides: Partial<HotkeyMap>) => void;
    /** Reset all overrides to defaults */
    reset: () => void;
    /** User overrides only (for inspection/export) */
    overrides: Partial<HotkeyMap>;
    /** Map of key -> actions[] for keys with multiple actions bound */
    conflicts: Map<string, string[]>;
    /** Whether there are any conflicts in the current keymap */
    hasConflicts: boolean;
}
/**
 * Wraps useHotkeys with editable keybindings and optional persistence.
 *
 * @example
 * ```tsx
 * const { keymap, setBinding, reset } = useEditableHotkeys(
 *   { 't': 'setTemp', 'c': 'setCO2' },
 *   { setTemp: () => setMetric('temp'), setCO2: () => setMetric('co2') },
 *   { storageKey: 'app-hotkeys' }
 * )
 * ```
 */
declare function useEditableHotkeys(defaults: HotkeyMap, handlers: HandlerMap, options?: UseEditableHotkeysOptions): UseEditableHotkeysResult;

interface KeybindingEditorProps {
    /** Current keymap */
    keymap: HotkeyMap;
    /** Default keymap (for reset functionality) */
    defaults: HotkeyMap;
    /** Descriptions for actions */
    descriptions?: Record<string, string>;
    /** Called when a binding changes */
    onChange: (action: string, key: string) => void;
    /** Called when reset is requested */
    onReset?: () => void;
    /** CSS class for the container */
    className?: string;
    /** Custom render function */
    children?: (props: KeybindingEditorRenderProps) => React.ReactNode;
}
interface KeybindingEditorRenderProps {
    bindings: BindingInfo[];
    editingAction: string | null;
    activeKeys: KeyCombination | null;
    startEditing: (action: string) => void;
    cancelEditing: () => void;
    reset: () => void;
    conflicts: Map<string, string[]>;
}
interface BindingInfo {
    action: string;
    key: string;
    display: KeyCombinationDisplay;
    description: string;
    isDefault: boolean;
    hasConflict: boolean;
}
/**
 * UI component for editing keybindings.
 *
 * @example
 * ```tsx
 * <KeybindingEditor
 *   keymap={keymap}
 *   defaults={DEFAULT_KEYMAP}
 *   descriptions={{ save: 'Save document' }}
 *   onChange={(action, key) => setBinding(action, key)}
 *   onReset={() => reset()}
 * />
 * ```
 */
declare function KeybindingEditor({ keymap, defaults, descriptions, onChange, onReset, className, children, }: KeybindingEditorProps): react_jsx_runtime.JSX.Element;

interface ShortcutGroup {
    name: string;
    shortcuts: Array<{
        key: string;
        action: string;
        description?: string;
    }>;
}
interface ShortcutsModalProps {
    /** The hotkey map to display */
    keymap: HotkeyMap;
    /** Descriptions for actions (action name -> description) */
    descriptions?: Record<string, string>;
    /** Group definitions (if omitted, actions are grouped by prefix before ':') */
    groups?: Record<string, string>;
    /** Control visibility externally */
    isOpen?: boolean;
    /** Called when modal should close */
    onClose?: () => void;
    /** Hotkey to open modal (default: '?') */
    openKey?: string;
    /** Whether to auto-register the open hotkey (default: true) */
    autoRegisterOpen?: boolean;
    /** Custom render function for the modal content */
    children?: (props: {
        groups: ShortcutGroup[];
        close: () => void;
    }) => React.ReactNode;
    /** CSS class for the backdrop */
    backdropClassName?: string;
    /** CSS class for the modal container */
    modalClassName?: string;
}
/**
 * Modal component for displaying keyboard shortcuts.
 *
 * @example
 * ```tsx
 * <ShortcutsModal
 *   keymap={HOTKEYS}
 *   descriptions={{ 'metric:temp': 'Switch to temperature view' }}
 * />
 * ```
 */
declare function ShortcutsModal({ keymap, descriptions, groups: groupNames, isOpen: controlledIsOpen, onClose, openKey, autoRegisterOpen, children, backdropClassName, modalClassName, }: ShortcutsModalProps): react_jsx_runtime.JSX.Element | null;

interface KeyboardShortcutsContextValue {
    /** Default keymap (before user overrides) */
    defaults: HotkeyMap;
    /** Current keymap (defaults merged with user overrides) */
    keymap: HotkeyMap;
    /** Update a single keybinding */
    setBinding: (action: string, key: string) => void;
    /** Update multiple keybindings at once */
    setKeymap: (overrides: Partial<HotkeyMap>) => void;
    /** Reset all overrides to defaults */
    reset: () => void;
    /** User overrides only (for inspection/export) */
    overrides: Partial<HotkeyMap>;
    /** Map of key -> actions[] for keys with multiple actions bound */
    conflicts: Map<string, string[]>;
    /** Whether there are any conflicts in the current keymap */
    hasConflicts: boolean;
    /** When true, keys with multiple actions bound are disabled */
    disableConflicts: boolean;
}
interface KeyboardShortcutsProviderProps {
    /** Default hotkey map */
    defaults: HotkeyMap;
    /** localStorage key for persistence (omit to disable persistence) */
    storageKey?: string;
    /** When true, keys with multiple actions bound are disabled (default: true) */
    disableConflicts?: boolean;
    children: React$1.ReactNode;
}
/**
 * Provider for keyboard shortcuts context.
 * Manages the keymap, user overrides, persistence, and conflict detection.
 *
 * @example
 * ```tsx
 * <KeyboardShortcutsProvider
 *   defaults={{ 't': 'setTemp', 'c': 'setCO2' }}
 *   storageKey="app-hotkeys"
 * >
 *   <App />
 * </KeyboardShortcutsProvider>
 * ```
 */
declare function KeyboardShortcutsProvider({ defaults, storageKey, disableConflicts, children, }: KeyboardShortcutsProviderProps): react_jsx_runtime.JSX.Element;
/**
 * Hook to access the keyboard shortcuts context.
 * Must be used within a KeyboardShortcutsProvider.
 *
 * @example
 * ```tsx
 * const { keymap, setBinding, conflicts } = useKeyboardShortcutsContext()
 * ```
 */
declare function useKeyboardShortcutsContext(): KeyboardShortcutsContextValue;
/**
 * Hook to register hotkey handlers using the keymap from context.
 * Automatically excludes conflicting keys if disableConflicts is true.
 *
 * @example
 * ```tsx
 * useRegisteredHotkeys({
 *   setTemp: () => setMetric('temp'),
 *   setCO2: () => setMetric('co2'),
 * })
 * ```
 */
declare function useRegisteredHotkeys(handlers: HandlerMap, options?: Omit<UseHotkeysOptions, 'enabled'> & {
    enabled?: boolean;
}): void;

/**
 * Hook to record a keyboard shortcut from user input.
 *
 * When recording starts, captures the next key combination the user presses.
 * Recording completes when all keys are released after pressing a non-modifier key.
 *
 * @example
 * ```tsx
 * function KeybindingEditor() {
 *   const { isRecording, startRecording, combination, display, activeKeys } = useRecordHotkey({
 *     onCapture: (combo, display) => {
 *       console.log('Captured:', display.display)
 *       saveKeybinding(display.id)
 *     }
 *   })
 *
 *   return (
 *     <button onClick={() => startRecording()}>
 *       {isRecording
 *         ? (activeKeys ? formatCombination(activeKeys).display : 'Press keys...')
 *         : (display?.display ?? 'Click to set')}
 *     </button>
 *   )
 * }
 * ```
 */
declare function useRecordHotkey(options?: RecordHotkeyOptions): RecordHotkeyResult;

/**
 * Detect if running on macOS
 */
declare function isMac(): boolean;
/**
 * Normalize a key name to a canonical form
 */
declare function normalizeKey(key: string): string;
/**
 * Format a key for display (platform-aware)
 */
declare function formatKeyForDisplay(key: string): string;
/**
 * Convert a KeyCombination to display format
 */
declare function formatCombination(combo: KeyCombination): KeyCombinationDisplay;
/**
 * Check if a key is a modifier key
 */
declare function isModifierKey(key: string): boolean;
/**
 * Parse a combination ID back to a KeyCombination
 */
declare function parseCombinationId(id: string): KeyCombination;
/**
 * Conflict detection result
 */
interface KeyConflict {
    /** The key combination that has a conflict */
    key: string;
    /** Actions bound to this key */
    actions: string[];
}
/**
 * Find conflicts (multiple actions bound to same key) in a keymap
 * @param keymap - HotkeyMap to check for conflicts
 * @returns Map of key -> actions[] for keys with multiple actions
 */
declare function findConflicts(keymap: Record<string, string | string[]>): Map<string, string[]>;
/**
 * Check if a keymap has any conflicts
 */
declare function hasConflicts(keymap: Record<string, string | string[]>): boolean;
/**
 * Get conflicts as an array of KeyConflict objects
 */
declare function getConflictsArray(keymap: Record<string, string | string[]>): KeyConflict[];

export { type BindingInfo, type HandlerMap, type HotkeyMap, type KeyCombination, type KeyCombinationDisplay, type KeyConflict, KeybindingEditor, type KeybindingEditorProps, type KeybindingEditorRenderProps, type KeyboardShortcutsContextValue, KeyboardShortcutsProvider, type KeyboardShortcutsProviderProps, type RecordHotkeyOptions, type RecordHotkeyResult, type ShortcutGroup, ShortcutsModal, type ShortcutsModalProps, type UseEditableHotkeysOptions, type UseEditableHotkeysResult, type UseHotkeysOptions, findConflicts, formatCombination, formatKeyForDisplay, getConflictsArray, hasConflicts, isMac, isModifierKey, normalizeKey, parseCombinationId, useEditableHotkeys, useHotkeys, useKeyboardShortcutsContext, useRecordHotkey, useRegisteredHotkeys };
