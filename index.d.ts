import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import { ReactNode, RefObject, CSSProperties, ComponentType } from 'react';

/**
 * Represents a single key press (possibly with modifiers)
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
 * Represents a hotkey - either a single key or a sequence of keys.
 * Single key: [{ key: 'k', modifiers: {...} }]
 * Sequence: [{ key: '2', ... }, { key: 'w', ... }]
 */
type HotkeySequence = KeyCombination[];
/**
 * Platform-aware display format for a key combination or sequence
 */
interface KeyCombinationDisplay {
    /** Human-readable string (e.g., "⌘⇧K" on Mac, "Ctrl+Shift+K" elsewhere, "2 W" for sequence) */
    display: string;
    /** Canonical ID for storage/comparison (e.g., "ctrl+shift+k", "2 w" for sequence) */
    id: string;
    /** Whether this is a sequence (multiple keys pressed in order) */
    isSequence: boolean;
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
    /** Commit pending keys immediately (if any), otherwise cancel */
    commit: () => void;
    /** The captured sequence (null until complete) */
    sequence: HotkeySequence | null;
    /** Display strings for the sequence */
    display: KeyCombinationDisplay | null;
    /** Keys captured so far during recording (for live UI feedback) */
    pendingKeys: HotkeySequence;
    /** The key currently being held (for live UI feedback during recording) */
    activeKeys: KeyCombination | null;
    /**
     * @deprecated Use `sequence` instead
     */
    combination: KeyCombination | null;
}
/**
 * Options for useRecordHotkey
 */
interface RecordHotkeyOptions {
    /** Called when a sequence is captured (timeout or Enter) */
    onCapture?: (sequence: HotkeySequence, display: KeyCombinationDisplay) => void;
    /** Called when recording is cancelled */
    onCancel?: () => void;
    /** Called when Tab is pressed during recording (for advancing to next field) */
    onTab?: () => void;
    /** Called when Shift+Tab is pressed during recording (for going to previous field) */
    onShiftTab?: () => void;
    /** Prevent default on captured keys (default: true) */
    preventDefault?: boolean;
    /** Timeout in ms before sequence is submitted (default: 1000) */
    sequenceTimeout?: number;
    /** When true, pause the auto-submit timeout (useful for conflict warnings). Default: false */
    pauseTimeout?: boolean;
}
/**
 * Definition of an action that can be triggered by hotkeys or omnibar
 */
interface ActionDefinition {
    /** Display label for the action */
    label: string;
    /** Longer description (shown in omnibar, tooltips) */
    description?: string;
    /** Group for organizing in shortcuts modal (e.g., "Metrics", "Time Range") */
    group?: string;
    /** Additional search keywords */
    keywords?: string[];
    /** Icon identifier (user provides rendering) */
    icon?: string;
    /** Whether the action is currently enabled (default: true) */
    enabled?: boolean;
}
/**
 * Registry of all available actions
 */
type ActionRegistry = Record<string, ActionDefinition>;
/**
 * An action with its current keybinding(s) and search match info
 */
interface ActionSearchResult {
    /** Action ID */
    id: string;
    /** Action definition */
    action: ActionDefinition;
    /** Current keybindings for this action */
    bindings: string[];
    /** Fuzzy match score (higher = better match) */
    score: number;
    /** Matched ranges in label for highlighting */
    labelMatches: Array<[number, number]>;
}
/**
 * A possible completion for a partially-typed sequence
 */
interface SequenceCompletion {
    /** The next key(s) needed to complete this sequence */
    nextKeys: string;
    /** The full hotkey string */
    fullSequence: string;
    /** Display format for the full sequence */
    display: KeyCombinationDisplay;
    /** Actions triggered by this sequence */
    actions: string[];
}

