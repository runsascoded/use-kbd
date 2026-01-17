import * as react from 'react';
import { ReactNode, ComponentType, RefObject, SVGProps, CSSProperties } from 'react';
import * as react_jsx_runtime from 'react/jsx-runtime';

/**
 * Modifier keys state
 */
interface Modifiers {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
}
/**
 * Represents a single key press (possibly with modifiers)
 */
interface KeyCombination {
    /** The main key (lowercase, e.g., 'k', 'enter', 'arrowup') */
    key: string;
    /** Modifier keys pressed */
    modifiers: Modifiers;
}
/**
 * Represents a hotkey - either a single key or a sequence of keys.
 * Single key: [{ key: 'k', modifiers: {...} }]
 * Sequence: [{ key: '2', ... }, { key: 'w', ... }]
 */
type HotkeySequence = KeyCombination[];
/**
 * A single element in a key sequence (sum type).
 * - 'key': exact key match (with optional modifiers)
 * - 'digit': matches any single digit 0-9 (\d)
 * - 'digits': matches one or more digits (\d+)
 */
type SeqElem = {
    type: 'key';
    key: string;
    modifiers: Modifiers;
} | {
    type: 'digit';
} | {
    type: 'digits';
};
/**
 * A key sequence pattern (array of sequence elements)
 */
type KeySeq = SeqElem[];
/**
 * Sequence element with match state (for tracking during input).
 * - 'key': has `matched` flag
 * - 'digit': has captured `value`
 * - 'digits': has captured `value` or in-progress `partial` string
 */
type SeqElemState = {
    type: 'key';
    key: string;
    modifiers: Modifiers;
    matched?: true;
} | {
    type: 'digit';
    value?: number;
} | {
    type: 'digits';
    value?: number;
    partial?: string;
};
/**
 * Sequence match state - tracks progress through a sequence with captures
 */
type SeqMatchState = SeqElemState[];
/**
 * Extract captured values from a completed sequence match
 */
declare function extractCaptures(state: SeqMatchState): number[];
/**
 * Check if a SeqElem is a digit placeholder
 */
declare function isDigitPlaceholder(elem: SeqElem): elem is {
    type: 'digit';
} | {
    type: 'digits';
};
/**
 * Count digit placeholders in a sequence
 */
declare function countPlaceholders(seq: KeySeq): number;
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
    /** The timeout duration for sequences (ms) */
    sequenceTimeout: number;
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
    /** Timeout in ms before sequence is submitted (default: Infinity, no timeout).
     * Set to 0 for immediate submit (no sequences - first key press is captured).
     * Set to a finite number for auto-submit after that duration. */
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
    /** Hide from ShortcutsModal (still searchable in omnibar) */
    hideFromModal?: boolean;
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
    /** The next key(s) needed to complete this sequence (empty string if complete) */
    nextKeys: string;
    /** Structured next keys for rendering with icons (undefined if complete) */
    nextKeySeq?: KeySeq;
    /** The full hotkey string */
    fullSequence: string;
    /** Display format for the full sequence */
    display: KeyCombinationDisplay;
    /** Actions triggered by this sequence */
    actions: string[];
    /** Whether the sequence is already complete (can be executed now with Enter) */
    isComplete: boolean;
    /** Captured digit values from \d and \d+ placeholders */
    captures?: number[];
}
/**
 * Base fields for all omnibar entries
 */
interface OmnibarEntryBase {
    /** Unique identifier for this entry */
    id: string;
    /** Display label */
    label: string;
    /** Optional description (shown below label) */
    description?: string;
    /** Group name for organizing results */
    group?: string;
    /** Additional search keywords */
    keywords?: string[];
}
/**
 * Omnibar entry that navigates to a URL when selected
 */
interface OmnibarLinkEntry extends OmnibarEntryBase {
    /** URL to navigate to */
    href: string;
    handler?: never;
}
/**
 * Omnibar entry that executes a handler when selected
 */
interface OmnibarActionEntry extends OmnibarEntryBase {
    /** Handler to execute (can close over data) */
    handler: () => void;
    href?: never;
}
/**
 * An entry returned from a remote omnibar endpoint.
 * Must have either `href` (for navigation) or `handler` (for custom action).
 */
type OmnibarEntry = OmnibarLinkEntry | OmnibarActionEntry;
/**
 * Pagination parameters passed to endpoint fetch function
 */
interface EndpointPagination {
    /** Starting offset (0-indexed) */
    offset: number;
    /** Maximum number of entries to return */
    limit: number;
}
/**
 * Response from an endpoint fetch, including pagination metadata
 */
interface EndpointResponse {
    /** Entries for this page */
    entries: OmnibarEntry[];
    /** Total count if known (enables "X of Y" display) */
    total?: number;
    /** Whether more results exist (fallback when total is expensive to compute) */
    hasMore?: boolean;
}
/**
 * Pagination mode for an endpoint
 * - 'scroll': Fetch more when scrolling near bottom (IntersectionObserver)
 * - 'buttons': Show pagination controls at bottom of endpoint's group
 * - 'none': Single page, no pagination (default)
 */
