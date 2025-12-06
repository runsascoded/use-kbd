import { createContext, useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import { jsx, Fragment, jsxs } from 'react/jsx-runtime';

// src/KeyboardShortcutsContext.tsx

// src/utils.ts
function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}
function normalizeKey(key) {
  const keyMap = {
    " ": "space",
    "Escape": "escape",
    "Enter": "enter",
    "Tab": "tab",
    "Backspace": "backspace",
    "Delete": "delete",
    "ArrowUp": "arrowup",
    "ArrowDown": "arrowdown",
    "ArrowLeft": "arrowleft",
    "ArrowRight": "arrowright",
    "Home": "home",
    "End": "end",
    "PageUp": "pageup",
    "PageDown": "pagedown"
  };
  if (key in keyMap) {
    return keyMap[key];
  }
  if (key.length === 1) {
    return key.toLowerCase();
  }
  if (/^F\d{1,2}$/.test(key)) {
    return key.toLowerCase();
  }
  return key.toLowerCase();
}
function formatKeyForDisplay(key) {
  const displayMap = {
    "space": "Space",
    "escape": "Esc",
    "enter": "\u21B5",
    "tab": "Tab",
    "backspace": "\u232B",
    "delete": "Del",
    "arrowup": "\u2191",
    "arrowdown": "\u2193",
    "arrowleft": "\u2190",
    "arrowright": "\u2192",
    "home": "Home",
    "end": "End",
    "pageup": "PgUp",
    "pagedown": "PgDn"
  };
  if (key in displayMap) {
    return displayMap[key];
  }
  if (/^f\d{1,2}$/.test(key)) {
    return key.toUpperCase();
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}
function formatSingleCombination(combo) {
  const mac = isMac();
  const parts = [];
  const idParts = [];
  if (combo.modifiers.ctrl) {
    parts.push(mac ? "\u2303" : "Ctrl");
    idParts.push("ctrl");
  }
  if (combo.modifiers.meta) {
    parts.push(mac ? "\u2318" : "Win");
    idParts.push("meta");
  }
  if (combo.modifiers.alt) {
    parts.push(mac ? "\u2325" : "Alt");
    idParts.push("alt");
  }
  if (combo.modifiers.shift) {
    parts.push(mac ? "\u21E7" : "Shift");
    idParts.push("shift");
  }
  parts.push(formatKeyForDisplay(combo.key));
  idParts.push(combo.key);
  return {
    display: mac ? parts.join("") : parts.join("+"),
    id: idParts.join("+")
  };
}
function formatCombination(input) {
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return { display: "", id: "", isSequence: false };
    }
    if (input.length === 1) {
      const single2 = formatSingleCombination(input[0]);
      return { ...single2, isSequence: false };
    }
    const formatted = input.map(formatSingleCombination);
    return {
      display: formatted.map((f) => f.display).join(" "),
      id: formatted.map((f) => f.id).join(" "),
      isSequence: true
    };
  }
  const single = formatSingleCombination(input);
  return { ...single, isSequence: false };
}
function isModifierKey(key) {
  return ["Control", "Alt", "Shift", "Meta"].includes(key);
}
var SHIFTED_CHARS = /* @__PURE__ */ new Set([
  "~",
  "!",
  "@",
  "#",
  "$",
  "%",
  "^",
  "&",
  "*",
  "(",
  ")",
  "_",
  "+",
  "{",
  "}",
  "|",
  ":",
  '"',
  "<",
  ">",
  "?"
]);
function isShiftedChar(key) {
  return SHIFTED_CHARS.has(key);
}
function isSequence(hotkeyStr) {
  return hotkeyStr.includes(" ");
}
function parseSingleCombination(str) {
  const parts = str.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  return {
    key,
    modifiers: {
      ctrl: parts.includes("ctrl") || parts.includes("control"),
      alt: parts.includes("alt") || parts.includes("option"),
      shift: parts.includes("shift"),
      meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("command")
    }
  };
}
function parseHotkeyString(hotkeyStr) {
  if (!hotkeyStr.trim()) return [];
  const parts = hotkeyStr.trim().split(/\s+/);
  return parts.map(parseSingleCombination);
}
function parseCombinationId(id) {
  const sequence = parseHotkeyString(id);
  if (sequence.length === 0) {
    return { key: "", modifiers: { ctrl: false, alt: false, shift: false, meta: false } };
  }
  return sequence[0];
}
function isPrefix(a, b) {
  if (a.length >= b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!combinationsEqual(a[i], b[i])) return false;
  }
  return true;
}
function combinationsEqual(a, b) {
  return a.key === b.key && a.modifiers.ctrl === b.modifiers.ctrl && a.modifiers.alt === b.modifiers.alt && a.modifiers.shift === b.modifiers.shift && a.modifiers.meta === b.modifiers.meta;
}
function findConflicts(keymap) {
  const conflicts = /* @__PURE__ */ new Map();
  const entries = Object.entries(keymap).map(([key, actionOrActions]) => ({
    key,
    sequence: parseHotkeyString(key),
    actions: Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
  }));
  const keyToActions = /* @__PURE__ */ new Map();
  for (const { key, actions } of entries) {
    const existing = keyToActions.get(key) ?? [];
    keyToActions.set(key, [...existing, ...actions]);
  }
  for (const [key, actions] of keyToActions) {
    if (actions.length > 1) {
      conflicts.set(key, actions);
    }
  }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (isPrefix(a.sequence, b.sequence)) {
        const existingA = conflicts.get(a.key) ?? [];
        if (!existingA.includes(`prefix of: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `prefix of: ${b.key}`]);
        }
        const existingB = conflicts.get(b.key) ?? [];
        if (!existingB.includes(`has prefix: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `has prefix: ${a.key}`]);
        }
      } else if (isPrefix(b.sequence, a.sequence)) {
        const existingB = conflicts.get(b.key) ?? [];
        if (!existingB.includes(`prefix of: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `prefix of: ${a.key}`]);
        }
        const existingA = conflicts.get(a.key) ?? [];
        if (!existingA.includes(`has prefix: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `has prefix: ${b.key}`]);
        }
      }
    }
  }
  return conflicts;
}
function hasConflicts(keymap) {
  return findConflicts(keymap).size > 0;
}
function getConflictsArray(keymap) {
  const conflicts = findConflicts(keymap);
  return Array.from(conflicts.entries()).map(([key, actions]) => ({
    key,
    actions: actions.filter((a) => !a.startsWith("prefix of:") && !a.startsWith("has prefix:")),
    type: actions.some((a) => a.startsWith("prefix of:") || a.startsWith("has prefix:")) ? "prefix" : "duplicate"
  }));
}
function getSequenceCompletions(pendingKeys, keymap) {
  if (pendingKeys.length === 0) return [];
  const completions = [];
  for (const [hotkeyStr, actionOrActions] of Object.entries(keymap)) {
    const sequence = parseHotkeyString(hotkeyStr);
    if (sequence.length <= pendingKeys.length) continue;
    let isPrefix2 = true;
    for (let i = 0; i < pendingKeys.length; i++) {
      if (!combinationsEqual(pendingKeys[i], sequence[i])) {
        isPrefix2 = false;
        break;
      }
    }
    if (isPrefix2) {
      const remainingKeys = sequence.slice(pendingKeys.length);
      const nextKeys = formatCombination(remainingKeys).id;
      const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
      completions.push({
        nextKeys,
        fullSequence: hotkeyStr,
        display: formatCombination(sequence),
        actions
      });
    }
  }
  return completions;
}
function getActionBindings(keymap) {
  const actionToKeys = /* @__PURE__ */ new Map();
  for (const [key, actionOrActions] of Object.entries(keymap)) {
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
    for (const action of actions) {
      const existing = actionToKeys.get(action) ?? [];
      actionToKeys.set(action, [...existing, key]);
    }
  }
  return actionToKeys;
}
function fuzzyMatch(pattern, text) {
  if (!pattern) return { matched: true, score: 1, ranges: [] };
  if (!text) return { matched: false, score: 0, ranges: [] };
  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();
  let patternIdx = 0;
  let score = 0;
  let consecutiveBonus = 0;
  let lastMatchIdx = -2;
  const ranges = [];
  let rangeStart = -1;
  for (let textIdx = 0; textIdx < textLower.length && patternIdx < patternLower.length; textIdx++) {
    if (textLower[textIdx] === patternLower[patternIdx]) {
      let matchScore = 1;
      if (lastMatchIdx === textIdx - 1) {
        consecutiveBonus += 1;
        matchScore += consecutiveBonus;
      } else {
        consecutiveBonus = 0;
      }
      if (textIdx === 0 || /[\s\-_./]/.test(text[textIdx - 1])) {
        matchScore += 2;
      }
      if (text[textIdx] === text[textIdx].toUpperCase() && /[a-z]/.test(text[textIdx].toLowerCase())) {
        matchScore += 1;
      }
      matchScore -= textIdx * 0.01;
      score += matchScore;
      lastMatchIdx = textIdx;
      patternIdx++;
      if (rangeStart === -1) {
        rangeStart = textIdx;
      }
    } else {
      if (rangeStart !== -1) {
        ranges.push([rangeStart, lastMatchIdx + 1]);
        rangeStart = -1;
      }
    }
  }
  if (rangeStart !== -1) {
    ranges.push([rangeStart, lastMatchIdx + 1]);
  }
  const matched = patternIdx === patternLower.length;
  if (matched && textLower === patternLower) {
    score += 10;
  }
  if (matched && textLower.startsWith(patternLower)) {
    score += 5;
  }
  return { matched, score, ranges };
}
function searchActions(query, actions, keymap) {
  const actionBindings = keymap ? getActionBindings(keymap) : /* @__PURE__ */ new Map();
  const results = [];
  for (const [id, action] of Object.entries(actions)) {
    if (action.enabled === false) continue;
    const labelMatch = fuzzyMatch(query, action.label);
    const descMatch = action.description ? fuzzyMatch(query, action.description) : { matched: false, score: 0};
    const categoryMatch = action.category ? fuzzyMatch(query, action.category) : { matched: false, score: 0};
    const idMatch = fuzzyMatch(query, id);
    let keywordScore = 0;
    if (action.keywords) {
      for (const keyword of action.keywords) {
        const kwMatch = fuzzyMatch(query, keyword);
        if (kwMatch.matched) {
          keywordScore = Math.max(keywordScore, kwMatch.score);
        }
      }
    }
    const matched = labelMatch.matched || descMatch.matched || categoryMatch.matched || idMatch.matched || keywordScore > 0;
    if (!matched && query) continue;
    const score = (labelMatch.matched ? labelMatch.score * 3 : 0) + (descMatch.matched ? descMatch.score * 1.5 : 0) + (categoryMatch.matched ? categoryMatch.score * 1 : 0) + (idMatch.matched ? idMatch.score * 0.5 : 0) + keywordScore * 2;
    results.push({
      id,
      action,
      bindings: actionBindings.get(id) ?? [],
      score,
      labelMatches: labelMatch.ranges
    });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

// src/useHotkeys.ts
function eventToCombination(e) {
  return {
    key: normalizeKey(e.key),
    modifiers: {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey
    }
  };
}
function isPartialMatch(pending, target) {
  if (pending.length >= target.length) return false;
  for (let i = 0; i < pending.length; i++) {
    if (!combinationsMatch(pending[i], target[i])) {
      return false;
    }
  }
  return true;
}
function combinationsMatch(event, target) {
  const shiftMatches = isShiftedChar(event.key) ? target.modifiers.shift ? event.modifiers.shift : true : event.modifiers.shift === target.modifiers.shift;
  return event.modifiers.ctrl === target.modifiers.ctrl && event.modifiers.alt === target.modifiers.alt && shiftMatches && event.modifiers.meta === target.modifiers.meta && event.key === target.key;
}
function sequencesMatch(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!combinationsMatch(a[i], b[i])) {
      return false;
    }
  }
  return true;
}
function useHotkeys(keymap, handlers, options = {}) {
  const {
    enabled = true,
    target,
    preventDefault = true,
    stopPropagation = true,
    enableOnFormTags = false,
    sequenceTimeout = 1e3,
    onTimeout = "submit",
    onSequenceStart,
    onSequenceProgress,
    onSequenceCancel
  } = options;
  const [pendingKeys, setPendingKeys] = useState([]);
  const [isAwaitingSequence, setIsAwaitingSequence] = useState(false);
  const [timeoutStartedAt, setTimeoutStartedAt] = useState(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const keymapRef = useRef(keymap);
  keymapRef.current = keymap;
  const timeoutRef = useRef(null);
  const pendingKeysRef = useRef([]);
  pendingKeysRef.current = pendingKeys;
  const parsedKeymapRef = useRef([]);
  useEffect(() => {
    parsedKeymapRef.current = Object.entries(keymap).map(([key, actionOrActions]) => ({
      key,
      sequence: parseHotkeyString(key),
      actions: Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
    }));
  }, [keymap]);
  const clearPending = useCallback(() => {
    setPendingKeys([]);
    setIsAwaitingSequence(false);
    setTimeoutStartedAt(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  const cancelSequence = useCallback(() => {
    clearPending();
    onSequenceCancel?.();
  }, [clearPending, onSequenceCancel]);
  const tryExecute = useCallback((sequence, e) => {
    for (const entry of parsedKeymapRef.current) {
      if (sequencesMatch(sequence, entry.sequence)) {
        for (const action of entry.actions) {
          const handler = handlersRef.current[action];
          if (handler) {
            if (preventDefault) {
              e.preventDefault();
            }
            if (stopPropagation) {
              e.stopPropagation();
            }
            handler(e);
            return true;
          }
        }
      }
    }
    return false;
  }, [preventDefault, stopPropagation]);
  const hasPotentialMatch = useCallback((sequence) => {
    for (const entry of parsedKeymapRef.current) {
      if (isPartialMatch(sequence, entry.sequence) || sequencesMatch(sequence, entry.sequence)) {
        return true;
      }
    }
    return false;
  }, []);
  const hasSequenceExtension = useCallback((sequence) => {
    for (const entry of parsedKeymapRef.current) {
      if (entry.sequence.length > sequence.length && isPartialMatch(sequence, entry.sequence)) {
        return true;
      }
    }
    return false;
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const targetElement = target ?? window;
    const handleKeyDown = (e) => {
      if (!enableOnFormTags) {
        const eventTarget = e.target;
        if (eventTarget instanceof HTMLInputElement || eventTarget instanceof HTMLTextAreaElement || eventTarget instanceof HTMLSelectElement || eventTarget.isContentEditable) {
          return;
        }
      }
      if (isModifierKey(e.key)) {
        return;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (e.key === "Enter" && pendingKeysRef.current.length > 0) {
        e.preventDefault();
        const executed = tryExecute(pendingKeysRef.current, e);
        clearPending();
        if (!executed) {
          onSequenceCancel?.();
        }
        return;
      }
      if (e.key === "Escape" && pendingKeysRef.current.length > 0) {
        e.preventDefault();
        cancelSequence();
        return;
      }
      const currentCombo = eventToCombination(e);
      const newSequence = [...pendingKeysRef.current, currentCombo];
      const exactMatch = tryExecute(newSequence, e);
      if (exactMatch) {
        clearPending();
        return;
      }
      if (hasPotentialMatch(newSequence)) {
        if (hasSequenceExtension(newSequence)) {
          setPendingKeys(newSequence);
          setIsAwaitingSequence(true);
          if (pendingKeysRef.current.length === 0) {
            onSequenceStart?.(newSequence);
          } else {
            onSequenceProgress?.(newSequence);
          }
          setTimeoutStartedAt(Date.now());
          timeoutRef.current = setTimeout(() => {
            if (onTimeout === "submit") {
              setPendingKeys((current) => {
                if (current.length > 0) {
                  onSequenceCancel?.();
                }
                return [];
              });
              setIsAwaitingSequence(false);
              setTimeoutStartedAt(null);
            } else {
              setPendingKeys([]);
              setIsAwaitingSequence(false);
              setTimeoutStartedAt(null);
              onSequenceCancel?.();
            }
            timeoutRef.current = null;
          }, sequenceTimeout);
          if (preventDefault) {
            e.preventDefault();
          }
          return;
        }
      }
      if (pendingKeysRef.current.length > 0) {
        clearPending();
        onSequenceCancel?.();
      }
      const singleMatch = tryExecute([currentCombo], e);
      if (!singleMatch) {
        if (hasSequenceExtension([currentCombo])) {
          setPendingKeys([currentCombo]);
          setIsAwaitingSequence(true);
          onSequenceStart?.([currentCombo]);
          if (preventDefault) {
            e.preventDefault();
          }
          setTimeoutStartedAt(Date.now());
          timeoutRef.current = setTimeout(() => {
            if (onTimeout === "submit") {
              setPendingKeys([]);
              setIsAwaitingSequence(false);
              setTimeoutStartedAt(null);
              onSequenceCancel?.();
            } else {
              setPendingKeys([]);
              setIsAwaitingSequence(false);
              setTimeoutStartedAt(null);
              onSequenceCancel?.();
            }
            timeoutRef.current = null;
          }, sequenceTimeout);
        }
      }
    };
    targetElement.addEventListener("keydown", handleKeyDown);
    return () => {
      targetElement.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    enabled,
    target,
    preventDefault,
    stopPropagation,
    enableOnFormTags,
    sequenceTimeout,
    onTimeout,
    clearPending,
    cancelSequence,
    tryExecute,
    hasPotentialMatch,
    hasSequenceExtension,
    onSequenceStart,
    onSequenceProgress,
    onSequenceCancel
  ]);
  return { pendingKeys, isAwaitingSequence, cancelSequence, timeoutStartedAt, sequenceTimeout };
}
var KeyboardShortcutsContext = createContext(null);
function KeyboardShortcutsProvider({
  defaults,
  actions: actionsProp = {},
  storageKey,
  disableConflicts = true,
  children
}) {
  const [overrides, setOverrides] = useState(() => {
    if (!storageKey || typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      if (Object.keys(overrides).length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(overrides));
      }
    } catch {
    }
  }, [storageKey, overrides]);
  const keymap = useMemo(() => {
    const removedKeys = /* @__PURE__ */ new Set();
    for (const [key, action] of Object.entries(overrides)) {
      if (action === "") {
        removedKeys.add(key);
      }
    }
    const actionToKeys = {};
    for (const [key, action] of Object.entries(defaults)) {
      if (removedKeys.has(key)) continue;
      const actions = Array.isArray(action) ? action : [action];
      for (const a of actions) {
        if (!actionToKeys[a]) actionToKeys[a] = [];
        actionToKeys[a].push(key);
      }
    }
    for (const [key, action] of Object.entries(overrides)) {
      if (action === void 0 || action === "") continue;
      const actions = Array.isArray(action) ? action : [action];
      for (const a of actions) {
        if (!actionToKeys[a]) actionToKeys[a] = [];
        if (!actionToKeys[a].includes(key)) {
          actionToKeys[a].push(key);
        }
      }
    }
    const result = {};
    for (const [action, keys] of Object.entries(actionToKeys)) {
      for (const key of keys) {
        if (result[key]) {
          const existing = result[key];
          result[key] = Array.isArray(existing) ? [...existing, action] : [existing, action];
        } else {
          result[key] = action;
        }
      }
    }
    return result;
  }, [defaults, overrides]);
  const conflicts = useMemo(() => findConflicts(keymap), [keymap]);
  const hasConflictsValue = conflicts.size > 0;
  const actionBindings = useMemo(() => getActionBindings(keymap), [keymap]);
  const searchActionsInContext = useCallback(
    (query) => searchActions(query, actionsProp, keymap),
    [actionsProp, keymap]
  );
  const getCompletions = useCallback(
    (pendingKeys) => getSequenceCompletions(pendingKeys, keymap),
    [keymap]
  );
  const getBindingsForAction = useCallback(
    (actionId) => actionBindings.get(actionId) ?? [],
    [actionBindings]
  );
  const setBinding = useCallback((action, key) => {
    setOverrides((prev) => {
      const result = {};
      for (const [k, v] of Object.entries(defaults)) {
        const actions = Array.isArray(v) ? v : [v];
        if (actions.includes(action) && k !== key) {
          result[k] = "";
        }
      }
      for (const [k, v] of Object.entries(prev)) {
        const actions = Array.isArray(v) ? v : [v];
        if (k === key || !actions.includes(action)) {
          result[k] = v;
        }
      }
      result[key] = action;
      return result;
    });
  }, [defaults]);
  const addBinding = useCallback((action, key) => {
    setOverrides((prev) => {
      return { ...prev, [key]: action };
    });
  }, []);
  const removeBinding = useCallback((key) => {
    setOverrides((prev) => {
      const isDefault = key in defaults;
      if (isDefault) {
        return { ...prev, [key]: "" };
      } else {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
    });
  }, [defaults]);
  const setKeymap = useCallback((newOverrides) => {
    setOverrides((prev) => ({ ...prev, ...newOverrides }));
  }, []);
  const reset = useCallback(() => {
    setOverrides({});
  }, []);
  const value = useMemo(
    () => ({
      defaults,
      keymap,
      actions: actionsProp,
      setBinding,
      addBinding,
      removeBinding,
      setKeymap,
      reset,
      overrides,
      conflicts,
      hasConflicts: hasConflictsValue,
      disableConflicts,
      searchActions: searchActionsInContext,
      getCompletions,
      getBindingsForAction
    }),
    [defaults, keymap, actionsProp, setBinding, addBinding, removeBinding, setKeymap, reset, overrides, conflicts, hasConflictsValue, disableConflicts, searchActionsInContext, getCompletions, getBindingsForAction]
  );
  return /* @__PURE__ */ jsx(KeyboardShortcutsContext.Provider, { value, children });
}
function useKeyboardShortcutsContext() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error("useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider");
  }
  return context;
}
function useRegisteredHotkeys(handlers, options = {}) {
  const { keymap, conflicts, disableConflicts } = useKeyboardShortcutsContext();
  const effectiveKeymap = useMemo(() => {
    if (!disableConflicts || conflicts.size === 0) {
      return keymap;
    }
    const filtered = {};
    for (const [key, action] of Object.entries(keymap)) {
      if (!conflicts.has(key)) {
        filtered[key] = action;
      }
    }
    return filtered;
  }, [keymap, conflicts, disableConflicts]);
  return useHotkeys(effectiveKeymap, handlers, options);
}
function useEventCallback(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args) => ref.current?.(...args)), []);
}
function useRecordHotkey(options = {}) {
  const {
    onCapture: onCaptureProp,
    onCancel: onCancelProp,
    preventDefault = true,
    sequenceTimeout = 1e3
  } = options;
  const onCapture = useEventCallback(onCaptureProp);
  const onCancel = useEventCallback(onCancelProp);
  const [isRecording, setIsRecording] = useState(false);
  const [sequence, setSequence] = useState(null);
  const [pendingKeys, setPendingKeys] = useState([]);
  const [activeKeys, setActiveKeys] = useState(null);
  const pressedKeysRef = useRef(/* @__PURE__ */ new Set());
  const hasNonModifierRef = useRef(false);
  const currentComboRef = useRef(null);
  const timeoutRef = useRef(null);
  const clearTimeout_ = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  const submit = useCallback((seq) => {
    if (seq.length === 0) return;
    const display2 = formatCombination(seq);
    clearTimeout_();
    pressedKeysRef.current.clear();
    hasNonModifierRef.current = false;
    currentComboRef.current = null;
    setSequence(seq);
    setPendingKeys([]);
    setIsRecording(false);
    setActiveKeys(null);
    onCapture?.(seq, display2);
  }, [clearTimeout_, onCapture]);
  const cancel = useCallback(() => {
    clearTimeout_();
    setIsRecording(false);
    setPendingKeys([]);
    setActiveKeys(null);
    pressedKeysRef.current.clear();
    hasNonModifierRef.current = false;
    currentComboRef.current = null;
    onCancel?.();
  }, [clearTimeout_, onCancel]);
  const startRecording = useCallback(() => {
    clearTimeout_();
    setIsRecording(true);
    setSequence(null);
    setPendingKeys([]);
    setActiveKeys(null);
    pressedKeysRef.current.clear();
    hasNonModifierRef.current = false;
    currentComboRef.current = null;
    return cancel;
  }, [cancel, clearTimeout_]);
  useEffect(() => {
    if (!isRecording) return;
    const handleKeyDown = (e) => {
      if (preventDefault) {
        e.preventDefault();
        e.stopPropagation();
      }
      clearTimeout_();
      if (e.key === "Enter") {
        setPendingKeys((current) => {
          if (current.length > 0) {
            submit(current);
          }
          return current;
        });
        return;
      }
      if (e.key === "Escape") {
        cancel();
        return;
      }
      const key = e.key;
      pressedKeysRef.current.add(key);
      const combo = {
        key: "",
        modifiers: {
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey
        }
      };
      for (const k of pressedKeysRef.current) {
        if (!isModifierKey(k)) {
          combo.key = normalizeKey(k);
          hasNonModifierRef.current = true;
          break;
        }
      }
      if (combo.key) {
        currentComboRef.current = combo;
        setActiveKeys(combo);
      } else {
        setActiveKeys({
          key: "",
          modifiers: combo.modifiers
        });
      }
    };
    const handleKeyUp = (e) => {
      if (preventDefault) {
        e.preventDefault();
        e.stopPropagation();
      }
      pressedKeysRef.current.delete(e.key);
      const shouldComplete = pressedKeysRef.current.size === 0 || e.key === "Meta" && hasNonModifierRef.current;
      if (shouldComplete && hasNonModifierRef.current && currentComboRef.current) {
        const combo = currentComboRef.current;
        pressedKeysRef.current.clear();
        hasNonModifierRef.current = false;
        currentComboRef.current = null;
        setActiveKeys(null);
        setPendingKeys((current) => {
          const newSequence = [...current, combo];
          clearTimeout_();
          timeoutRef.current = setTimeout(() => {
            submit(newSequence);
          }, sequenceTimeout);
          return newSequence;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      clearTimeout_();
    };
  }, [isRecording, preventDefault, sequenceTimeout, clearTimeout_, submit, cancel]);
  const display = sequence ? formatCombination(sequence) : null;
  const combination = sequence && sequence.length > 0 ? sequence[0] : null;
  return {
    isRecording,
    startRecording,
    cancel,
    sequence,
    display,
    pendingKeys,
    activeKeys,
    combination
    // deprecated
  };
}
function useEditableHotkeys(defaults, handlers, options = {}) {
  const { storageKey, disableConflicts = true, ...hotkeyOptions } = options;
  const [overrides, setOverrides] = useState(() => {
    if (!storageKey || typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      if (Object.keys(overrides).length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(overrides));
      }
    } catch {
    }
  }, [storageKey, overrides]);
  const keymap = useMemo(() => {
    const actionToKey = {};
    for (const [key, action] of Object.entries(defaults)) {
      const actions = Array.isArray(action) ? action : [action];
      for (const a of actions) {
        actionToKey[a] = key;
      }
    }
    for (const [key, action] of Object.entries(overrides)) {
      if (action === void 0) continue;
      const actions = Array.isArray(action) ? action : [action];
      for (const a of actions) {
        actionToKey[a] = key;
      }
    }
    const result = {};
    for (const [action, key] of Object.entries(actionToKey)) {
      if (result[key]) {
        const existing = result[key];
        result[key] = Array.isArray(existing) ? [...existing, action] : [existing, action];
      } else {
        result[key] = action;
      }
    }
    return result;
  }, [defaults, overrides]);
  const conflicts = useMemo(() => findConflicts(keymap), [keymap]);
  const hasConflictsValue = conflicts.size > 0;
  const effectiveKeymap = useMemo(() => {
    if (!disableConflicts || conflicts.size === 0) {
      return keymap;
    }
    const filtered = {};
    for (const [key, action] of Object.entries(keymap)) {
      if (!conflicts.has(key)) {
        filtered[key] = action;
      }
    }
    return filtered;
  }, [keymap, conflicts, disableConflicts]);
  const { pendingKeys, isAwaitingSequence, cancelSequence, timeoutStartedAt, sequenceTimeout } = useHotkeys(effectiveKeymap, handlers, hotkeyOptions);
  const setBinding = useCallback((action, key) => {
    setOverrides((prev) => {
      const cleaned = {};
      for (const [k, v] of Object.entries(prev)) {
        const actions = Array.isArray(v) ? v : [v];
        if (k === key || !actions.includes(action)) {
          cleaned[k] = v;
        }
      }
      return { ...cleaned, [key]: action };
    });
  }, []);
  const setKeymap = useCallback((newOverrides) => {
    setOverrides((prev) => ({ ...prev, ...newOverrides }));
  }, []);
  const reset = useCallback(() => {
    setOverrides({});
  }, []);
  return {
    keymap,
    setBinding,
    setKeymap,
    reset,
    overrides,
    conflicts,
    hasConflicts: hasConflictsValue,
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    timeoutStartedAt,
    sequenceTimeout
  };
}
function useOmnibar(options) {
  const {
    actions,
    handlers,
    keymap = {},
    openKey = "meta+k",
    enabled = true,
    onExecute,
    onOpen,
    onClose,
    maxResults = 10
  } = options;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;
  const omnibarKeymap = useMemo(() => {
    if (!enabled) return {};
    return { [openKey]: "omnibar:toggle" };
  }, [enabled, openKey]);
  const { pendingKeys, isAwaitingSequence } = useHotkeys(
    omnibarKeymap,
    {
      "omnibar:toggle": () => {
        setIsOpen((prev) => {
          const next = !prev;
          if (next) {
            onOpen?.();
          } else {
            onClose?.();
          }
          return next;
        });
      }
    },
    { enabled }
  );
  const results = useMemo(() => {
    const allResults = searchActions(query, actions, keymap);
    return allResults.slice(0, maxResults);
  }, [query, actions, keymap, maxResults]);
  const completions = useMemo(() => {
    return getSequenceCompletions(pendingKeys, keymap);
  }, [pendingKeys, keymap]);
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);
  const open = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setSelectedIndex(0);
    onOpen?.();
  }, [onOpen]);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
    onClose?.();
  }, [onClose]);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setQuery("");
        setSelectedIndex(0);
        onOpen?.();
      } else {
        onClose?.();
      }
      return next;
    });
  }, [onOpen, onClose]);
  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
  }, [results.length]);
  const selectPrev = useCallback(() => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0));
  }, []);
  const resetSelection = useCallback(() => {
    setSelectedIndex(0);
  }, []);
  const execute = useCallback((actionId) => {
    const id = actionId ?? results[selectedIndex]?.id;
    if (!id) return;
    close();
    if (handlersRef.current?.[id]) {
      const event = new KeyboardEvent("keydown", { key: "Enter" });
      handlersRef.current[id](event);
    }
    onExecuteRef.current?.(id);
  }, [results, selectedIndex, close]);
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        return;
      }
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "ArrowDown":
          e.preventDefault();
          selectNext();
          break;
        case "ArrowUp":
          e.preventDefault();
          selectPrev();
          break;
        case "Enter":
          e.preventDefault();
          execute();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close, selectNext, selectPrev, execute]);
  return {
    isOpen,
    open,
    close,
    toggle,
    query,
    setQuery,
    results,
    selectedIndex,
    selectNext,
    selectPrev,
    execute,
    resetSelection,
    completions,
    pendingKeys,
    isAwaitingSequence
  };
}
function buildActionMap(keymap) {
  const map = /* @__PURE__ */ new Map();
  for (const [key, actionOrActions] of Object.entries(keymap)) {
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
    for (const action of actions) {
      map.set(action, key);
    }
  }
  return map;
}
function KeybindingEditor({
  keymap,
  defaults,
  descriptions,
  onChange,
  onReset,
  className,
  children
}) {
  const [editingAction, setEditingAction] = useState(null);
  const actionMap = useMemo(() => buildActionMap(keymap), [keymap]);
  const defaultActionMap = useMemo(() => buildActionMap(defaults), [defaults]);
  const conflicts = useMemo(() => findConflicts(keymap), [keymap]);
  const { isRecording, startRecording, cancel, pendingKeys, activeKeys } = useRecordHotkey({
    onCapture: useCallback(
      (_sequence, display) => {
        if (editingAction) {
          onChange(editingAction, display.id);
          setEditingAction(null);
        }
      },
      [editingAction, onChange]
    ),
    onCancel: useCallback(() => {
      setEditingAction(null);
    }, [])
  });
  const startEditing = useCallback(
    (action) => {
      setEditingAction(action);
      startRecording();
    },
    [startRecording]
  );
  const cancelEditing = useCallback(() => {
    cancel();
    setEditingAction(null);
  }, [cancel]);
  const reset = useCallback(() => {
    onReset?.();
  }, [onReset]);
  const getRecordingDisplay = () => {
    if (pendingKeys.length === 0 && (!activeKeys || !activeKeys.key)) {
      return "Press keys...";
    }
    let display = pendingKeys.length > 0 ? formatCombination(pendingKeys).display : "";
    if (activeKeys && activeKeys.key) {
      if (display) display += " \u2192 ";
      display += formatCombination([activeKeys]).display;
    }
    return display + "...";
  };
  const bindings = useMemo(() => {
    const allActions = /* @__PURE__ */ new Set([...actionMap.keys(), ...defaultActionMap.keys()]);
    return Array.from(allActions).map((action) => {
      const key = actionMap.get(action) ?? defaultActionMap.get(action) ?? "";
      const defaultKey = defaultActionMap.get(action) ?? "";
      const combo = parseCombinationId(key);
      const display = formatCombination(combo);
      const conflictActions = conflicts.get(key);
      return {
        action,
        key,
        display,
        description: descriptions?.[action] ?? action,
        isDefault: key === defaultKey,
        hasConflict: conflictActions !== void 0 && conflictActions.length > 1
      };
    }).sort((a, b) => a.action.localeCompare(b.action));
  }, [actionMap, defaultActionMap, descriptions, conflicts]);
  if (children) {
    return /* @__PURE__ */ jsx(Fragment, { children: children({
      bindings,
      editingAction,
      pendingKeys,
      activeKeys,
      startEditing,
      cancelEditing,
      reset,
      conflicts
    }) });
  }
  return /* @__PURE__ */ jsxs("div", { className, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }, children: [
      /* @__PURE__ */ jsx("h3", { style: { margin: 0 }, children: "Keybindings" }),
      onReset && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: reset,
          style: {
            padding: "6px 12px",
            backgroundColor: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: "pointer"
          },
          children: "Reset to defaults"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { style: { textAlign: "left", padding: "8px", borderBottom: "2px solid #ddd" }, children: "Action" }),
        /* @__PURE__ */ jsx("th", { style: { textAlign: "left", padding: "8px", borderBottom: "2px solid #ddd" }, children: "Keybinding" }),
        /* @__PURE__ */ jsx("th", { style: { width: "80px", padding: "8px", borderBottom: "2px solid #ddd" } })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: bindings.map(({ action, display, description, isDefault, hasConflict }) => {
        const isEditing = editingAction === action;
        return /* @__PURE__ */ jsxs("tr", { style: { backgroundColor: hasConflict ? "#fff3cd" : void 0 }, children: [
          /* @__PURE__ */ jsxs("td", { style: { padding: "8px", borderBottom: "1px solid #eee" }, children: [
            description,
            !isDefault && /* @__PURE__ */ jsx("span", { style: { marginLeft: "8px", fontSize: "0.75rem", color: "#666" }, children: "(modified)" })
          ] }),
          /* @__PURE__ */ jsxs("td", { style: { padding: "8px", borderBottom: "1px solid #eee" }, children: [
            isEditing ? /* @__PURE__ */ jsx(
              "kbd",
              {
                style: {
                  backgroundColor: "#e3f2fd",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "2px solid #2196f3",
                  fontFamily: "monospace"
                },
                children: getRecordingDisplay()
              }
            ) : /* @__PURE__ */ jsx(
              "kbd",
              {
                style: {
                  backgroundColor: "#f5f5f5",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  fontFamily: "monospace"
                },
                children: display.display
              }
            ),
            hasConflict && !isEditing && /* @__PURE__ */ jsx("span", { style: { marginLeft: "8px", color: "#856404", fontSize: "0.75rem" }, children: "\u26A0 Conflict" })
          ] }),
          /* @__PURE__ */ jsx("td", { style: { padding: "8px", borderBottom: "1px solid #eee", textAlign: "center" }, children: isEditing ? /* @__PURE__ */ jsx(
            "button",
            {
              onClick: cancelEditing,
              style: {
                padding: "4px 8px",
                backgroundColor: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.875rem"
              },
              children: "Cancel"
            }
          ) : /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => startEditing(action),
              disabled: isRecording,
              style: {
                padding: "4px 8px",
                backgroundColor: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: isRecording ? "not-allowed" : "pointer",
                fontSize: "0.875rem",
                opacity: isRecording ? 0.5 : 1
              },
              children: "Edit"
            }
          ) })
        ] }, action);
      }) })
    ] })
  ] });
}
function parseAction(action) {
  const colonIndex = action.indexOf(":");
  if (colonIndex > 0) {
    return { group: action.slice(0, colonIndex), name: action.slice(colonIndex + 1) };
  }
  return { group: "General", name: action };
}
function organizeShortcuts(keymap, descriptions, groupNames) {
  const groupMap = /* @__PURE__ */ new Map();
  for (const [key, actionOrActions] of Object.entries(keymap)) {
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
    for (const action of actions) {
      const { group: groupKey, name } = parseAction(action);
      const groupName = groupNames?.[groupKey] ?? groupKey;
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { name: groupName, shortcuts: [] });
      }
      groupMap.get(groupName).shortcuts.push({
        key,
        action,
        description: descriptions?.[action] ?? name
      });
    }
  }
  return Array.from(groupMap.values()).sort((a, b) => {
    if (a.name === "General") return 1;
    if (b.name === "General") return -1;
    return a.name.localeCompare(b.name);
  });
}
function ShortcutsModal({
  keymap,
  descriptions,
  groups: groupNames,
  isOpen: controlledIsOpen,
  onClose,
  openKey = "?",
  autoRegisterOpen = true,
  children,
  backdropClassName,
  modalClassName
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? internalIsOpen;
  const close = useCallback(() => {
    setInternalIsOpen(false);
    onClose?.();
  }, [onClose]);
  const open = useCallback(() => {
    setInternalIsOpen(true);
  }, []);
  const modalKeymap = autoRegisterOpen ? { [openKey]: "openShortcuts" } : {};
  useHotkeys(
    { ...modalKeymap, escape: "closeShortcuts" },
    {
      openShortcuts: open,
      closeShortcuts: close
    },
    { enabled: autoRegisterOpen || isOpen }
  );
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );
  const shortcutGroups = organizeShortcuts(keymap, descriptions, groupNames);
  if (!isOpen) return null;
  if (children) {
    return /* @__PURE__ */ jsx(Fragment, { children: children({ groups: shortcutGroups, close }) });
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: backdropClassName,
      onClick: handleBackdropClick,
      style: backdropClassName ? void 0 : {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      },
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          className: modalClassName,
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Keyboard shortcuts",
          style: modalClassName ? void 0 : {
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            maxWidth: "600px",
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
          },
          children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }, children: [
              /* @__PURE__ */ jsx("h2", { style: { margin: 0, fontSize: "1.25rem", fontWeight: 600 }, children: "Keyboard Shortcuts" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: close,
                  "aria-label": "Close",
                  style: {
                    background: "none",
                    border: "none",
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    padding: "4px",
                    lineHeight: 1
                  },
                  children: "\xD7"
                }
              )
            ] }),
            shortcutGroups.map((group) => /* @__PURE__ */ jsxs("div", { style: { marginBottom: "16px" }, children: [
              /* @__PURE__ */ jsx("h3", { style: { margin: "0 0 8px", fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: "#666" }, children: group.name }),
              /* @__PURE__ */ jsx("dl", { style: { margin: 0 }, children: group.shortcuts.map(({ key, action, description }) => {
                const combo = parseCombinationId(key);
                const display = formatCombination(combo);
                return /* @__PURE__ */ jsxs(
                  "div",
                  {
                    style: { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #eee" },
                    children: [
                      /* @__PURE__ */ jsx("dt", { style: { color: "#333" }, children: description }),
                      /* @__PURE__ */ jsx("dd", { style: { margin: 0, fontFamily: "monospace", color: "#666" }, children: /* @__PURE__ */ jsx("kbd", { style: { backgroundColor: "#f5f5f5", padding: "2px 6px", borderRadius: "4px", border: "1px solid #ddd" }, children: display.display }) })
                    ]
                  },
                  action
                );
              }) })
            ] }, group.name))
          ]
        }
      )
    }
  );
}

export { KeybindingEditor, KeyboardShortcutsProvider, ShortcutsModal, findConflicts, formatCombination, formatKeyForDisplay, fuzzyMatch, getActionBindings, getConflictsArray, getSequenceCompletions, hasConflicts, isMac, isModifierKey, isSequence, normalizeKey, parseCombinationId, parseHotkeyString, searchActions, useEditableHotkeys, useHotkeys, useKeyboardShortcutsContext, useOmnibar, useRecordHotkey, useRegisteredHotkeys };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map