/**
 * Hotkey definition - maps key combinations/sequences to action names
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
    /** Timeout in ms for sequences (default: 1000) */
    sequenceTimeout?: number;
    /** What happens on timeout: 'submit' executes current sequence, 'cancel' resets (default: 'submit') */
    onTimeout?: 'submit' | 'cancel';
    /** Called when sequence input starts */
    onSequenceStart?: (keys: HotkeySequence) => void;
    /** Called when sequence progresses (new key added) */
    onSequenceProgress?: (keys: HotkeySequence) => void;
    /** Called when sequence is cancelled (timeout with 'cancel' mode, or no match) */
    onSequenceCancel?: () => void;
}
interface UseHotkeysResult {
    /** Keys pressed so far in current sequence */
    pendingKeys: HotkeySequence;
    /** Whether currently awaiting more keys in a sequence */
    isAwaitingSequence: boolean;
    /** Cancel the current sequence */
    cancelSequence: () => void;
    /** When the current sequence timeout started (null if not awaiting) */
    timeoutStartedAt: number | null;
    /** The sequence timeout duration in ms */
    sequenceTimeout: number;
}
/**
 * Hook to register keyboard shortcuts with sequence support.
 *
 * @example
 * ```tsx
 * // Single keys
 * const { pendingKeys } = useHotkeys(
 *   { 't': 'setTemp', 'ctrl+s': 'save' },
 *   { setTemp: () => setMetric('temp'), save: handleSave }
 * )
 *
 * // Sequences
 * const { pendingKeys, isAwaitingSequence } = useHotkeys(
 *   { '2 w': 'twoWeeks', '2 d': 'twoDays' },
 *   { twoWeeks: () => setRange('2w'), twoDays: () => setRange('2d') },
 *   { sequenceTimeout: 1000 }
 * )
 * ```
 */
declare function useHotkeys(keymap: HotkeyMap, handlers: HandlerMap, options?: UseHotkeysOptions): UseHotkeysResult;

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
    /** Keys pressed so far in current sequence */
    pendingKeys: HotkeySequence;
    /** Whether currently awaiting more keys in a sequence */
    isAwaitingSequence: boolean;
    /** Cancel the current sequence */
    cancelSequence: () => void;
    /** When the current sequence timeout started (null if not awaiting) */
    timeoutStartedAt: number | null;
    /** The sequence timeout duration in ms */
    sequenceTimeout: number;
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