type EndpointPaginationMode = 'scroll' | 'buttons' | 'none';
/**
 * Base configuration shared by async and sync endpoints
 */
interface OmnibarEndpointConfigBase {
    /** Default group for entries from this endpoint */
    group?: string;
    /** Priority for result ordering (higher = shown first, default: 0, local actions: 100) */
    priority?: number;
    /** Minimum query length before fetching (default: 2) */
    minQueryLength?: number;
    /** Whether this endpoint is enabled (default: true) */
    enabled?: boolean;
    /** Number of results per page (default: 10) */
    pageSize?: number;
    /** Pagination mode (default: 'none') */
    pagination?: EndpointPaginationMode;
}
/**
 * Configuration for an async omnibar endpoint (remote API calls)
 */
interface OmnibarEndpointAsyncConfig extends OmnibarEndpointConfigBase {
    /** Async fetch function for remote data sources */
    fetch: (query: string, signal: AbortSignal, pagination: EndpointPagination) => Promise<EndpointResponse>;
    filter?: never;
    /** Internal: true if this was originally a sync endpoint (skip debouncing) */
    isSync?: boolean;
}
/**
 * Configuration for a sync omnibar endpoint (in-memory filtering)
 *
 * Sync endpoints skip debouncing for instant results.
 */
interface OmnibarEndpointSyncConfig extends OmnibarEndpointConfigBase {
    /** Sync filter function for in-memory data sources */
    filter: (query: string, pagination: EndpointPagination) => EndpointResponse;
    fetch?: never;
}
/**
 * Configuration for an omnibar endpoint (async or sync)
 */
type OmnibarEndpointConfig = OmnibarEndpointAsyncConfig | OmnibarEndpointSyncConfig;

/**
 * Hotkey definition - maps key combinations/sequences to action names
 */
type HotkeyMap = Record<string, string | string[]>;
/**
 * Handler function type - can optionally receive captured values
 */
type HotkeyHandler = (e: KeyboardEvent, captures?: number[]) => void;
/**
 * Handler map - maps action names to handler functions
 */
type HandlerMap = Record<string, HotkeyHandler>;
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
    /** Timeout in ms for sequences (default: Infinity, no timeout) */
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
 *   { twoWeeks: () => setRange('2w'), twoDays: () => setRange('2d') }
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

interface RegisteredEndpoint {
    id: string;
    /** Internal config is always async (useOmnibarEndpoint normalizes sync endpoints) */
    config: OmnibarEndpointAsyncConfig;
    registeredAt: number;
}
/**
 * Result from querying an endpoint
 */
interface EndpointQueryResult {
    endpointId: string;
    entries: OmnibarEntry[];
    /** Total count from endpoint (if provided) */
    total?: number;
    /** Whether endpoint has more results (if provided) */
    hasMore?: boolean;
    error?: Error;
}
interface OmnibarEndpointsRegistryValue {
    /** Register an endpoint. Called by useOmnibarEndpoint on mount. */
    register: (id: string, config: OmnibarEndpointAsyncConfig) => void;
    /** Unregister an endpoint. Called by useOmnibarEndpoint on unmount. */
    unregister: (id: string) => void;
    /** Currently registered endpoints */
    endpoints: Map<string, RegisteredEndpoint>;
    /** Query all registered endpoints (initial page) */
    queryAll: (query: string, signal: AbortSignal) => Promise<EndpointQueryResult[]>;
    /** Query a single endpoint with specific pagination (for load-more) */
    queryEndpoint: (endpointId: string, query: string, pagination: EndpointPagination, signal: AbortSignal) => Promise<EndpointQueryResult | null>;
}
declare const OmnibarEndpointsRegistryContext: react.Context<OmnibarEndpointsRegistryValue | null>;
/**
 * Hook to create an omnibar endpoints registry.
 * Used internally by HotkeysProvider.
 */
declare function useOmnibarEndpointsRegistry(): OmnibarEndpointsRegistryValue;

/**
 * Result from remote endpoint, normalized for display
 */
interface RemoteOmnibarResult {
    /** Unique ID (prefixed with endpoint ID) */
    id: string;
    /** Entry data from endpoint */
    entry: OmnibarEntry;
    /** Endpoint ID this came from */
    endpointId: string;
    /** Priority from endpoint config */
    priority: number;
    /** Fuzzy match score */
    score: number;
    /** Matched ranges in label for highlighting */
    labelMatches: Array<[number, number]>;
}
/**
 * Pagination info for an endpoint's results group
 */