interface UseOmnibarOptions {
    /** Registry of available actions */
    actions: ActionRegistry;
    /** Handlers for actions (optional - if not provided, use onExecute callback) */
    handlers?: HandlerMap;
    /** Current keymap (to show bindings in results) */
    keymap?: HotkeyMap;
    /** Hotkey to open omnibar (default: 'meta+k') */
    openKey?: string;
    /** Whether omnibar hotkey is enabled (default: true) */
    enabled?: boolean;
    /** Called when an action is executed (if handlers not provided, or in addition to) */
    onExecute?: (actionId: string) => void;
    /** Called when omnibar opens */
    onOpen?: () => void;
    /** Called when omnibar closes */
    onClose?: () => void;
    /** Maximum number of results to show (default: 10) */
    maxResults?: number;
}
interface UseOmnibarResult {
    /** Whether omnibar is open */
    isOpen: boolean;
    /** Open the omnibar */
    open: () => void;
    /** Close the omnibar */
    close: () => void;
    /** Toggle the omnibar */
    toggle: () => void;
    /** Current search query */
    query: string;
    /** Set the search query */
    setQuery: (query: string) => void;
    /** Search results (filtered and sorted) */
    results: ActionSearchResult[];
    /** Currently selected result index */
    selectedIndex: number;
    /** Select the next result */
    selectNext: () => void;
    /** Select the previous result */
    selectPrev: () => void;
    /** Execute the selected action (or a specific action by ID) */
    execute: (actionId?: string) => void;
    /** Reset selection to first result */
    resetSelection: () => void;
    /** Sequence completions based on pending keys */
    completions: SequenceCompletion[];
    /** Keys pressed so far in current sequence (from useHotkeys) */
    pendingKeys: HotkeySequence;
    /** Whether currently awaiting more keys in a sequence */
    isAwaitingSequence: boolean;
}
/**
 * Hook for implementing an omnibar/command palette.
 *
 * @example
 * ```tsx
 * const ACTIONS: ActionRegistry = {
 *   'metric:temp': { label: 'Temperature', category: 'Metrics' },
 *   'metric:co2': { label: 'CO₂', category: 'Metrics' },
 *   'save': { label: 'Save', description: 'Save current settings' },
 * }
 *
 * function App() {
 *   const {
 *     isOpen, open, close,
 *     query, setQuery,
 *     results,
 *     selectedIndex, selectNext, selectPrev,
 *     execute,
 *   } = useOmnibar({
 *     actions: ACTIONS,
 *     handlers: HANDLERS,
 *     keymap: KEYMAP,
 *   })
 *
 *   return (
 *     <>
 *       {isOpen && (
 *         <div className="omnibar">
 *           <input
 *             value={query}
 *             onChange={e => setQuery(e.target.value)}
 *             onKeyDown={e => {
 *               if (e.key === 'ArrowDown') selectNext()
 *               if (e.key === 'ArrowUp') selectPrev()
 *               if (e.key === 'Enter') execute()
 *               if (e.key === 'Escape') close()
 *             }}
 *           />
 *           {results.map((result, i) => (
 *             <div
 *               key={result.id}
 *               className={i === selectedIndex ? 'selected' : ''}
 *               onClick={() => execute(result.id)}
 *             >
 *               {result.action.label}
 *               {result.bindings.length > 0 && (
 *                 <kbd>{result.bindings[0]}</kbd>
 *               )}
 *             </div>
 *           ))}
 *         </div>
 *       )}
 *     </>
 *   )
 * }
 * ```
 */
declare function useOmnibar(options: UseOmnibarOptions): UseOmnibarResult;

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
    children?: (props: KeybindingEditorRenderProps) => ReactNode;
}
interface KeybindingEditorRenderProps {
    bindings: BindingInfo[];
    editingAction: string | null;
    /** Keys already pressed and released (waiting for timeout or more keys) */
    pendingKeys: HotkeySequence;
    /** Keys currently being held down */
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
        actionId: string;
        label: string;
        description?: string;
        bindings: string[];
    }>;
}
interface ShortcutsModalProps {
    /**
     * The hotkey map to display.
     * If not provided, uses keymap from HotkeysContext.
     */
    keymap?: HotkeyMap;
    /**
     * Default keymap (for showing reset indicators).
     * If not provided, uses defaults from HotkeysContext.
     */
    defaults?: HotkeyMap;
    /** Labels for actions (action ID -> label). Falls back to action.label from context. */
    labels?: Record<string, string>;
    /** Descriptions for actions (action ID -> description). Falls back to action.description from context. */
    descriptions?: Record<string, string>;
    /** Group definitions: action prefix -> display name (e.g., { metric: 'Metrics' }). Falls back to action.group from context. */
    groups?: Record<string, string>;
    /** Ordered list of group names (if omitted, groups are sorted alphabetically) */
    groupOrder?: string[];
    /**
     * Control visibility externally.
     * If not provided, uses isModalOpen from HotkeysContext.
     */
    isOpen?: boolean;
    /**
     * Called when modal should close.
     * If not provided, uses closeModal from HotkeysContext.
     */
    onClose?: () => void;
    /** Hotkey to open modal (default: '?'). Set to empty string to disable. */
    openKey?: string;
    /**
     * Whether to auto-register the open hotkey (default: true).
     * When using HotkeysContext, the provider already handles this, so set to false.
     */
    autoRegisterOpen?: boolean;
    /** Enable editing mode */
    editable?: boolean;
    /** Called when a binding changes (required if editable) */
    onBindingChange?: (action: string, oldKey: string | null, newKey: string) => void;
    /** Called when a binding is added (required if editable) */
    onBindingAdd?: (action: string, key: string) => void;
    /** Called when a binding is removed */
    onBindingRemove?: (action: string, key: string) => void;
    /** Called when reset is requested */
    onReset?: () => void;
    /** Whether to allow multiple bindings per action (default: true) */
    multipleBindings?: boolean;
    /** Custom render function for the modal content */
    children?: (props: ShortcutsModalRenderProps) => ReactNode;
    /** CSS class for the backdrop */
    backdropClassName?: string;
    /** CSS class for the modal container */
    modalClassName?: string;
}
interface ShortcutsModalRenderProps {
    groups: ShortcutGroup[];
    close: () => void;
    editable: boolean;
    editingAction: string | null;
    editingBindingIndex: number | null;
    pendingKeys: HotkeySequence;
    activeKeys: KeyCombination | null;
    conflicts: Map<string, string[]>;
    startEditing: (action: string, bindingIndex?: number) => void;
    cancelEditing: () => void;
    removeBinding: (action: string, key: string) => void;
    reset: () => void;
}
/**
 * Modal component for displaying and optionally editing keyboard shortcuts.
 *
 * Uses CSS classes from styles.css. Override via CSS custom properties:
 * --hotkeys-bg, --hotkeys-text, --hotkeys-kbd-bg, etc.
 *
 * @example
 * ```tsx
 * // Read-only display
 * <ShortcutsModal
 *   keymap={HOTKEYS}
 *   labels={{ 'metric:temp': 'Temperature' }}
 * />
 *
 * // Editable with callbacks
 * <ShortcutsModal
 *   keymap={keymap}
 *   defaults={DEFAULT_KEYMAP}
 *   labels={labels}
 *   editable
 *   onBindingChange={(action, oldKey, newKey) => updateBinding(action, newKey)}
 *   onBindingRemove={(action, key) => removeBinding(action, key)}
 * />
 * ```
 */