interface EndpointPaginationInfo {
    endpointId: string;
    loaded: number;
    total?: number;
    hasMore: boolean;
    isLoading: boolean;
    mode: EndpointPaginationMode;
}
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
    /** Called when a remote entry is executed */
    onExecuteRemote?: (entry: OmnibarEntry) => void;
    /** Called when omnibar opens */
    onOpen?: () => void;
    /** Called when omnibar closes */
    onClose?: () => void;
    /** Maximum number of results to show (default: 10) */
    maxResults?: number;
    /** Remote endpoints registry (optional - enables remote search) */
    endpointsRegistry?: OmnibarEndpointsRegistryValue;
    /** Debounce time for remote queries in ms (default: 150) */
    debounceMs?: number;
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
    /** Local action search results (filtered and sorted) */
    results: ActionSearchResult[];
    /** Remote endpoint results */
    remoteResults: RemoteOmnibarResult[];
    /** Whether any remote endpoint is loading (initial or more) */
    isLoadingRemote: boolean;
    /** Pagination info per endpoint */
    endpointPagination: Map<string, EndpointPaginationInfo>;
    /** Load more results for a specific endpoint */
    loadMore: (endpointId: string) => void;
    /** Currently selected result index (across local + remote) */
    selectedIndex: number;
    /** Total number of results (local + remote) */
    totalResults: number;
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

/**
 * Props for a tooltip wrapper component.
 * Compatible with MUI Tooltip and similar libraries.
 */
interface TooltipProps {
    title: string;
    children: ReactNode;
}
/**
 * A component that wraps children with a tooltip.
 * Default uses native title attribute; can be replaced with MUI Tooltip etc.
 */
type TooltipComponent = ComponentType<TooltipProps>;
interface ShortcutGroup {
    name: string;
    shortcuts: Array<{
        actionId: string;
        label: string;
        description?: string;
        bindings: string[];
    }>;
}
/**
 * Props passed to custom group renderers
 */
interface GroupRendererProps {
    /** The group being rendered */
    group: ShortcutGroup;
    /** Render a cell for an action (handles editing state, kbd styling) */
    renderCell: (actionId: string, keys: string[]) => ReactNode;
    /** Render a single editable kbd element */
    renderEditableKbd: (actionId: string, key: string, showRemove?: boolean) => ReactNode;
    /** Render the add button for an action */
    renderAddButton: (actionId: string) => ReactNode;
    /** Start editing a specific binding */
    startEditing: (actionId: string, key: string) => void;
    /** Start adding a new binding to an action */
    startAdding: (actionId: string) => void;
    /** Remove a binding */
    removeBinding: (actionId: string, key: string) => void;
    /** Whether currently recording a hotkey */
    isRecording: boolean;
    /** Action currently being edited */
    editingAction: string | null;
    /** Key currently being edited */
    editingKey: string | null;
    /** Action currently being added to */
    addingAction: string | null;
}
/**
 * Custom renderer for a group. Return null to use default rendering.
 */