declare function ShortcutsModal({ keymap: keymapProp, defaults: defaultsProp, labels: labelsProp, descriptions: descriptionsProp, groups: groupNamesProp, groupOrder, isOpen: isOpenProp, onClose: onCloseProp, openKey, autoRegisterOpen, editable, onBindingChange, onBindingAdd, onBindingRemove, onReset, multipleBindings, children, backdropClassName, modalClassName, }: ShortcutsModalProps): react_jsx_runtime.JSX.Element | null;

interface OmnibarProps {
    /**
     * Registry of available actions.
     * If not provided, uses actions from HotkeysContext.
     */
    actions?: ActionRegistry;
    /**
     * Handlers for actions.
     * If not provided, uses handlers from HotkeysContext, falling back to executeAction.
     */
    handlers?: HandlerMap;
    /**
     * Current keymap (to show bindings in results).
     * If not provided, uses keymap from HotkeysContext.
     */
    keymap?: HotkeyMap;
    /** Hotkey to open omnibar (default: 'meta+k'). Set to empty string to disable. */
    openKey?: string;
    /**
     * Whether omnibar hotkey is enabled.
     * When using HotkeysContext, defaults to false (provider handles it).
     */
    enabled?: boolean;
    /**
     * Control visibility externally.
     * If not provided, uses isOmnibarOpen from HotkeysContext.
     */
    isOpen?: boolean;
    /** Called when omnibar opens */
    onOpen?: () => void;
    /**
     * Called when omnibar closes.
     * If not provided, uses closeOmnibar from HotkeysContext.
     */
    onClose?: () => void;
    /**
     * Called when an action is executed.
     * If not provided, uses executeAction from HotkeysContext.
     */
    onExecute?: (actionId: string) => void;
    /** Maximum number of results to show (default: 10) */
    maxResults?: number;
    /** Placeholder text for input (default: 'Type a command...') */
    placeholder?: string;
    /** Custom render function */
    children?: (props: OmnibarRenderProps) => ReactNode;
    /** CSS class for the backdrop */
    backdropClassName?: string;
    /** CSS class for the omnibar container */
    omnibarClassName?: string;
}
interface OmnibarRenderProps {
    query: string;
    setQuery: (query: string) => void;
    results: ActionSearchResult[];
    selectedIndex: number;
    selectNext: () => void;
    selectPrev: () => void;
    execute: (actionId?: string) => void;
    close: () => void;
    completions: SequenceCompletion[];
    pendingKeys: HotkeySequence;
    isAwaitingSequence: boolean;
    inputRef: RefObject<HTMLInputElement | null>;
}
/**
 * Omnibar/command palette component for searching and executing actions.
 *
 * Uses CSS classes from styles.css. Override via CSS custom properties:
 * --hotkeys-bg, --hotkeys-text, --hotkeys-accent, etc.
 *
 * @example
 * ```tsx
 * <Omnibar
 *   actions={ACTIONS}
 *   handlers={HANDLERS}
 *   keymap={KEYMAP}
 *   onExecute={(id) => console.log('Executed:', id)}
 * />
 * ```
 */