type GroupRenderer = (props: GroupRendererProps) => ReactNode;
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
     * Custom renderers for specific groups.
     * Key is the group name, value is a render function.
     * Groups without custom renderers use the default single-column layout.
     */
    groupRenderers?: Record<string, GroupRenderer>;
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
    /**
     * Default keybinding to open shortcuts modal (default: '?').
     * Users can override this in the shortcuts modal.
     * Set to empty string to disable.
     */
    defaultBinding?: string;
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
    /** Modal title (default: "Keyboard Shortcuts") */
    title?: string;
    /** Hint text shown below title (e.g., "Click any key to customize") */
    hint?: string;
    /** Whether to show actions with no bindings (default: true in editable mode, false otherwise) */
    showUnbound?: boolean;
    /**
     * Custom tooltip component for digit placeholders.
     * Should accept { title: string, children: ReactNode } props.
     * Default uses native title attribute. Can be MUI Tooltip, etc.
     */
    TooltipComponent?: TooltipComponent;
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
 * Modal for displaying all keyboard shortcuts, organized by group.
 *
 * Opens by default with `?` key. Shows all registered actions and their bindings,
 * grouped by category (e.g., "Navigation", "Edit", "Global").
 *
 * Features:
 * - **Editable bindings**: Click any shortcut to rebind it (when `editable` is true)
 * - **Conflict detection**: Warns when a binding conflicts with existing shortcuts
 * - **Custom group renderers**: Use `groupRenderers` for custom layouts (e.g., two-column for fwd/back pairs)
 * - **Persistence**: Integrates with HotkeysProvider's localStorage persistence
 *
 * Unlike Omnibar (search-first) or LookupModal (type keys to filter), ShortcutsModal
 * shows everything at once in a browsable, organized view.
 *
 * Styled via CSS custom properties: --kbd-bg, --kbd-text, --kbd-kbd-bg, etc.
 *
 * @example
 * ```tsx
 * // Basic usage with HotkeysProvider (recommended)
 * <HotkeysProvider>
 *   <App />
 *   <ShortcutsModal editable />
 * </HotkeysProvider>
 *
 * // Standalone with explicit props
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
declare function ShortcutsModal({ keymap: keymapProp, defaults: defaultsProp, labels: labelsProp, descriptions: descriptionsProp, groups: groupNamesProp, groupOrder, groupRenderers, isOpen: isOpenProp, onClose: onCloseProp, defaultBinding, editable, onBindingChange, onBindingAdd, onBindingRemove, onReset, multipleBindings, children, backdropClassName, modalClassName, title, hint, showUnbound, TooltipComponent: TooltipComponentProp, }: ShortcutsModalProps): react_jsx_runtime.JSX.Element | null;

/**
 * Configuration for a row in a two-column table
 */
interface TwoColumnRow {
    /** Label for the row (first column) */
    label: ReactNode;
    /** Action ID for the left/first column */
    leftAction: string;
    /** Action ID for the right/second column */
    rightAction: string;
}
/**
 * Configuration for creating a two-column group renderer
 */
interface TwoColumnConfig {
    /** Column headers: [label, left, right] */
    headers: [string, string, string];
    /**
     * Extract rows from the group's shortcuts.
     * Return array of { label, leftAction, rightAction }.
     */
    getRows: (group: ShortcutGroup) => TwoColumnRow[];
}
/**
 * Create a GroupRenderer that displays shortcuts in a two-column table.
 *
 * @example
 * ```tsx
 * // Pair actions by suffix (left:temp/right:temp)
 * const YAxisRenderer = createTwoColumnRenderer({
 *   headers: ['Metric', 'Left', 'Right'],
 *   getRows: (group) => {
 *     const metrics = ['temp', 'co2', 'humid']
 *     return metrics.map(m => ({
 *       label: m,
 *       leftAction: `left:${m}`,
 *       rightAction: `right:${m}`,
 *     }))
 *   },
 * })
 *
 * // Explicit pairs
 * const NavRenderer = createTwoColumnRenderer({
 *   headers: ['Navigation', 'Back', 'Forward'],
 *   getRows: () => [
 *     { label: 'Page', leftAction: 'nav:prev', rightAction: 'nav:next' },
 *   ],
 * })
 * ```
 */
declare function createTwoColumnRenderer(config: TwoColumnConfig): ({ group, renderCell }: GroupRendererProps) => ReactNode;

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
    /**
     * Default keybinding to open omnibar (default: 'meta+k').
     * Users can override this in the shortcuts modal.
     * Set to empty string to disable.
     */
    defaultBinding?: string;
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
     * Called when a local action is executed.
     * If not provided, uses executeAction from HotkeysContext.
     */
    onExecute?: (actionId: string) => void;
    /**
     * Called when a remote omnibar entry is executed.
     * Use this to handle navigation for entries with `href`.
     */
    onExecuteRemote?: (entry: OmnibarEntry) => void;
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
    /** Local action search results */
    results: ActionSearchResult[];
    /** Remote endpoint results */
    remoteResults: RemoteOmnibarResult[];
    /** Whether remote endpoints are being queried */
    isLoadingRemote: boolean;
    /** Pagination info per endpoint */
    endpointPagination: Map<string, EndpointPaginationInfo>;
    /** Load more results for a specific endpoint */
    loadMore: (endpointId: string) => void;
    /** Currently selected index (across local + remote) */
    selectedIndex: number;
    /** Total number of results (local + remote) */
    totalResults: number;
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
 * Command palette for searching and executing actions by name.
 *
 * Opens by default with `⌘K` (macOS) or `Ctrl+K` (Windows/Linux). Type to search
 * across all registered actions by label, then press Enter to execute.
 *
 * Features:
 * - **Fuzzy search**: Matches action labels (e.g., "nav tab" finds "Navigate to Table")
 * - **Keyboard navigation**: Arrow keys to select, Enter to execute, Escape to close
 * - **Binding display**: Shows keyboard shortcuts next to each result
 * - **Sequence support**: Can also match and execute key sequences
 *
 * Unlike ShortcutsModal (shows all shortcuts organized by group) or LookupModal
 * (type keys to filter by binding), Omnibar is search-first by action name/label.
 *
 * Styled via CSS custom properties: --kbd-bg, --kbd-text, --kbd-accent, etc.
 *
 * @example
 * ```tsx
 * // Basic usage with HotkeysProvider (recommended)
 * <HotkeysProvider>
 *   <App />
 *   <Omnibar />
 * </HotkeysProvider>
 *
 * // Standalone with explicit props
 * <Omnibar
 *   actions={ACTIONS}
 *   handlers={HANDLERS}
 *   keymap={KEYMAP}
 *   onExecute={(id) => console.log('Executed:', id)}
 * />
 * ```
 */
declare function Omnibar({ actions: actionsProp, handlers: handlersProp, keymap: keymapProp, defaultBinding, isOpen: isOpenProp, onOpen: onOpenProp, onClose: onCloseProp, onExecute: onExecuteProp, onExecuteRemote: onExecuteRemoteProp, maxResults, placeholder, children, backdropClassName, omnibarClassName, }: OmnibarProps): react_jsx_runtime.JSX.Element | null;

/**
 * Check if a key is a shifted symbol (requires Shift on US keyboard).
 * For these keys, shift modifier should be implicit, not shown separately.
 */
declare function isShiftedSymbol(key: string): boolean;
/**
 * Detect if running on macOS/iOS
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
 * Sentinel values for digit placeholders in KeyCombination.key
 * These are used during recording to represent placeholder patterns.
 */
declare const DIGIT_PLACEHOLDER = "__DIGIT__";
declare const DIGITS_PLACEHOLDER = "__DIGITS__";
/**
 * Check if a key string is a digit placeholder sentinel value.
 * Used during recording to identify placeholder keys.
 */
declare function isPlaceholderSentinel(key: string): boolean;
/**
 * Convert a KeyCombination or HotkeySequence to display format
 */
declare function formatCombination(combo: KeyCombination): KeyCombinationDisplay;
declare function formatCombination(sequence: HotkeySequence): KeyCombinationDisplay;
/**
 * Format a binding string for display.
 * Takes a binding like "meta+k" or "2 w" and returns a display string like "⌘K" or "2 W".
 *
 * @example
 * formatBinding('meta+k') // "⌘K" on Mac, "Ctrl+K" on Windows
 * formatBinding('2 w')    // "2 W"
 * formatBinding('?')      // "?"
 */
declare function formatBinding(binding: string): string;
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
 * Parse a hotkey string to a KeySeq (new sequence type with digit placeholders).
 * Handles both single keys ("ctrl+k") and sequences ("2 w", "\\d+ d")
 *
 * @example
 * parseKeySeq('\\d+ d')  // [{ type: 'digits' }, { type: 'key', key: 'd', ... }]
 * parseKeySeq('ctrl+k')  // [{ type: 'key', key: 'k', modifiers: { ctrl: true, ... } }]
 */
declare function parseKeySeq(hotkeyStr: string): KeySeq;
/**
 * Format a KeySeq to display format
 */
declare function formatKeySeq(seq: KeySeq): KeyCombinationDisplay;
/**
 * Check if a KeySeq contains any digit placeholders
 */
declare function hasDigitPlaceholders(seq: KeySeq): boolean;
/**
 * Convert a KeySeq to HotkeySequence (for backwards compatibility).
 * Note: Digit placeholders become literal '\d' or '\d+' keys.
 * This is only useful for legacy code paths.
 */
declare function keySeqToHotkeySequence(seq: KeySeq): HotkeySequence;
/**
 * Convert a HotkeySequence to KeySeq (for migration).
 * Note: This does NOT detect digit patterns - use parseKeySeq for that.
 */
declare function hotkeySequenceToKeySeq(seq: HotkeySequence): KeySeq;
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
 * - Pattern overlap: digit patterns that could match the same input (e.g., "\d d" and "5 d")
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
 * Returns both exact matches (isComplete: true) and continuations (isComplete: false).
 *
 * @example
 * ```tsx
 * const keymap = { 'h': 'humidity', 'h \\d+': 'nHours', '2 w': 'twoWeeks' }
 * const pending = parseHotkeyString('h')
 * const completions = getSequenceCompletions(pending, keymap)
 * // Returns:
 * // [
 * //   { nextKeys: '', fullSequence: 'h', actions: ['humidity'], isComplete: true },
 * //   { nextKeys: '⟨##⟩', fullSequence: 'h \\d+', actions: ['nHours'], isComplete: false },
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

/**
 * Handler function for actions.
 * Optionally receives captured values from digit placeholders in bindings.
 *
 * @example
 * ```tsx
 * // Simple handler (no captures)
 * handler: () => setPage(1)
 *
 * // Handler with captures (e.g., for binding "\d+ j")
 * handler: (e, captures) => {
 *   const n = captures?.[0] ?? 1
 *   setRow(row + n)
 * }
 * ```
 */
type ActionHandler = (e?: KeyboardEvent, captures?: number[]) => void;
interface ActionConfig {
    /** Human-readable label for omnibar/modal */
    label: string;
    /** Group name for organizing in modal */
    group?: string;
    /** Default key bindings (user can override) */
    defaultBindings?: string[];
    /** Search keywords for omnibar */
    keywords?: string[];
    /** The action handler (optionally receives KeyboardEvent and captured values) */
    handler: ActionHandler;
    /** Whether action is currently enabled (default: true) */
    enabled?: boolean;
    /** Priority for conflict resolution (higher wins, default: 0) */
    priority?: number;
    /** Hide from ShortcutsModal (still searchable in omnibar) */
    hideFromModal?: boolean;
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
    /** Execute an action by ID, optionally with captured digit values */
    execute: (id: string, captures?: number[]) => void;
    /** Currently registered actions */
    actions: Map<string, RegisteredAction>;
    /** Computed keymap from registered actions + user overrides */
    keymap: HotkeyMap;
    /** Action registry for omnibar search */
    actionRegistry: ActionRegistry;
    /** Get all bindings for an action (defaults + overrides) */
    getBindingsForAction: (id: string) => string[];
    /** Get the first binding for an action (convenience for display) */
    getFirstBindingForAction: (id: string) => string | undefined;
    /** User's binding overrides */
    overrides: Record<string, string | string[]>;
    /** Set a user override for a binding */
    setBinding: (actionId: string, key: string) => void;
    /** Remove a binding for a specific action */
    removeBinding: (actionId: string, key: string) => void;
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
    /** Timeout in ms before a sequence auto-submits (default: Infinity, no timeout) */
    sequenceTimeout?: number;
    /** When true, keys with conflicts are disabled (default: true) */
    disableConflicts?: boolean;
    /** Minimum viewport width to enable hotkeys (false = always enabled) */
    minViewportWidth?: number | false;
    /** Whether to show hotkey UI on touch-only devices (default: false) */
    enableOnTouch?: boolean;
}
/**
 * Context value for hotkeys.
 */