declare function Omnibar({ actions: actionsProp, handlers: handlersProp, keymap: keymapProp, openKey, enabled: enabledProp, isOpen: isOpenProp, onOpen: onOpenProp, onClose: onCloseProp, onExecute: onExecuteProp, maxResults, placeholder, children, backdropClassName, omnibarClassName, }: OmnibarProps): react_jsx_runtime.JSX.Element | null;

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
 * Convert a KeyCombination or HotkeySequence to display format
 */
declare function formatCombination(combo: KeyCombination): KeyCombinationDisplay;
declare function formatCombination(sequence: HotkeySequence): KeyCombinationDisplay;
/**
 * Check if a key is a modifier key
 */
declare function isModifierKey(key: string): boolean;
/**
 * Check if a hotkey string represents a sequence (space-separated keys)
 */
declare function isSequence(hotkeyStr: string): boolean;
/**
 * Parse a hotkey string to a HotkeySequence.
 * Handles both single keys ("ctrl+k") and sequences ("2 w", "ctrl+k ctrl+c")
 */
declare function parseHotkeyString(hotkeyStr: string): HotkeySequence;
/**
 * Parse a combination ID back to a KeyCombination (single key only)
 * @deprecated Use parseHotkeyString for sequence support
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
    /** Type of conflict */
    type: 'duplicate' | 'prefix';
}
/**
 * Find conflicts in a keymap.
 * Detects:
 * - Duplicate: multiple actions bound to the exact same key/sequence
 * - Prefix: one hotkey is a prefix of another (e.g., "2" and "2 w")
 *
 * @param keymap - HotkeyMap to check for conflicts
 * @returns Map of key -> actions[] for keys with conflicts
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

/**
 * Get possible completions for a partially-typed sequence.
 *
 * @example
 * ```tsx
 * const keymap = { '2 w': 'twoWeeks', '2 d': 'twoDays', 't': 'temp' }
 * const pending = parseHotkeyString('2')
 * const completions = getSequenceCompletions(pending, keymap)
 * // Returns:
 * // [
 * //   { nextKeys: 'w', fullSequence: '2 w', actions: ['twoWeeks'], ... },
 * //   { nextKeys: 'd', fullSequence: '2 d', actions: ['twoDays'], ... },
 * // ]
 * ```
 */
declare function getSequenceCompletions(pendingKeys: HotkeySequence, keymap: Record<string, string | string[]>): SequenceCompletion[];
/**
 * Build a map of action -> keys[] from a keymap
 */
declare function getActionBindings(keymap: Record<string, string | string[]>): Map<string, string[]>;
/**
 * Fuzzy match result
 */
interface FuzzyMatchResult {
    /** Whether the pattern matched */
    matched: boolean;
    /** Match score (higher = better) */
    score: number;
    /** Matched character ranges for highlighting [start, end] */
    ranges: Array<[number, number]>;
}
/**
 * Perform fuzzy matching of a pattern against text.
 * Returns match info including score and ranges for highlighting.
 *
 * Scoring:
 * - Consecutive matches score higher
 * - Matches at word boundaries score higher
 * - Earlier matches score higher
 */
declare function fuzzyMatch(pattern: string, text: string): FuzzyMatchResult;
/**
 * Search actions by query with fuzzy matching.
 *
 * @example
 * ```tsx
 * const results = searchActions('temp', actions, keymap)
 * // Returns ActionSearchResult[] sorted by relevance
 * ```
 */
declare function searchActions(query: string, actions: ActionRegistry, keymap?: Record<string, string | string[]>): ActionSearchResult[];

interface ActionConfig {
    /** Human-readable label for omnibar/modal */
    label: string;
    /** Group name for organizing in modal */
    group?: string;
    /** Default key bindings (user can override) */
    defaultBindings?: string[];
    /** Search keywords for omnibar */
    keywords?: string[];
    /** The action handler */
    handler: () => void;
    /** Whether action is currently enabled (default: true) */
    enabled?: boolean;
    /** Priority for conflict resolution (higher wins, default: 0) */
    priority?: number;
}
/**
 * Register an action with the hotkeys system.
 *
 * Actions are automatically unregistered when the component unmounts,
 * making this ideal for colocating actions with their handlers.
 *
 * @example
 * ```tsx
 * function DataTable() {
 *   const { prevPage, nextPage } = usePagination()
 *
 *   useAction('table:prev-page', {
 *     label: 'Previous page',
 *     group: 'Table Navigation',
 *     defaultBindings: [','],
 *     handler: prevPage,
 *   })
 *
 *   useAction('table:next-page', {
 *     label: 'Next page',
 *     group: 'Table Navigation',
 *     defaultBindings: ['.'],
 *     handler: nextPage,
 *   })
 * }
 * ```
 */
declare function useAction(id: string, config: ActionConfig): void;
/**
 * Register multiple actions at once.
 * Useful when you have several related actions in one component.
 *
 * @example
 * ```tsx
 * useActions({
 *   'left:temp': { label: 'Temperature', defaultBindings: ['t'], handler: () => setMetric('temp') },
 *   'left:co2': { label: 'CO₂', defaultBindings: ['c'], handler: () => setMetric('co2') },
 * })
 * ```
 */
declare function useActions(actions: Record<string, ActionConfig>): void;

interface RegisteredAction {
    config: ActionConfig;
    registeredAt: number;
}
interface ActionsRegistryValue {
    /** Register an action. Called by useAction on mount. */
    register: (id: string, config: ActionConfig) => void;
    /** Unregister an action. Called by useAction on unmount. */
    unregister: (id: string) => void;
    /** Execute an action by ID */
    execute: (id: string) => void;
    /** Currently registered actions */
    actions: Map<string, RegisteredAction>;
    /** Computed keymap from registered actions + user overrides */
    keymap: HotkeyMap;
    /** Action registry for omnibar search */
    actionRegistry: ActionRegistry;
    /** Get all bindings for an action (defaults + overrides) */
    getBindingsForAction: (id: string) => string[];
    /** User's binding overrides */
    overrides: Record<string, string | string[]>;
    /** Set a user override for a binding */
    setBinding: (actionId: string, key: string) => void;
    /** Remove a binding */
    removeBinding: (key: string) => void;
    /** Reset all overrides */
    resetOverrides: () => void;
}
declare const ActionsRegistryContext: react.Context<ActionsRegistryValue | null>;
interface UseActionsRegistryOptions {
    /** localStorage key for persisting user overrides */
    storageKey?: string;
}
/**
 * Hook to create an actions registry.
 * Used internally by HotkeysProvider.
 */
declare function useActionsRegistry(options?: UseActionsRegistryOptions): ActionsRegistryValue;

/**
 * Configuration for the HotkeysProvider.
 */