interface HotkeysContextValue {
    /** The actions registry */
    registry: ActionsRegistryValue;
    /** The omnibar endpoints registry */
    endpointsRegistry: OmnibarEndpointsRegistryValue;
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
    /** Whether currently editing a binding in ShortcutsModal */
    isEditingBinding: boolean;
    /** Set editing state (called by ShortcutsModal) */
    setIsEditingBinding: (value: boolean) => void;
    /** Lookup modal open state */
    isLookupOpen: boolean;
    /** Initial keys to pre-fill when lookup modal opens */
    lookupInitialKeys: HotkeySequence;
    /** Open the lookup modal, optionally with pre-filled keys */
    openLookup: (initialKeys?: HotkeySequence) => void;
    /** Close the lookup modal */
    closeLookup: () => void;
    /** Toggle the lookup modal */
    toggleLookup: () => void;
    /** Execute an action by ID */
    executeAction: (id: string, captures?: number[]) => void;
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
    /** Cancel the current sequence */
    cancelSequence: () => void;
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
 * Register an omnibar endpoint for dynamic search results.
 *
 * Supports both async (remote API) and sync (in-memory) endpoints:
 * - Use `fetch` for async operations that need AbortSignal support
 * - Use `filter` for sync in-memory filtering (skips debouncing for instant results)
 *
 * Endpoints are automatically unregistered when the component unmounts,
 * making this ideal for colocating search providers with their data context.
 *
 * @example Async endpoint (remote API)
 * ```tsx
 * useOmnibarEndpoint('users', {
 *   fetch: async (query, signal, pagination) => {
 *     const res = await fetch(`/api/users?q=${query}`, { signal })
 *     const { users, total } = await res.json()
 *     return {
 *       entries: users.map(u => ({
 *         id: `user:${u.id}`,
 *         label: u.name,
 *         handler: () => navigate(`/users/${u.id}`),
 *       })),
 *       total,
 *       hasMore: pagination.offset + users.length < total,
 *     }
 *   },
 *   group: 'Users',
 * })
 * ```
 *
 * @example Sync endpoint (in-memory filtering)
 * ```tsx
 * useOmnibarEndpoint('stations', {
 *   filter: (query, pagination) => {
 *     const matches = stations.filter(s => s.name.includes(query))
 *     return {
 *       entries: matches.slice(pagination.offset, pagination.offset + pagination.limit)
 *         .map(s => ({ id: s.id, label: s.name, handler: () => select(s) })),
 *       total: matches.length,
 *       hasMore: pagination.offset + pagination.limit < matches.length,
 *     }
 *   },
 *   group: 'Stations',
 *   minQueryLength: 0,
 * })
 * ```
 */
declare function useOmnibarEndpoint(id: string, config: OmnibarEndpointConfig): void;

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
 *     sequenceTimeout: 800, // custom timeout
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

interface KbdProps {
    /** Action ID to display binding(s) for */
    action: string;
    /** Separator between multiple bindings (default: " / ") */
    separator?: string;
    /** Show all bindings instead of just the first (default: false, shows only first) */
    all?: boolean;
    /** Fallback content when no bindings exist */
    fallback?: React.ReactNode;
    /** Additional className */
    className?: string;
    /** Make the kbd clickable to trigger the action */
    clickable?: boolean;
}
/**
 * Display the current binding(s) for an action (clickable by default).
 *
 * Automatically updates when users customize their bindings.
 * Uses SVG icons for modifiers (⌘, ⌥, ⇧, ⌃) and special keys (arrows, enter, etc.)
 *
 * @example
 * ```tsx
 * // Clickable kbd that triggers the action (default)
 * <p>Press <Kbd action="help" /> to see shortcuts</p>
 *
 * // Non-clickable for pure display (use Key alias or clickable={false})
 * <p>Navigate with <Key action="next" /> to go to next item</p>
 *
 * // Show all bindings (not just the first)
 * <p>Navigate with <Kbd action="next" all separator=" or " /></p>
 *
 * // With fallback when no binding exists
 * <Kbd action="customAction" fallback="(unbound)" />
 * ```
 */
declare function Kbd({ action, separator, all, fallback, className, clickable, }: KbdProps): react_jsx_runtime.JSX.Element | null;
/**
 * Non-clickable variant of Kbd for pure display/documentation purposes.
 * Alias for `<Kbd clickable={false} ... />`
 */
declare function Key(props: Omit<KbdProps, 'clickable'>): react_jsx_runtime.JSX.Element;
/**
 * Display all bindings for an action (shows multiple if they exist).
 * Alias for `<Kbd all ... />`
 *
 * @example
 * ```tsx
 * <p>Navigate with <Kbds action="next" separator=" or " /></p>
 * ```
 */
declare function Kbds(props: Omit<KbdProps, 'all'>): react_jsx_runtime.JSX.Element;
type BuiltinKbdProps = Omit<KbdProps, 'action'>;
/**
 * Kbd for the ShortcutsModal trigger (default: `?`).
 * @example <KbdModal /> // Shows "?" or user's custom binding
 */
declare function KbdModal(props: BuiltinKbdProps): react_jsx_runtime.JSX.Element;
/**
 * Kbd for the Omnibar trigger (default: `⌘K`).
 * @example <KbdOmnibar /> // Shows "⌘K" or user's custom binding
 */
declare function KbdOmnibar(props: BuiltinKbdProps): react_jsx_runtime.JSX.Element;
/**
 * Kbd for the LookupModal trigger (default: `⌘⇧K`).
 * @example <KbdLookup /> // Shows "⌘⇧K" or user's custom binding
 */
declare function KbdLookup(props: BuiltinKbdProps): react_jsx_runtime.JSX.Element;

interface LookupModalProps {
    /**
     * Default keybinding to open lookup modal (default: 'meta+shift+k').
     * Users can override this in the shortcuts modal.
     * Set to empty string to disable.
     */
    defaultBinding?: string;
}
/**
 * Modal for browsing and looking up keyboard shortcuts by typing key sequences.
 *
 * Unlike SequenceModal (which auto-executes when a complete sequence is entered),
 * LookupModal lets you browse all available shortcuts and select one to execute.
 *
 * - Press keys to filter to matching sequences
 * - Use arrow keys to navigate results
 * - Press Enter to execute selected action
 * - Press Escape to close or clear filter
 * - Press Backspace to remove last key from filter
 */
declare function LookupModal({ defaultBinding }?: LookupModalProps): react_jsx_runtime.JSX.Element | null;

/**
 * Modal that appears during multi-key sequence input (e.g., `g t` for "go to table").
 *
 * When a user presses a key that starts a sequence, this modal appears showing:
 * - The keys pressed so far
 * - Available completions (what keys can come next)
 * - A timeout indicator (only shown when exactly one completion exists)
 *
 * Features:
 * - Arrow keys navigate between completions (cancels auto-timeout)
 * - Enter executes the selected completion (even for digit patterns - handler gets undefined captures)
 * - Escape cancels the sequence
 *
 * Unlike LookupModal (which requires explicit activation and lets you browse/search),
 * SequenceModal appears automatically when you start typing a sequence.
 *
 * @example
 * ```tsx
 * // Include in your app (no props needed - uses HotkeysContext)
 * <HotkeysProvider>
 *   <App />
 *   <SequenceModal />
 * </HotkeysProvider>
 * ```
 */
declare function SequenceModal(): react_jsx_runtime.JSX.Element | null;

interface ModifierIconProps extends SVGProps<SVGSVGElement> {
    className?: string;
    style?: CSSProperties;
}
/** Command/Meta key icon (⌘) */
declare const Command: react.ForwardRefExoticComponent<Omit<ModifierIconProps, "ref"> & react.RefAttributes<SVGSVGElement>>;
/** Control key icon (^) - chevron/caret */
declare const Ctrl: react.ForwardRefExoticComponent<Omit<ModifierIconProps, "ref"> & react.RefAttributes<SVGSVGElement>>;
/** Shift key icon (⇧) - hollow arrow */
declare const Shift: react.ForwardRefExoticComponent<Omit<ModifierIconProps, "ref"> & react.RefAttributes<SVGSVGElement>>;
/** Option key icon (⌥) - macOS style */
declare const Option: react.ForwardRefExoticComponent<Omit<ModifierIconProps, "ref"> & react.RefAttributes<SVGSVGElement>>;
/** Alt key icon (⎇) - Windows style, though "Alt" text is more common on Windows */
declare const Alt: react.ForwardRefExoticComponent<Omit<ModifierIconProps, "ref"> & react.RefAttributes<SVGSVGElement>>;
type ModifierType = 'meta' | 'ctrl' | 'shift' | 'alt' | 'opt';
/** Get the appropriate icon component for a modifier key */
declare function getModifierIcon(modifier: ModifierType): typeof Command;
/** Render a modifier icon by name */
declare const ModifierIcon: react.ForwardRefExoticComponent<Omit<ModifierIconProps & {
    modifier: ModifierType;
}, "ref"> & react.RefAttributes<SVGSVGElement>>;

interface KeyIconProps {
    className?: string;
    style?: CSSProperties;
}
/** Arrow Up icon (↑) */
declare function Up({ className, style }: KeyIconProps): react_jsx_runtime.JSX.Element;
/** Arrow Down icon (↓) */
declare function Down({ className, style }: KeyIconProps): react_jsx_runtime.JSX.Element;
/** Arrow Left icon (←) */
declare function Left({ className, style }: KeyIconProps): react_jsx_runtime.JSX.Element;
/** Arrow Right icon (→) */
declare function Right({ className, style }: KeyIconProps): react_jsx_runtime.JSX.Element;
/** Enter/Return icon (↵) */
declare function Enter({ className, style }: KeyIconProps): react_jsx_runtime.JSX.Element;
/** Backspace icon (⌫) */
declare function Backspace({ className, style }: KeyIconProps): react_jsx_runtime.JSX.Element;
type KeyIconType = 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright' | 'enter' | 'backspace' | 'tab';
/** Get the icon component for a key, or null if no icon exists */
declare function getKeyIcon(key: string): ComponentType<KeyIconProps> | null;

/**
 * Default timeout for key sequences (no timeout).
 * Set to a finite number (ms) to auto-submit sequences after that duration.
 */
declare const DEFAULT_SEQUENCE_TIMEOUT: number;
/**
 * Reserved action IDs for built-in UI components.
 * These are registered automatically by their respective components.
 */
declare const ACTION_MODAL = "__hotkeys:modal";
declare const ACTION_OMNIBAR = "__hotkeys:omnibar";
declare const ACTION_LOOKUP = "__hotkeys:lookup";

export { ACTION_LOOKUP, ACTION_MODAL, ACTION_OMNIBAR, type ActionConfig, type ActionDefinition, type ActionHandler, type ActionRegistry, type ActionSearchResult, ActionsRegistryContext, type ActionsRegistryValue, Alt, Backspace, type BindingInfo, Command, Ctrl, DEFAULT_SEQUENCE_TIMEOUT, DIGITS_PLACEHOLDER, DIGIT_PLACEHOLDER, Down, type EndpointPagination, type EndpointPaginationInfo, type EndpointPaginationMode, type EndpointQueryResult, type EndpointResponse, Enter, type FuzzyMatchResult, type GroupRenderer, type GroupRendererProps, type HandlerMap, type HotkeyHandler, type HotkeyMap, type HotkeySequence, type HotkeysConfig, type HotkeysContextValue, HotkeysProvider, type HotkeysProviderProps, Kbd, KbdLookup, KbdModal, KbdOmnibar, type KbdProps, Kbds, Key, type KeyCombination, type KeyCombinationDisplay, type KeyConflict, type KeyIconProps, type KeyIconType, type KeySeq, KeybindingEditor, type KeybindingEditorProps, type KeybindingEditorRenderProps, Left, LookupModal, ModifierIcon, type ModifierIconProps, type ModifierType, type Modifiers, Omnibar, type OmnibarActionEntry, type OmnibarEndpointAsyncConfig, type OmnibarEndpointConfig, type OmnibarEndpointConfigBase, type OmnibarEndpointSyncConfig, OmnibarEndpointsRegistryContext, type OmnibarEndpointsRegistryValue, type OmnibarEntry, type OmnibarEntryBase, type OmnibarLinkEntry, type OmnibarProps, type OmnibarRenderProps, Option, type RecordHotkeyOptions, type RecordHotkeyResult, type RegisteredAction, type RegisteredEndpoint, type RemoteOmnibarResult, Right, type SeqElem, type SeqElemState, type SeqMatchState, type SequenceCompletion, SequenceModal, Shift, type ShortcutGroup, ShortcutsModal, type ShortcutsModalProps, type ShortcutsModalRenderProps, type TooltipComponent, type TooltipProps, type TwoColumnConfig, type TwoColumnRow, Up, type UseEditableHotkeysOptions, type UseEditableHotkeysResult, type UseHotkeysOptions, type UseHotkeysResult, type UseOmnibarOptions, type UseOmnibarResult, countPlaceholders, createTwoColumnRenderer, extractCaptures, findConflicts, formatBinding, formatCombination, formatKeyForDisplay, formatKeySeq, fuzzyMatch, getActionBindings, getConflictsArray, getKeyIcon, getModifierIcon, getSequenceCompletions, hasConflicts, hasDigitPlaceholders, hotkeySequenceToKeySeq, isDigitPlaceholder, isMac, isModifierKey, isPlaceholderSentinel, isSequence, isShiftedSymbol, keySeqToHotkeySequence, normalizeKey, parseHotkeyString, parseKeySeq, searchActions, useAction, useActions, useActionsRegistry, useEditableHotkeys, useHotkeys, useHotkeysContext, useMaybeHotkeysContext, useOmnibar, useOmnibarEndpoint, useOmnibarEndpointsRegistry, useRecordHotkey };