interface HotkeysConfig {
    /** Storage key for persisting user binding overrides */
    storageKey?: string;
    /** Timeout in ms before a sequence auto-submits (default: 1000) */
    sequenceTimeout?: number;
    /** When true, keys with conflicts are disabled (default: true) */
    disableConflicts?: boolean;
    /** Minimum viewport width to enable hotkeys (false = always enabled) */
    minViewportWidth?: number | false;
    /** Whether to show hotkey UI on touch-only devices (default: false) */
    enableOnTouch?: boolean;
    /** Key sequence to open shortcuts modal (false to disable) */
    modalTrigger?: string | false;
    /** Key sequence to open omnibar (false to disable) */
    omnibarTrigger?: string | false;
}
/**
 * Context value for hotkeys.
 */
interface HotkeysContextValue {
    /** The actions registry */
    registry: ActionsRegistryValue;
    /** Whether hotkeys are enabled (based on viewport/touch) */
    isEnabled: boolean;
    /** Modal open state */
    isModalOpen: boolean;
    /** Open the shortcuts modal */
    openModal: () => void;
    /** Close the shortcuts modal */
    closeModal: () => void;
    /** Toggle the shortcuts modal */
    toggleModal: () => void;
    /** Omnibar open state */
    isOmnibarOpen: boolean;
    /** Open the omnibar */
    openOmnibar: () => void;
    /** Close the omnibar */
    closeOmnibar: () => void;
    /** Toggle the omnibar */
    toggleOmnibar: () => void;
    /** Execute an action by ID */
    executeAction: (id: string) => void;
    /** Sequence state: pending key combinations */
    pendingKeys: HotkeySequence;
    /** Sequence state: whether waiting for more keys */
    isAwaitingSequence: boolean;
    /** Sequence state: when the timeout started */
    sequenceTimeoutStartedAt: number | null;
    /** Sequence state: timeout duration in ms */
    sequenceTimeout: number;
    /** Map of key -> actions[] for keys with multiple actions bound */
    conflicts: Map<string, string[]>;
    /** Whether there are any conflicts */
    hasConflicts: boolean;
    /** Search actions by query */
    searchActions: (query: string) => ReturnType<typeof searchActions>;
    /** Get sequence completions for pending keys */
    getCompletions: (pendingKeys: HotkeySequence) => ReturnType<typeof getSequenceCompletions>;
}
interface HotkeysProviderProps {
    config?: HotkeysConfig;
    children: ReactNode;
}
/**
 * Provider for hotkey registration via useAction.
 *
 * Components register their own actions using the useAction hook.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <HotkeysProvider config={{ storageKey: 'my-app' }}>
 *       <Dashboard />
 *       <ShortcutsModal />
 *       <Omnibar />
 *       <SequenceModal />
 *     </HotkeysProvider>
 *   )
 * }
 *
 * function Dashboard() {
 *   const { save } = useDocument()
 *
 *   useAction('doc:save', {
 *     label: 'Save document',
 *     group: 'Document',
 *     defaultBindings: ['meta+s'],
 *     handler: save,
 *   })
 *
 *   return <Editor />
 * }
 * ```
 */
declare function HotkeysProvider({ config: configProp, children, }: HotkeysProviderProps): react_jsx_runtime.JSX.Element;
/**
 * Hook to access the hotkeys context.
 * Must be used within a HotkeysProvider.
 */
declare function useHotkeysContext(): HotkeysContextValue;
/**
 * Hook to optionally access hotkeys context.
 */
declare function useMaybeHotkeysContext(): HotkeysContextValue | null;

/**
 * Hook to record a keyboard shortcut (single key or sequence) from user input.
 *
 * Recording behavior:
 * - Each key press (after modifiers released) adds to the sequence
 * - Enter key submits the current sequence
 * - Timeout submits the current sequence (configurable)
 * - Escape cancels recording
 *
 * @example
 * ```tsx
 * function KeybindingEditor() {
 *   const { isRecording, startRecording, sequence, display, pendingKeys, activeKeys } = useRecordHotkey({
 *     onCapture: (sequence, display) => {
 *       console.log('Captured:', display.display) // "2 W" or "⌘K"
 *       saveKeybinding(display.id) // "2 w" or "meta+k"
 *     },
 *     sequenceTimeout: 1000,
 *   })
 *
 *   return (
 *     <button onClick={() => startRecording()}>
 *       {isRecording
 *         ? (pendingKeys.length > 0
 *             ? formatCombination(pendingKeys).display + '...'
 *             : 'Press keys...')
 *         : (display?.display ?? 'Click to set')}
 *     </button>
 *   )
 * }
 * ```
 */
declare function useRecordHotkey(options?: RecordHotkeyOptions): RecordHotkeyResult;

declare function SequenceModal(): react_jsx_runtime.JSX.Element | null;

interface ModifierIconProps {
    className?: string;
    style?: CSSProperties;
}
/** Command/Meta key icon (⌘) */
declare function CommandIcon({ className, style }: ModifierIconProps): react_jsx_runtime.JSX.Element;
/** Control key icon (^) - chevron/caret */
declare function CtrlIcon({ className, style }: ModifierIconProps): react_jsx_runtime.JSX.Element;
/** Shift key icon (⇧) - hollow arrow */
declare function ShiftIcon({ className, style }: ModifierIconProps): react_jsx_runtime.JSX.Element;
/** Option key icon (⌥) - macOS style */
declare function OptIcon({ className, style }: ModifierIconProps): react_jsx_runtime.JSX.Element;
/** Alt key icon (⎇) - Windows style, though "Alt" text is more common on Windows */
declare function AltIcon({ className, style }: ModifierIconProps): react_jsx_runtime.JSX.Element;
type ModifierType = 'meta' | 'ctrl' | 'shift' | 'alt' | 'opt';
/** Get the appropriate icon component for a modifier key */
declare function getModifierIcon(modifier: ModifierType): ComponentType<ModifierIconProps>;
/** Render a modifier icon by name */
declare function ModifierIcon({ modifier, ...props }: ModifierIconProps & {
    modifier: ModifierType;
}): react_jsx_runtime.JSX.Element;

export { type ActionConfig, type ActionDefinition, type ActionRegistry, type ActionSearchResult, ActionsRegistryContext, type ActionsRegistryValue, AltIcon, type BindingInfo, CommandIcon, CtrlIcon, type FuzzyMatchResult, type HandlerMap, type HotkeyMap, type HotkeySequence, type HotkeysConfig, type HotkeysContextValue, HotkeysProvider, type HotkeysProviderProps, type KeyCombination, type KeyCombinationDisplay, type KeyConflict, KeybindingEditor, type KeybindingEditorProps, type KeybindingEditorRenderProps, ModifierIcon, type ModifierIconProps, type ModifierType, Omnibar, type OmnibarProps, type OmnibarRenderProps, OptIcon, type RecordHotkeyOptions, type RecordHotkeyResult, type RegisteredAction, type SequenceCompletion, SequenceModal, ShiftIcon, type ShortcutGroup, ShortcutsModal, type ShortcutsModalProps, type ShortcutsModalRenderProps, type UseEditableHotkeysOptions, type UseEditableHotkeysResult, type UseHotkeysOptions, type UseHotkeysResult, type UseOmnibarOptions, type UseOmnibarResult, findConflicts, formatCombination, formatKeyForDisplay, fuzzyMatch, getActionBindings, getConflictsArray, getModifierIcon, getSequenceCompletions, hasConflicts, isMac, isModifierKey, isSequence, normalizeKey, parseCombinationId, parseHotkeyString, searchActions, useAction, useActions, useActionsRegistry, useEditableHotkeys, useHotkeys, useHotkeysContext, useMaybeHotkeysContext, useOmnibar, useRecordHotkey };
