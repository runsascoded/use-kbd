import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { createContext, forwardRef, useRef, useState, useCallback, useMemo, useEffect, useContext, Fragment as Fragment$1 } from 'react';
import { max, min } from '@rdub/base';

// src/TwoColumnRenderer.tsx
function createTwoColumnRenderer(config) {
  const { headers, getRows } = config;
  const [labelHeader, leftHeader, rightHeader] = headers;
  return function TwoColumnRenderer({ group, renderCell }) {
    const bindingsMap = new Map(
      group.shortcuts.map((s) => [s.actionId, s.bindings])
    );
    const rows = getRows(group);
    return /* @__PURE__ */ jsxs("table", { className: "kbd-table", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { children: labelHeader }),
        /* @__PURE__ */ jsx("th", { children: leftHeader }),
        /* @__PURE__ */ jsx("th", { children: rightHeader })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: rows.map(({ label, leftAction, rightAction }, i) => {
        const leftBindings = bindingsMap.get(leftAction) ?? [];
        const rightBindings = bindingsMap.get(rightAction) ?? [];
        if (leftBindings.length === 0 && rightBindings.length === 0) return null;
        return /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: label }),
          /* @__PURE__ */ jsx("td", { children: leftAction ? renderCell(leftAction, leftBindings) : "-" }),
          /* @__PURE__ */ jsx("td", { children: rightAction ? renderCell(rightAction, rightBindings) : "-" })
        ] }, i);
      }) })
    ] });
  };
}
var ActionsRegistryContext = createContext(null);
function useActionsRegistry(options = {}) {
  const { storageKey } = options;
  const actionsRef = useRef(/* @__PURE__ */ new Map());
  const [actionsVersion, setActionsVersion] = useState(0);
  const [overrides, setOverrides] = useState(() => {
    if (!storageKey || typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [removedDefaults, setRemovedDefaults] = useState(() => {
    if (!storageKey || typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(`${storageKey}-removed`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const isDefaultBinding = useCallback((key, actionId) => {
    const action = actionsRef.current.get(actionId);
    return action?.config.defaultBindings?.includes(key) ?? false;
  }, []);
  const filterRedundantOverrides = useCallback((overrides2) => {
    const filtered = {};
    for (const [key, actionOrActions] of Object.entries(overrides2)) {
      if (actionOrActions === "") {
        continue;
      } else if (Array.isArray(actionOrActions)) {
        const nonDefaultActions = actionOrActions.filter((a) => !isDefaultBinding(key, a));
        if (nonDefaultActions.length > 0) {
          filtered[key] = nonDefaultActions.length === 1 ? nonDefaultActions[0] : nonDefaultActions;
        }
      } else {
        if (!isDefaultBinding(key, actionOrActions)) {
          filtered[key] = actionOrActions;
        }
      }
    }
    return filtered;
  }, [isDefaultBinding]);
  const updateOverrides = useCallback((update) => {
    setOverrides((prev) => {
      const newOverrides = typeof update === "function" ? update(prev) : update;
      const filteredOverrides = filterRedundantOverrides(newOverrides);
      if (storageKey && typeof window !== "undefined") {
        try {
          if (Object.keys(filteredOverrides).length === 0) {
            localStorage.removeItem(storageKey);
          } else {
            localStorage.setItem(storageKey, JSON.stringify(filteredOverrides));
          }
        } catch {
        }
      }
      return filteredOverrides;
    });
  }, [storageKey, filterRedundantOverrides]);
  const updateRemovedDefaults = useCallback((update) => {
    setRemovedDefaults((prev) => {
      const newRemoved = typeof update === "function" ? update(prev) : update;
      const filtered = {};
      for (const [action, keys] of Object.entries(newRemoved)) {
        if (keys.length > 0) {
          filtered[action] = keys;
        }
      }
      if (storageKey && typeof window !== "undefined") {
        try {
          const key = `${storageKey}-removed`;
          if (Object.keys(filtered).length === 0) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        } catch {
        }
      }
      return filtered;
    });
  }, [storageKey]);
  const register = useCallback((id, config) => {
    actionsRef.current.set(id, {
      config,
      registeredAt: Date.now()
    });
    setActionsVersion((v) => v + 1);
  }, []);
  const unregister = useCallback((id) => {
    actionsRef.current.delete(id);
    setActionsVersion((v) => v + 1);
  }, []);
  const execute = useCallback((id) => {
    const action = actionsRef.current.get(id);
    if (action && (action.config.enabled ?? true)) {
      action.config.handler();
    }
  }, []);
  const keymap = useMemo(() => {
    const map = {};
    const addToKey = (key, actionId) => {
      const existing = map[key];
      if (existing) {
        const existingArray = Array.isArray(existing) ? existing : [existing];
        if (!existingArray.includes(actionId)) {
          map[key] = [...existingArray, actionId];
        }
      } else {
        map[key] = actionId;
      }
    };
    for (const [id, { config }] of actionsRef.current) {
      for (const binding of config.defaultBindings ?? []) {
        const removedForAction = removedDefaults[id] ?? [];
        if (removedForAction.includes(binding)) continue;
        addToKey(binding, id);
      }
    }
    for (const [key, actionOrActions] of Object.entries(overrides)) {
      if (actionOrActions === "") {
        continue;
      } else {
        const actions2 = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
        for (const actionId of actions2) {
          addToKey(key, actionId);
        }
      }
    }
    return map;
  }, [actionsVersion, overrides, removedDefaults]);
  const actionRegistry = useMemo(() => {
    const registry = {};
    for (const [id, { config }] of actionsRef.current) {
      registry[id] = {
        label: config.label,
        group: config.group,
        keywords: config.keywords
      };
    }
    return registry;
  }, [actionsVersion]);
  const getBindingsForAction = useCallback((actionId) => {
    const bindings = [];
    for (const [key, action] of Object.entries(keymap)) {
      const actions2 = Array.isArray(action) ? action : [action];
      if (actions2.includes(actionId)) {
        bindings.push(key);
      }
    }
    return bindings;
  }, [keymap]);
  const getFirstBindingForAction = useCallback((actionId) => {
    return getBindingsForAction(actionId)[0];
  }, [getBindingsForAction]);
  const setBinding = useCallback((actionId, key) => {
    if (isDefaultBinding(key, actionId)) {
      updateRemovedDefaults((prev) => {
        const existing = prev[actionId] ?? [];
        if (existing.includes(key)) {
          const filtered = existing.filter((k) => k !== key);
          if (filtered.length === 0) {
            const { [actionId]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [actionId]: filtered };
        }
        return prev;
      });
    } else {
      updateOverrides((prev) => ({
        ...prev,
        [key]: actionId
      }));
    }
  }, [updateOverrides, updateRemovedDefaults, isDefaultBinding]);
  const removeBinding = useCallback((actionId, key) => {
    const action = actionsRef.current.get(actionId);
    const isDefault = action?.config.defaultBindings?.includes(key);
    if (isDefault) {
      updateRemovedDefaults((prev) => {
        const existing = prev[actionId] ?? [];
        if (existing.includes(key)) return prev;
        return { ...prev, [actionId]: [...existing, key] };
      });
    }
    updateOverrides((prev) => {
      const boundAction = prev[key];
      if (boundAction === actionId) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      if (Array.isArray(boundAction) && boundAction.includes(actionId)) {
        const newActions = boundAction.filter((a) => a !== actionId);
        if (newActions.length === 0) {
          const { [key]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [key]: newActions.length === 1 ? newActions[0] : newActions };
      }
      return prev;
    });
  }, [updateOverrides, updateRemovedDefaults]);
  const resetOverrides = useCallback(() => {
    updateOverrides({});
    updateRemovedDefaults({});
  }, [updateOverrides, updateRemovedDefaults]);
  const actions = useMemo(() => {
    return new Map(actionsRef.current);
  }, [actionsVersion]);
  return useMemo(() => ({
    register,
    unregister,
    execute,
    actions,
    keymap,
    actionRegistry,
    getBindingsForAction,
    getFirstBindingForAction,
    overrides,
    setBinding,
    removeBinding,
    resetOverrides
  }), [
    register,
    unregister,
    execute,
    actions,
    keymap,
    actionRegistry,
    getBindingsForAction,
    getFirstBindingForAction,
    overrides,
    setBinding,
    removeBinding,
    resetOverrides
  ]);
}

// src/constants.ts
var DEFAULT_SEQUENCE_TIMEOUT = 1e3;
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
function formatBinding(binding) {
  const parsed = parseHotkeyString(binding);
  return formatCombination(parsed).display;
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
  if (str.length === 1 && /^[A-Z]$/.test(str)) {
    return {
      key: str.toLowerCase(),
      modifiers: { ctrl: false, alt: false, shift: true, meta: false }
    };
  }
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
  const stackNone = actionToKeys.get("stack:none");
  const regionNyc = actionToKeys.get("region:nyc");
  if (stackNone || regionNyc) {
    console.log("getActionBindings:", { "stack:none": stackNone, "region:nyc": regionNyc });
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
    const groupMatch = action.group ? fuzzyMatch(query, action.group) : { matched: false, score: 0};
    const idMatch = fuzzyMatch(query, id);
    let keywordScore = 0;
    if (action.keywords) {
      for (const keyword of action.keywords) {
        const kwMatch = fuzzyMatch(query, keyword);
        if (kwMatch.matched) {
          keywordScore = max(keywordScore, kwMatch.score);
        }
      }
    }
    const matched = labelMatch.matched || descMatch.matched || groupMatch.matched || idMatch.matched || keywordScore > 0;
    if (!matched && query) continue;
    const score = (labelMatch.matched ? labelMatch.score * 3 : 0) + (descMatch.matched ? descMatch.score * 1.5 : 0) + (groupMatch.matched ? groupMatch.score * 1 : 0) + (idMatch.matched ? idMatch.score * 0.5 : 0) + keywordScore * 2;
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
    sequenceTimeout = DEFAULT_SEQUENCE_TIMEOUT,
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
        const isTextInput = eventTarget instanceof HTMLInputElement && ["text", "email", "password", "search", "tel", "url", "number", "date", "datetime-local", "month", "time", "week"].includes(eventTarget.type);
        if (isTextInput || eventTarget instanceof HTMLTextAreaElement || eventTarget instanceof HTMLSelectElement || eventTarget.isContentEditable) {
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
          if (Number.isFinite(sequenceTimeout)) {
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
          }
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
          if (Number.isFinite(sequenceTimeout)) {
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
var HotkeysContext = createContext(null);
var DEFAULT_CONFIG = {
  storageKey: "use-kbd",
  sequenceTimeout: DEFAULT_SEQUENCE_TIMEOUT,
  disableConflicts: true,
  minViewportWidth: 768,
  enableOnTouch: false,
  modalTrigger: "?",
  omnibarTrigger: "meta+k"
};
function HotkeysProvider({
  config: configProp = {},
  children
}) {
  const config = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...configProp
  }), [configProp]);
  const registry = useActionsRegistry({ storageKey: config.storageKey });
  const [isEnabled, setIsEnabled] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkEnabled = () => {
      if (config.minViewportWidth !== false) {
        if (window.innerWidth < config.minViewportWidth) {
          setIsEnabled(false);
          return;
        }
      }
      if (!config.enableOnTouch) {
        const hasHover = window.matchMedia("(hover: hover)").matches;
        if (!hasHover) {
          setIsEnabled(false);
          return;
        }
      }
      setIsEnabled(true);
    };
    checkEnabled();
    window.addEventListener("resize", checkEnabled);
    return () => window.removeEventListener("resize", checkEnabled);
  }, [config.minViewportWidth, config.enableOnTouch]);
  const modalStorageKey = `${config.storageKey}-modal-open`;
  const [isModalOpen, setIsModalOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(modalStorageKey) === "true";
  });
  useEffect(() => {
    sessionStorage.setItem(modalStorageKey, String(isModalOpen));
  }, [modalStorageKey, isModalOpen]);
  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const toggleModal = useCallback(() => setIsModalOpen((prev) => !prev), []);
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false);
  const openOmnibar = useCallback(() => setIsOmnibarOpen(true), []);
  const closeOmnibar = useCallback(() => setIsOmnibarOpen(false), []);
  const toggleOmnibar = useCallback(() => setIsOmnibarOpen((prev) => !prev), []);
  const keymap = useMemo(() => {
    const map = { ...registry.keymap };
    if (config.modalTrigger !== false) {
      map[config.modalTrigger] = "__hotkeys:modal";
    }
    if (config.omnibarTrigger !== false) {
      map[config.omnibarTrigger] = "__hotkeys:omnibar";
    }
    return map;
  }, [registry.keymap, config.modalTrigger, config.omnibarTrigger]);
  const conflicts = useMemo(() => findConflicts(keymap), [keymap]);
  const hasConflicts2 = conflicts.size > 0;
  const effectiveKeymap = useMemo(() => {
    if (!config.disableConflicts || conflicts.size === 0) {
      return keymap;
    }
    const filtered = {};
    for (const [key, action] of Object.entries(keymap)) {
      if (!conflicts.has(key)) {
        filtered[key] = action;
      }
    }
    return filtered;
  }, [keymap, conflicts, config.disableConflicts]);
  const handlers = useMemo(() => {
    const map = {};
    for (const [id, action] of registry.actions) {
      map[id] = action.config.handler;
    }
    map["__hotkeys:modal"] = toggleModal;
    map["__hotkeys:omnibar"] = toggleOmnibar;
    return map;
  }, [registry.actions, toggleModal, toggleOmnibar]);
  const hotkeysEnabled = isEnabled && !isModalOpen && !isOmnibarOpen;
  const {
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    timeoutStartedAt: sequenceTimeoutStartedAt,
    sequenceTimeout
  } = useHotkeys(effectiveKeymap, handlers, {
    enabled: hotkeysEnabled,
    sequenceTimeout: config.sequenceTimeout
  });
  const searchActionsHelper = useCallback(
    (query) => searchActions(query, registry.actionRegistry, keymap),
    [registry.actionRegistry, keymap]
  );
  const getCompletions = useCallback(
    (pending) => getSequenceCompletions(pending, keymap),
    [keymap]
  );
  const value = useMemo(() => ({
    registry,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    executeAction: registry.execute,
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    sequenceTimeoutStartedAt,
    sequenceTimeout,
    conflicts,
    hasConflicts: hasConflicts2,
    searchActions: searchActionsHelper,
    getCompletions
  }), [
    registry,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    sequenceTimeoutStartedAt,
    sequenceTimeout,
    conflicts,
    hasConflicts2,
    searchActionsHelper,
    getCompletions
  ]);
  return /* @__PURE__ */ jsx(ActionsRegistryContext.Provider, { value: registry, children: /* @__PURE__ */ jsx(HotkeysContext.Provider, { value, children }) });
}
function useHotkeysContext() {
  const context = useContext(HotkeysContext);
  if (!context) {
    throw new Error("useHotkeysContext must be used within a HotkeysProvider");
  }
  return context;
}
function useMaybeHotkeysContext() {
  return useContext(HotkeysContext);
}
function useAction(id, config) {
  const registry = useContext(ActionsRegistryContext);
  if (!registry) {
    throw new Error("useAction must be used within a HotkeysProvider");
  }
  const registryRef = useRef(registry);
  registryRef.current = registry;
  const handlerRef = useRef(config.handler);
  handlerRef.current = config.handler;
  const enabledRef = useRef(config.enabled ?? true);
  enabledRef.current = config.enabled ?? true;
  useEffect(() => {
    registryRef.current.register(id, {
      ...config,
      handler: () => {
        if (enabledRef.current) {
          handlerRef.current();
        }
      }
    });
    return () => {
      registryRef.current.unregister(id);
    };
  }, [
    id,
    config.label,
    config.group,
    // Compare bindings by value
    JSON.stringify(config.defaultBindings),
    JSON.stringify(config.keywords),
    config.priority
  ]);
}
function useActions(actions) {
  const registry = useContext(ActionsRegistryContext);
  if (!registry) {
    throw new Error("useActions must be used within a HotkeysProvider");
  }
  const registryRef = useRef(registry);
  registryRef.current = registry;
  const handlersRef = useRef({});
  const enabledRef = useRef({});
  for (const [id, config] of Object.entries(actions)) {
    handlersRef.current[id] = config.handler;
    enabledRef.current[id] = config.enabled ?? true;
  }
  useEffect(() => {
    for (const [id, config] of Object.entries(actions)) {
      registryRef.current.register(id, {
        ...config,
        handler: () => {
          if (enabledRef.current[id]) {
            handlersRef.current[id]?.();
          }
        }
      });
    }
    return () => {
      for (const id of Object.keys(actions)) {
        registryRef.current.unregister(id);
      }
    };
  }, [
    // Re-register if action set changes
    JSON.stringify(
      Object.entries(actions).map(([id, c]) => [
        id,
        c.label,
        c.group,
        c.defaultBindings,
        c.keywords,
        c.priority
      ])
    )
  ]);
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
    onTab: onTabProp,
    onShiftTab: onShiftTabProp,
    preventDefault = true,
    sequenceTimeout = DEFAULT_SEQUENCE_TIMEOUT,
    pauseTimeout = false
  } = options;
  const onCapture = useEventCallback(onCaptureProp);
  const onCancel = useEventCallback(onCancelProp);
  const onTab = useEventCallback(onTabProp);
  const onShiftTab = useEventCallback(onShiftTabProp);
  const [isRecording, setIsRecording] = useState(false);
  const [sequence, setSequence] = useState(null);
  const [pendingKeys, setPendingKeys] = useState([]);
  const [activeKeys, setActiveKeys] = useState(null);
  const pressedKeysRef = useRef(/* @__PURE__ */ new Set());
  const hasNonModifierRef = useRef(false);
  const currentComboRef = useRef(null);
  const timeoutRef = useRef(null);
  const pauseTimeoutRef = useRef(pauseTimeout);
  pauseTimeoutRef.current = pauseTimeout;
  const pendingKeysRef = useRef([]);
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
    pendingKeysRef.current = [];
    setPendingKeys([]);
    setIsRecording(false);
    setActiveKeys(null);
    onCapture?.(seq, display2);
  }, [clearTimeout_, onCapture]);
  const cancel = useCallback(() => {
    clearTimeout_();
    setIsRecording(false);
    pendingKeysRef.current = [];
    setPendingKeys([]);
    setActiveKeys(null);
    pressedKeysRef.current.clear();
    hasNonModifierRef.current = false;
    currentComboRef.current = null;
    onCancel?.();
  }, [clearTimeout_, onCancel]);
  const commit = useCallback(() => {
    const current = pendingKeysRef.current;
    if (current.length > 0) {
      submit(current);
    } else {
      cancel();
    }
  }, [submit, cancel]);
  const startRecording = useCallback(() => {
    clearTimeout_();
    setIsRecording(true);
    setSequence(null);
    pendingKeysRef.current = [];
    setPendingKeys([]);
    setActiveKeys(null);
    pressedKeysRef.current.clear();
    hasNonModifierRef.current = false;
    currentComboRef.current = null;
    return cancel;
  }, [cancel, clearTimeout_]);
  useEffect(() => {
    if (pauseTimeout) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else if (isRecording && pendingKeysRef.current.length > 0 && !timeoutRef.current) {
      const currentSequence = pendingKeysRef.current;
      if (sequenceTimeout === 0) {
        submit(currentSequence);
      } else if (Number.isFinite(sequenceTimeout)) {
        timeoutRef.current = setTimeout(() => {
          submit(currentSequence);
        }, sequenceTimeout);
      }
    }
  }, [pauseTimeout, isRecording, sequenceTimeout, submit]);
  useEffect(() => {
    if (!isRecording) return;
    const handleKeyDown = (e) => {
      if (e.key === "Tab") {
        clearTimeout_();
        const pendingSeq = [...pendingKeysRef.current];
        if (hasNonModifierRef.current && currentComboRef.current) {
          pendingSeq.push(currentComboRef.current);
        }
        pendingKeysRef.current = [];
        setPendingKeys([]);
        pressedKeysRef.current.clear();
        hasNonModifierRef.current = false;
        currentComboRef.current = null;
        setActiveKeys(null);
        setIsRecording(false);
        if (pendingSeq.length > 0) {
          const display2 = formatCombination(pendingSeq);
          onCapture?.(pendingSeq, display2);
        }
        if (!e.shiftKey && onTab) {
          e.preventDefault();
          e.stopPropagation();
          onTab();
        } else if (e.shiftKey && onShiftTab) {
          e.preventDefault();
          e.stopPropagation();
          onShiftTab();
        }
        return;
      }
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
      let key = e.key;
      if (e.altKey && e.code.startsWith("Key")) {
        key = e.code.slice(3).toLowerCase();
      } else if (e.altKey && e.code.startsWith("Digit")) {
        key = e.code.slice(5);
      }
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
      let key = e.key;
      if (e.altKey && e.code.startsWith("Key")) {
        key = e.code.slice(3).toLowerCase();
      } else if (e.altKey && e.code.startsWith("Digit")) {
        key = e.code.slice(5);
      }
      pressedKeysRef.current.delete(key);
      const shouldComplete = pressedKeysRef.current.size === 0 || e.key === "Meta" && hasNonModifierRef.current;
      if (shouldComplete && hasNonModifierRef.current && currentComboRef.current) {
        const combo = currentComboRef.current;
        pressedKeysRef.current.clear();
        hasNonModifierRef.current = false;
        currentComboRef.current = null;
        setActiveKeys(null);
        const newSequence = [...pendingKeysRef.current, combo];
        pendingKeysRef.current = newSequence;
        setPendingKeys(newSequence);
        clearTimeout_();
        if (sequenceTimeout === 0) {
          submit(newSequence);
        } else if (!pauseTimeoutRef.current && Number.isFinite(sequenceTimeout)) {
          timeoutRef.current = setTimeout(() => {
            submit(newSequence);
          }, sequenceTimeout);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      clearTimeout_();
    };
  }, [isRecording, preventDefault, sequenceTimeout, clearTimeout_, submit, cancel, onCapture, onTab, onShiftTab]);
  const display = sequence ? formatCombination(sequence) : null;
  const combination = sequence && sequence.length > 0 ? sequence[0] : null;
  return {
    isRecording,
    startRecording,
    cancel,
    commit,
    sequence,
    display,
    pendingKeys,
    activeKeys,
    sequenceTimeout,
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
    setSelectedIndex((prev) => min(prev + 1, results.length - 1));
  }, [results.length]);
  const selectPrev = useCallback(() => {
    setSelectedIndex((prev) => max(prev - 1, 0));
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
var baseStyle = {
  width: "1em",
  height: "1em",
  verticalAlign: "middle"
};
function Up({ className, style }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className,
      style: { ...baseStyle, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx("path", { d: "M12 19V5M5 12l7-7 7 7" })
    }
  );
}
function Down({ className, style }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className,
      style: { ...baseStyle, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12l7 7 7-7" })
    }
  );
}
function Left({ className, style }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className,
      style: { ...baseStyle, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx("path", { d: "M19 12H5M12 5l-7 7 7 7" })
    }
  );
}
function Right({ className, style }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className,
      style: { ...baseStyle, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx("path", { d: "M5 12h14M12 5l7 7-7 7" })
    }
  );
}
function Enter({ className, style }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      style: { ...baseStyle, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M9 10l-4 4 4 4" }),
        /* @__PURE__ */ jsx("path", { d: "M19 6v8a2 2 0 01-2 2H5" })
      ]
    }
  );
}
function Backspace({ className, style }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      style: { ...baseStyle, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" }),
        /* @__PURE__ */ jsx("line", { x1: "18", y1: "9", x2: "12", y2: "15" }),
        /* @__PURE__ */ jsx("line", { x1: "12", y1: "9", x2: "18", y2: "15" })
      ]
    }
  );
}
function getKeyIcon(key) {
  switch (key.toLowerCase()) {
    case "arrowup":
      return Up;
    case "arrowdown":
      return Down;
    case "arrowleft":
      return Left;
    case "arrowright":
      return Right;
    case "enter":
      return Enter;
    case "backspace":
      return Backspace;
    default:
      return null;
  }
}
var baseStyle2 = {
  width: "1.2em",
  height: "1.2em",
  marginRight: "2px",
  verticalAlign: "middle"
};
var wideStyle = {
  ...baseStyle2,
  width: "1.4em"
};
var Command = forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsx(
    "svg",
    {
      ref,
      className,
      style: { ...baseStyle2, ...style },
      viewBox: "0 0 24 24",
      fill: "currentColor",
      ...props,
      children: /* @__PURE__ */ jsx("path", { d: "M6 4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v4H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2h4v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2v-4h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2h-4V6a2 2 0 0 0-2-2H6zm4 6h4v4h-4v-4z" })
    }
  )
);
Command.displayName = "Command";
var Ctrl = forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsx(
    "svg",
    {
      ref,
      className,
      style: { ...baseStyle2, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
      children: /* @__PURE__ */ jsx("path", { d: "M6 15l6-6 6 6" })
    }
  )
);
Ctrl.displayName = "Ctrl";
var Shift = forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsx(
    "svg",
    {
      ref,
      className,
      style: { ...wideStyle, ...style },
      viewBox: "0 0 28 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinejoin: "round",
      ...props,
      children: /* @__PURE__ */ jsx("path", { d: "M14 3L3 14h6v7h10v-7h6L14 3z" })
    }
  )
);
Shift.displayName = "Shift";
var Option = forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsx(
    "svg",
    {
      ref,
      className,
      style: { ...baseStyle2, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
      children: /* @__PURE__ */ jsx("path", { d: "M4 6h6l8 12h6M14 6h6" })
    }
  )
);
Option.displayName = "Option";
var Alt = forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsx(
    "svg",
    {
      ref,
      className,
      style: { ...baseStyle2, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
      children: /* @__PURE__ */ jsx("path", { d: "M4 18h8M12 18l4-6M12 18l4 0M16 12l4-6h-8" })
    }
  )
);
Alt.displayName = "Alt";
var isMac2 = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
function getModifierIcon(modifier) {
  switch (modifier) {
    case "meta":
      return Command;
    case "ctrl":
      return Ctrl;
    case "shift":
      return Shift;
    case "opt":
      return Option;
    case "alt":
      return isMac2 ? Option : Alt;
  }
}
var ModifierIcon = forwardRef(
  ({ modifier, ...props }, ref) => {
    const Icon = getModifierIcon(modifier);
    return /* @__PURE__ */ jsx(Icon, { ref, ...props });
  }
);
ModifierIcon.displayName = "ModifierIcon";
function KeyCombo({ combo }) {
  const { key, modifiers } = combo;
  const parts = [];
  if (modifiers.meta) {
    parts.push(/* @__PURE__ */ jsx(ModifierIcon, { modifier: "meta", className: "kbd-modifier-icon" }, "meta"));
  }
  if (modifiers.ctrl) {
    parts.push(/* @__PURE__ */ jsx(ModifierIcon, { modifier: "ctrl", className: "kbd-modifier-icon" }, "ctrl"));
  }
  if (modifiers.alt) {
    parts.push(/* @__PURE__ */ jsx(ModifierIcon, { modifier: "alt", className: "kbd-modifier-icon" }, "alt"));
  }
  if (modifiers.shift) {
    parts.push(/* @__PURE__ */ jsx(ModifierIcon, { modifier: "shift", className: "kbd-modifier-icon" }, "shift"));
  }
  const KeyIcon = getKeyIcon(key);
  if (KeyIcon) {
    parts.push(/* @__PURE__ */ jsx(KeyIcon, { className: "kbd-key-icon" }, "key"));
  } else {
    parts.push(/* @__PURE__ */ jsx("span", { children: formatKeyForDisplay(key) }, "key"));
  }
  return /* @__PURE__ */ jsx(Fragment, { children: parts });
}
function BindingDisplay({ binding }) {
  const sequence = parseHotkeyString(binding);
  return /* @__PURE__ */ jsx(Fragment, { children: sequence.map((combo, i) => /* @__PURE__ */ jsxs(Fragment$1, { children: [
    i > 0 && /* @__PURE__ */ jsx("span", { className: "kbd-sequence-sep", children: " " }),
    /* @__PURE__ */ jsx(KeyCombo, { combo })
  ] }, i)) });
}
function Kbd({
  action,
  separator = " / ",
  first = false,
  fallback = null,
  className,
  clickable = true
}) {
  const ctx = useMaybeHotkeysContext();
  const warnedRef = useRef(false);
  const bindings = ctx ? first ? [ctx.registry.getFirstBindingForAction(action)].filter(Boolean) : ctx.registry.getBindingsForAction(action) : [];
  useEffect(() => {
    if (!ctx) return;
    if (warnedRef.current) return;
    const timer = setTimeout(() => {
      if (!ctx.registry.actions.has(action)) {
        console.warn(`Kbd: Action "${action}" not found in registry`);
        warnedRef.current = true;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [ctx, action]);
  if (!ctx) {
    return null;
  }
  if (bindings.length === 0) {
    return /* @__PURE__ */ jsx(Fragment, { children: fallback });
  }
  const content = bindings.map((binding, i) => /* @__PURE__ */ jsxs(Fragment$1, { children: [
    i > 0 && separator,
    /* @__PURE__ */ jsx(BindingDisplay, { binding })
  ] }, binding));
  if (clickable) {
    return /* @__PURE__ */ jsx(
      "kbd",
      {
        className: `${className || ""} kbd-clickable`.trim(),
        onClick: () => ctx.executeAction(action),
        role: "button",
        tabIndex: 0,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            ctx.executeAction(action);
          }
        },
        children: content
      }
    );
  }
  return /* @__PURE__ */ jsx("kbd", { className, children: content });
}
function Key(props) {
  return /* @__PURE__ */ jsx(Kbd, { ...props, clickable: false });
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
function BindingBadge({ binding }) {
  const sequence = parseHotkeyString(binding);
  return /* @__PURE__ */ jsx("kbd", { className: "kbd-kbd", children: sequence.map((combo, i) => /* @__PURE__ */ jsxs(Fragment$1, { children: [
    i > 0 && /* @__PURE__ */ jsx("span", { className: "kbd-sequence-sep", children: " " }),
    combo.modifiers.meta && /* @__PURE__ */ jsx(ModifierIcon, { modifier: "meta", className: "kbd-modifier-icon" }),
    combo.modifiers.ctrl && /* @__PURE__ */ jsx(ModifierIcon, { modifier: "ctrl", className: "kbd-modifier-icon" }),
    combo.modifiers.alt && /* @__PURE__ */ jsx(ModifierIcon, { modifier: "alt", className: "kbd-modifier-icon" }),
    combo.modifiers.shift && /* @__PURE__ */ jsx(ModifierIcon, { modifier: "shift", className: "kbd-modifier-icon" }),
    /* @__PURE__ */ jsx("span", { children: combo.key.length === 1 ? combo.key.toUpperCase() : combo.key })
  ] }, i)) });
}
function Omnibar({
  actions: actionsProp,
  handlers: handlersProp,
  keymap: keymapProp,
  openKey = "meta+k",
  enabled: enabledProp,
  isOpen: isOpenProp,
  onOpen: onOpenProp,
  onClose: onCloseProp,
  onExecute: onExecuteProp,
  maxResults = 10,
  placeholder = "Type a command...",
  children,
  backdropClassName = "kbd-omnibar-backdrop",
  omnibarClassName = "kbd-omnibar"
}) {
  const inputRef = useRef(null);
  const ctx = useMaybeHotkeysContext();
  const actions = actionsProp ?? ctx?.registry.actionRegistry ?? {};
  const keymap = keymapProp ?? ctx?.registry.keymap ?? {};
  const enabled = enabledProp ?? !ctx;
  const handleExecute = useCallback((actionId) => {
    if (onExecuteProp) {
      onExecuteProp(actionId);
    } else if (ctx?.executeAction) {
      ctx.executeAction(actionId);
    }
  }, [onExecuteProp, ctx]);
  const handleClose = useCallback(() => {
    if (onCloseProp) {
      onCloseProp();
    } else if (ctx?.closeOmnibar) {
      ctx.closeOmnibar();
    }
  }, [onCloseProp, ctx]);
  const handleOpen = useCallback(() => {
    if (onOpenProp) {
      onOpenProp();
    } else if (ctx?.openOmnibar) {
      ctx.openOmnibar();
    }
  }, [onOpenProp, ctx]);
  const {
    isOpen: internalIsOpen,
    close,
    query,
    setQuery,
    results,
    selectedIndex,
    selectNext,
    selectPrev,
    execute,
    completions,
    pendingKeys,
    isAwaitingSequence
  } = useOmnibar({
    actions,
    handlers: handlersProp,
    keymap,
    openKey,
    enabled: isOpenProp === void 0 && ctx === null ? enabled : false,
    // Disable hotkey if controlled or using context
    onOpen: handleOpen,
    onClose: handleClose,
    onExecute: handleExecute,
    maxResults
  });
  const isOpen = isOpenProp ?? ctx?.isOmnibarOpen ?? internalIsOpen;
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [isOpen, close]);
  const handleKeyDown = useCallback(
    (e) => {
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
    },
    [close, selectNext, selectPrev, execute]
  );
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );
  if (!isOpen) return null;
  if (children) {
    return /* @__PURE__ */ jsx(Fragment, { children: children({
      query,
      setQuery,
      results,
      selectedIndex,
      selectNext,
      selectPrev,
      execute,
      close,
      completions,
      pendingKeys,
      isAwaitingSequence,
      inputRef
    }) });
  }
  return /* @__PURE__ */ jsx("div", { className: backdropClassName, onClick: handleBackdropClick, children: /* @__PURE__ */ jsxs("div", { className: omnibarClassName, role: "dialog", "aria-modal": "true", "aria-label": "Command palette", children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: inputRef,
        type: "text",
        className: "kbd-omnibar-input",
        value: query,
        onChange: (e) => setQuery(e.target.value),
        onKeyDown: handleKeyDown,
        placeholder,
        autoComplete: "off",
        autoCorrect: "off",
        autoCapitalize: "off",
        spellCheck: false
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "kbd-omnibar-results", children: results.length === 0 ? /* @__PURE__ */ jsx("div", { className: "kbd-omnibar-no-results", children: query ? "No matching commands" : "Start typing to search commands..." }) : results.map((result, i) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: `kbd-omnibar-result ${i === selectedIndex ? "selected" : ""}`,
        onClick: () => execute(result.id),
        onMouseEnter: () => {
        },
        children: [
          /* @__PURE__ */ jsx("span", { className: "kbd-omnibar-result-label", children: result.action.label }),
          result.action.group && /* @__PURE__ */ jsx("span", { className: "kbd-omnibar-result-category", children: result.action.group }),
          result.bindings.length > 0 && /* @__PURE__ */ jsx("div", { className: "kbd-omnibar-result-bindings", children: result.bindings.slice(0, 2).map((binding) => /* @__PURE__ */ jsx(BindingBadge, { binding }, binding)) })
        ]
      },
      result.id
    )) })
  ] }) });
}
function SequenceModal() {
  const {
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    sequenceTimeoutStartedAt: timeoutStartedAt,
    sequenceTimeout,
    getCompletions,
    registry
  } = useHotkeysContext();
  const completions = useMemo(() => {
    if (pendingKeys.length === 0) return [];
    return getCompletions(pendingKeys);
  }, [getCompletions, pendingKeys]);
  const formattedPendingKeys = useMemo(() => {
    if (pendingKeys.length === 0) return "";
    return formatCombination(pendingKeys).display;
  }, [pendingKeys]);
  const getActionLabel = (actionId) => {
    const action = registry.actions.get(actionId);
    return action?.config.label || actionId;
  };
  const groupedCompletions = useMemo(() => {
    const byNextKey = /* @__PURE__ */ new Map();
    for (const c of completions) {
      const existing = byNextKey.get(c.nextKeys);
      if (existing) {
        existing.push(c);
      } else {
        byNextKey.set(c.nextKeys, [c]);
      }
    }
    return byNextKey;
  }, [completions]);
  if (!isAwaitingSequence || pendingKeys.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsx("div", { className: "kbd-sequence-backdrop", onClick: cancelSequence, children: /* @__PURE__ */ jsxs("div", { className: "kbd-sequence", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs("div", { className: "kbd-sequence-current", children: [
      /* @__PURE__ */ jsx("kbd", { className: "kbd-sequence-keys", children: formattedPendingKeys }),
      /* @__PURE__ */ jsx("span", { className: "kbd-sequence-ellipsis", children: "\u2026" })
    ] }),
    timeoutStartedAt && /* @__PURE__ */ jsx(
      "div",
      {
        className: "kbd-sequence-timeout",
        style: { animationDuration: `${sequenceTimeout}ms` }
      },
      timeoutStartedAt
    ),
    completions.length > 0 && /* @__PURE__ */ jsx("div", { className: "kbd-sequence-completions", children: Array.from(groupedCompletions.entries()).map(([nextKey, comps]) => /* @__PURE__ */ jsxs("div", { className: "kbd-sequence-completion", children: [
      /* @__PURE__ */ jsx("kbd", { className: "kbd-kbd", children: nextKey.toUpperCase() }),
      /* @__PURE__ */ jsx("span", { className: "kbd-sequence-arrow", children: "\u2192" }),
      /* @__PURE__ */ jsx("span", { className: "kbd-sequence-actions", children: comps.flatMap((c) => c.actions).map((action, i) => /* @__PURE__ */ jsxs("span", { children: [
        i > 0 && ", ",
        getActionLabel(action)
      ] }, action)) })
    ] }, nextKey)) }),
    completions.length === 0 && /* @__PURE__ */ jsx("div", { className: "kbd-sequence-empty", children: "No matching shortcuts" })
  ] }) });
}
function parseActionId(actionId) {
  const colonIndex = actionId.indexOf(":");
  if (colonIndex > 0) {
    return { group: actionId.slice(0, colonIndex), name: actionId.slice(colonIndex + 1) };
  }
  return { group: "General", name: actionId };
}
function organizeShortcuts(keymap, labels, descriptions, groupNames, groupOrder, actionRegistry, showUnbound = true) {
  const actionBindings = getActionBindings(keymap);
  const groupMap = /* @__PURE__ */ new Map();
  const includedActions = /* @__PURE__ */ new Set();
  const getGroupName = (actionId) => {
    const registeredGroup = actionRegistry?.[actionId]?.group;
    if (registeredGroup) return registeredGroup;
    const { group: groupKey } = parseActionId(actionId);
    return groupNames?.[groupKey] ?? groupKey;
  };
  for (const [actionId, bindings] of actionBindings) {
    includedActions.add(actionId);
    const { name } = parseActionId(actionId);
    const groupName = getGroupName(actionId);
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, { name: groupName, shortcuts: [] });
    }
    groupMap.get(groupName).shortcuts.push({
      actionId,
      label: labels?.[actionId] ?? actionRegistry?.[actionId]?.label ?? name,
      description: descriptions?.[actionId],
      bindings
    });
  }
  if (actionRegistry && showUnbound) {
    for (const [actionId, action] of Object.entries(actionRegistry)) {
      if (includedActions.has(actionId)) continue;
      const { name } = parseActionId(actionId);
      const groupName = getGroupName(actionId);
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { name: groupName, shortcuts: [] });
      }
      groupMap.get(groupName).shortcuts.push({
        actionId,
        label: labels?.[actionId] ?? action.label ?? name,
        description: descriptions?.[actionId],
        bindings: []
        // No bindings
      });
    }
  }
  for (const group of groupMap.values()) {
    group.shortcuts.sort((a, b) => a.actionId.localeCompare(b.actionId));
  }
  const groups = Array.from(groupMap.values());
  if (groupOrder) {
    groups.sort((a, b) => {
      const aIdx = groupOrder.indexOf(a.name);
      const bIdx = groupOrder.indexOf(b.name);
      if (aIdx === -1 && bIdx === -1) return a.name.localeCompare(b.name);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  } else {
    groups.sort((a, b) => {
      if (a.name === "General") return 1;
      if (b.name === "General") return -1;
      return a.name.localeCompare(b.name);
    });
  }
  return groups;
}
function KeyDisplay({
  combo,
  className
}) {
  const { key, modifiers } = combo;
  const parts = [];
  if (modifiers.meta) {
    parts.push(/* @__PURE__ */ jsx(ModifierIcon, { modifier: "meta", className: "kbd-modifier-icon" }, "meta"));
  }
  if (modifiers.ctrl) {
    parts.push(/* @__PURE__ */ jsx(ModifierIcon, { modifier: "ctrl", className: "kbd-modifier-icon" }, "ctrl"));
  }
  if (modifiers.alt) {
    parts.push(/* @__PURE__ */ jsx(ModifierIcon, { modifier: "alt", className: "kbd-modifier-icon" }, "alt"));
  }
  if (modifiers.shift) {
    parts.push(/* @__PURE__ */ jsx(ModifierIcon, { modifier: "shift", className: "kbd-modifier-icon" }, "shift"));
  }
  const KeyIcon = getKeyIcon(key);
  if (KeyIcon) {
    parts.push(/* @__PURE__ */ jsx(KeyIcon, { className: "kbd-key-icon" }, "key"));
  } else {
    parts.push(/* @__PURE__ */ jsx("span", { children: formatKeyForDisplay(key) }, "key"));
  }
  return /* @__PURE__ */ jsx("span", { className, children: parts });
}
function BindingDisplay2({
  binding,
  className,
  editable,
  isEditing,
  isConflict,
  isPendingConflict,
  isDefault,
  onEdit,
  onRemove,
  pendingKeys,
  activeKeys,
  timeoutDuration = DEFAULT_SEQUENCE_TIMEOUT
}) {
  const sequence = parseHotkeyString(binding);
  const display = formatCombination(sequence);
  let kbdClassName = "kbd-kbd";
  if (editable && !isEditing) kbdClassName += " editable";
  if (isEditing) kbdClassName += " editing";
  if (isConflict) kbdClassName += " conflict";
  if (isPendingConflict) kbdClassName += " pending-conflict";
  if (isDefault) kbdClassName += " default-binding";
  if (className) kbdClassName += " " + className;
  const handleClick = editable && onEdit ? onEdit : void 0;
  if (isEditing) {
    let content;
    if (pendingKeys && pendingKeys.length > 0) {
      content = /* @__PURE__ */ jsxs(Fragment, { children: [
        pendingKeys.map((combo, i) => /* @__PURE__ */ jsxs(Fragment$1, { children: [
          i > 0 && /* @__PURE__ */ jsx("span", { className: "kbd-sequence-sep", children: " " }),
          /* @__PURE__ */ jsx(KeyDisplay, { combo })
        ] }, i)),
        activeKeys && activeKeys.key && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "kbd-sequence-sep", children: " \u2192 " }),
          /* @__PURE__ */ jsx(KeyDisplay, { combo: activeKeys })
        ] }),
        /* @__PURE__ */ jsx("span", { children: "..." })
      ] });
    } else if (activeKeys && activeKeys.key) {
      content = /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(KeyDisplay, { combo: activeKeys }),
        /* @__PURE__ */ jsx("span", { children: "..." })
      ] });
    } else {
      content = "...";
    }
    return /* @__PURE__ */ jsxs("kbd", { className: kbdClassName, tabIndex: editable ? 0 : void 0, children: [
      content,
      pendingKeys && pendingKeys.length > 0 && Number.isFinite(timeoutDuration) && /* @__PURE__ */ jsx(
        "span",
        {
          className: "kbd-timeout-bar",
          style: { animationDuration: `${timeoutDuration}ms` }
        },
        pendingKeys.length
      )
    ] });
  }
  return /* @__PURE__ */ jsxs("kbd", { className: kbdClassName, onClick: handleClick, tabIndex: editable ? 0 : void 0, onKeyDown: editable && onEdit ? (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onEdit();
    }
  } : void 0, children: [
    display.isSequence ? sequence.map((combo, i) => /* @__PURE__ */ jsxs(Fragment$1, { children: [
      i > 0 && /* @__PURE__ */ jsx("span", { className: "kbd-sequence-sep", children: " " }),
      /* @__PURE__ */ jsx(KeyDisplay, { combo })
    ] }, i)) : /* @__PURE__ */ jsx(KeyDisplay, { combo: sequence[0] }),
    editable && onRemove && /* @__PURE__ */ jsx(
      "button",
      {
        className: "kbd-remove-btn",
        onClick: (e) => {
          e.stopPropagation();
          onRemove();
        },
        "aria-label": "Remove binding",
        children: "\xD7"
      }
    )
  ] });
}
function ShortcutsModal({
  keymap: keymapProp,
  defaults: defaultsProp,
  labels: labelsProp,
  descriptions: descriptionsProp,
  groups: groupNamesProp,
  groupOrder,
  groupRenderers,
  isOpen: isOpenProp,
  onClose: onCloseProp,
  openKey = "?",
  autoRegisterOpen,
  editable = false,
  onBindingChange,
  onBindingAdd,
  onBindingRemove,
  onReset,
  multipleBindings = true,
  children,
  backdropClassName = "kbd-backdrop",
  modalClassName = "kbd-modal",
  title = "Keyboard Shortcuts",
  hint,
  showUnbound
}) {
  const ctx = useMaybeHotkeysContext();
  const contextLabels = useMemo(() => {
    const registry = ctx?.registry.actionRegistry;
    if (!registry) return void 0;
    const labels2 = {};
    for (const [id, action] of Object.entries(registry)) {
      labels2[id] = action.label;
    }
    return labels2;
  }, [ctx?.registry.actionRegistry]);
  const contextDescriptions = useMemo(() => {
    const registry = ctx?.registry.actionRegistry;
    if (!registry) return void 0;
    const descriptions2 = {};
    for (const [id, action] of Object.entries(registry)) {
      if (action.description) descriptions2[id] = action.description;
    }
    return descriptions2;
  }, [ctx?.registry.actionRegistry]);
  const contextGroups = useMemo(() => {
    const registry = ctx?.registry.actionRegistry;
    if (!registry) return void 0;
    const groups = {};
    for (const action of Object.values(registry)) {
      if (action.group) {
        const prefix = action.group.toLowerCase().replace(/[\s-]/g, "");
        groups[prefix] = action.group;
      }
    }
    return groups;
  }, [ctx?.registry.actionRegistry]);
  const keymap = keymapProp ?? ctx?.registry.keymap ?? {};
  const defaults = defaultsProp;
  const labels = labelsProp ?? contextLabels;
  const descriptions = descriptionsProp ?? contextDescriptions;
  const groupNames = groupNamesProp ?? contextGroups;
  const handleBindingChange = onBindingChange ?? (ctx ? (action, oldKey, newKey) => {
    if (oldKey) ctx.registry.removeBinding(action, oldKey);
    ctx.registry.setBinding(action, newKey);
  } : void 0);
  const handleBindingAdd = onBindingAdd ?? (ctx ? (action, key) => {
    ctx.registry.setBinding(action, key);
  } : void 0);
  const handleBindingRemove = onBindingRemove ?? (ctx ? (action, key) => {
    ctx.registry.removeBinding(action, key);
  } : void 0);
  const handleReset = onReset ?? (ctx ? () => {
    ctx.registry.resetOverrides();
  } : void 0);
  const shouldAutoRegisterOpen = autoRegisterOpen ?? !ctx;
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isOpenProp ?? ctx?.isModalOpen ?? internalIsOpen;
  const [editingAction, setEditingAction] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [addingAction, setAddingAction] = useState(null);
  const [pendingConflict, setPendingConflict] = useState(null);
  const [hasPendingConflictState, setHasPendingConflictState] = useState(false);
  const editingActionRef = useRef(null);
  const editingKeyRef = useRef(null);
  const addingActionRef = useRef(null);
  const conflicts = useMemo(() => findConflicts(keymap), [keymap]);
  const actionBindings = useMemo(() => getActionBindings(keymap), [keymap]);
  const close = useCallback(() => {
    setInternalIsOpen(false);
    setEditingAction(null);
    setEditingKey(null);
    setAddingAction(null);
    editingActionRef.current = null;
    editingKeyRef.current = null;
    addingActionRef.current = null;
    setPendingConflict(null);
    if (onCloseProp) {
      onCloseProp();
    } else if (ctx?.closeModal) {
      ctx.closeModal();
    }
  }, [onCloseProp, ctx]);
  const open = useCallback(() => {
    if (ctx?.openModal) {
      ctx.openModal();
    } else {
      setInternalIsOpen(true);
    }
  }, [ctx]);
  const checkConflict = useCallback((newKey, forAction) => {
    const existingActions = keymap[newKey];
    if (!existingActions) return null;
    const actions = Array.isArray(existingActions) ? existingActions : [existingActions];
    const conflicts2 = actions.filter((a) => a !== forAction);
    return conflicts2.length > 0 ? conflicts2 : null;
  }, [keymap]);
  const combinationsEqual2 = useCallback((a, b) => {
    return a.key === b.key && a.modifiers.ctrl === b.modifiers.ctrl && a.modifiers.alt === b.modifiers.alt && a.modifiers.shift === b.modifiers.shift && a.modifiers.meta === b.modifiers.meta;
  }, []);
  const isSequencePrefix = useCallback((a, b) => {
    if (a.length >= b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!combinationsEqual2(a[i], b[i])) return false;
    }
    return true;
  }, [combinationsEqual2]);
  const sequencesEqual = useCallback((a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!combinationsEqual2(a[i], b[i])) return false;
    }
    return true;
  }, [combinationsEqual2]);
  const { isRecording, startRecording, cancel, pendingKeys, activeKeys, sequenceTimeout } = useRecordHotkey({
    onCapture: useCallback(
      (_sequence, display) => {
        const currentAddingAction = addingActionRef.current;
        const currentEditingAction = editingActionRef.current;
        const currentEditingKey = editingKeyRef.current;
        const actionToUpdate = currentAddingAction || currentEditingAction;
        if (!actionToUpdate) return;
        const conflictActions = checkConflict(display.id, actionToUpdate);
        if (conflictActions && conflictActions.length > 0) {
          setPendingConflict({
            action: actionToUpdate,
            key: display.id,
            conflictsWith: conflictActions
          });
          return;
        }
        if (currentAddingAction) {
          handleBindingAdd?.(currentAddingAction, display.id);
        } else if (currentEditingAction && currentEditingKey) {
          handleBindingChange?.(currentEditingAction, currentEditingKey, display.id);
        }
        editingActionRef.current = null;
        editingKeyRef.current = null;
        addingActionRef.current = null;
        setEditingAction(null);
        setEditingKey(null);
        setAddingAction(null);
      },
      [checkConflict, handleBindingChange, handleBindingAdd]
    ),
    onCancel: useCallback(() => {
      editingActionRef.current = null;
      editingKeyRef.current = null;
      addingActionRef.current = null;
      setEditingAction(null);
      setEditingKey(null);
      setAddingAction(null);
      setPendingConflict(null);
    }, []),
    // Tab to next/prev editable kbd and start editing
    onTab: useCallback(() => {
      const editables = Array.from(document.querySelectorAll(".kbd-kbd.editable, .kbd-kbd.editing"));
      const current = document.querySelector(".kbd-kbd.editing");
      const currentIndex = current ? editables.indexOf(current) : -1;
      const nextIndex = (currentIndex + 1) % editables.length;
      const next = editables[nextIndex];
      if (next) {
        next.focus();
        next.click();
      }
    }, []),
    onShiftTab: useCallback(() => {
      const editables = Array.from(document.querySelectorAll(".kbd-kbd.editable, .kbd-kbd.editing"));
      const current = document.querySelector(".kbd-kbd.editing");
      const currentIndex = current ? editables.indexOf(current) : -1;
      const prevIndex = currentIndex <= 0 ? editables.length - 1 : currentIndex - 1;
      const prev = editables[prevIndex];
      if (prev) {
        prev.focus();
        prev.click();
      }
    }, []),
    pauseTimeout: pendingConflict !== null || hasPendingConflictState
  });
  const startEditingBinding = useCallback(
    (action, key) => {
      addingActionRef.current = null;
      editingActionRef.current = action;
      editingKeyRef.current = key;
      setAddingAction(null);
      setEditingAction(action);
      setEditingKey(key);
      setPendingConflict(null);
      startRecording();
    },
    [startRecording]
  );
  const startAddingBinding = useCallback(
    (action) => {
      editingActionRef.current = null;
      editingKeyRef.current = null;
      addingActionRef.current = action;
      setEditingAction(null);
      setEditingKey(null);
      setAddingAction(action);
      setPendingConflict(null);
      startRecording();
    },
    [startRecording]
  );
  const startEditing = useCallback(
    (action, bindingIndex) => {
      const bindings = actionBindings.get(action) ?? [];
      if (bindingIndex !== void 0 && bindings[bindingIndex]) {
        startEditingBinding(action, bindings[bindingIndex]);
      } else {
        startAddingBinding(action);
      }
    },
    [actionBindings, startEditingBinding, startAddingBinding]
  );
  const cancelEditing = useCallback(() => {
    cancel();
    editingActionRef.current = null;
    editingKeyRef.current = null;
    addingActionRef.current = null;
    setEditingAction(null);
    setEditingKey(null);
    setAddingAction(null);
    setPendingConflict(null);
  }, [cancel]);
  const removeBinding = useCallback(
    (action, key) => {
      handleBindingRemove?.(action, key);
    },
    [handleBindingRemove]
  );
  const reset = useCallback(() => {
    handleReset?.();
  }, [handleReset]);
  const pendingConflictInfo = useMemo(() => {
    if (!isRecording || pendingKeys.length === 0) {
      return { hasConflict: false, conflictingKeys: /* @__PURE__ */ new Set() };
    }
    const conflictingKeys = /* @__PURE__ */ new Set();
    for (const key of Object.keys(keymap)) {
      if (editingKey && key.toLowerCase() === editingKey.toLowerCase()) continue;
      const keySequence = parseHotkeyString(key);
      if (sequencesEqual(pendingKeys, keySequence)) {
        conflictingKeys.add(key);
        continue;
      }
      if (isSequencePrefix(pendingKeys, keySequence)) {
        conflictingKeys.add(key);
        continue;
      }
      if (isSequencePrefix(keySequence, pendingKeys)) {
        conflictingKeys.add(key);
      }
    }
    return { hasConflict: conflictingKeys.size > 0, conflictingKeys };
  }, [isRecording, pendingKeys, keymap, editingKey, sequencesEqual, isSequencePrefix]);
  useEffect(() => {
    setHasPendingConflictState(pendingConflictInfo.hasConflict);
  }, [pendingConflictInfo.hasConflict]);
  const renderEditableKbd = useCallback(
    (actionId, key, showRemove = false) => {
      const isEditingThis = editingAction === actionId && editingKey === key && !addingAction;
      const conflictActions = conflicts.get(key);
      const isConflict = conflictActions && conflictActions.length > 1;
      const isDefault = defaults ? (() => {
        const defaultAction = defaults[key];
        if (!defaultAction) return false;
        const defaultActions = Array.isArray(defaultAction) ? defaultAction : [defaultAction];
        return defaultActions.includes(actionId);
      })() : true;
      const isPendingConflict = pendingConflictInfo.conflictingKeys.has(key);
      return /* @__PURE__ */ jsx(
        BindingDisplay2,
        {
          binding: key,
          editable,
          isEditing: isEditingThis,
          isConflict,
          isPendingConflict,
          isDefault,
          onEdit: () => {
            if (isRecording && !(editingAction === actionId && editingKey === key)) {
              if (pendingKeys.length > 0) {
                const display = formatCombination(pendingKeys);
                const currentAddingAction = addingActionRef.current;
                const currentEditingAction = editingActionRef.current;
                const currentEditingKey = editingKeyRef.current;
                if (currentAddingAction) {
                  handleBindingAdd?.(currentAddingAction, display.id);
                } else if (currentEditingAction && currentEditingKey) {
                  handleBindingChange?.(currentEditingAction, currentEditingKey, display.id);
                }
              }
              cancel();
            }
            startEditingBinding(actionId, key);
          },
          onRemove: editable && showRemove ? () => removeBinding(actionId, key) : void 0,
          pendingKeys,
          activeKeys,
          timeoutDuration: pendingConflictInfo.hasConflict ? Infinity : sequenceTimeout
        },
        key
      );
    },
    [editingAction, editingKey, addingAction, conflicts, defaults, editable, startEditingBinding, removeBinding, pendingKeys, activeKeys, isRecording, cancel, handleBindingAdd, handleBindingChange, sequenceTimeout, pendingConflictInfo]
  );
  const renderAddButton = useCallback(
    (actionId) => {
      const isAddingThis = addingAction === actionId;
      if (isAddingThis) {
        return /* @__PURE__ */ jsx(
          BindingDisplay2,
          {
            binding: "",
            isEditing: true,
            isPendingConflict: pendingConflictInfo.hasConflict,
            pendingKeys,
            activeKeys,
            timeoutDuration: pendingConflictInfo.hasConflict ? Infinity : sequenceTimeout
          }
        );
      }
      return /* @__PURE__ */ jsx(
        "button",
        {
          className: "kbd-add-btn",
          onClick: () => {
            if (isRecording && !isAddingThis) {
              if (pendingKeys.length > 0) {
                const display = formatCombination(pendingKeys);
                const currentAddingAction = addingActionRef.current;
                const currentEditingAction = editingActionRef.current;
                const currentEditingKey = editingKeyRef.current;
                if (currentAddingAction) {
                  handleBindingAdd?.(currentAddingAction, display.id);
                } else if (currentEditingAction && currentEditingKey) {
                  handleBindingChange?.(currentEditingAction, currentEditingKey, display.id);
                }
              }
              cancel();
            }
            startAddingBinding(actionId);
          },
          children: "+"
        }
      );
    },
    [addingAction, pendingKeys, activeKeys, startAddingBinding, isRecording, cancel, handleBindingAdd, handleBindingChange, sequenceTimeout, pendingConflictInfo]
  );
  const renderCell = useCallback(
    (actionId, keys) => {
      return /* @__PURE__ */ jsxs("span", { className: "kbd-action-bindings", children: [
        keys.map((key) => /* @__PURE__ */ jsx(Fragment$1, { children: renderEditableKbd(actionId, key, true) }, key)),
        editable && multipleBindings && renderAddButton(actionId)
      ] });
    },
    [renderEditableKbd, renderAddButton, editable, multipleBindings]
  );
  const groupRendererProps = useMemo(() => ({
    renderCell,
    renderEditableKbd,
    renderAddButton,
    startEditing: startEditingBinding,
    startAdding: startAddingBinding,
    removeBinding,
    isRecording,
    editingAction,
    editingKey,
    addingAction
  }), [renderCell, renderEditableKbd, renderAddButton, startEditingBinding, startAddingBinding, removeBinding, isRecording, editingAction, editingKey, addingAction]);
  const modalKeymap = shouldAutoRegisterOpen ? { [openKey]: "openShortcuts" } : {};
  useHotkeys(
    { ...modalKeymap, escape: "closeShortcuts" },
    {
      openShortcuts: open,
      closeShortcuts: close
    },
    { enabled: shouldAutoRegisterOpen || isOpen }
  );
  useEffect(() => {
    if (!isOpen || !editingAction && !addingAction) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelEditing();
      }
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [isOpen, editingAction, addingAction, cancelEditing]);
  useEffect(() => {
    if (!isOpen || !ctx) return;
    const handleMetaK = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        close();
        ctx.openOmnibar();
      }
    };
    window.addEventListener("keydown", handleMetaK, true);
    return () => window.removeEventListener("keydown", handleMetaK, true);
  }, [isOpen, ctx, close]);
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );
  const handleModalClick = useCallback(
    (e) => {
      if (!editingAction && !addingAction) return;
      const target = e.target;
      if (target.closest(".kbd-kbd.editing")) return;
      if (target.closest(".kbd-kbd.editable")) return;
      if (target.closest(".kbd-add-btn")) return;
      cancelEditing();
    },
    [editingAction, addingAction, cancelEditing]
  );
  const effectiveShowUnbound = showUnbound ?? editable;
  const shortcutGroups = useMemo(
    () => organizeShortcuts(keymap, labels, descriptions, groupNames, groupOrder, ctx?.registry.actionRegistry, effectiveShowUnbound),
    [keymap, labels, descriptions, groupNames, groupOrder, ctx?.registry.actionRegistry, effectiveShowUnbound]
  );
  if (!isOpen) return null;
  if (children) {
    return /* @__PURE__ */ jsx(Fragment, { children: children({
      groups: shortcutGroups,
      close,
      editable,
      editingAction,
      editingBindingIndex: null,
      // deprecated, use editingKey
      pendingKeys,
      activeKeys,
      conflicts,
      startEditing,
      cancelEditing,
      removeBinding,
      reset
    }) });
  }
  const renderGroup = (group) => {
    const customRenderer = groupRenderers?.[group.name];
    if (customRenderer) {
      return customRenderer({ group, ...groupRendererProps });
    }
    return group.shortcuts.map(({ actionId, label, description, bindings }) => /* @__PURE__ */ jsxs("div", { className: "kbd-action", children: [
      /* @__PURE__ */ jsx("span", { className: "kbd-action-label", title: description, children: label }),
      renderCell(actionId, bindings)
    ] }, actionId));
  };
  return /* @__PURE__ */ jsx("div", { className: backdropClassName, onClick: handleBackdropClick, children: /* @__PURE__ */ jsxs("div", { className: modalClassName, role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts", onClick: handleModalClick, children: [
    /* @__PURE__ */ jsxs("div", { className: "kbd-modal-header", children: [
      /* @__PURE__ */ jsx("h2", { className: "kbd-modal-title", children: title }),
      /* @__PURE__ */ jsxs("div", { className: "kbd-modal-header-buttons", children: [
        editable && handleReset && /* @__PURE__ */ jsx("button", { className: "kbd-reset-btn", onClick: reset, children: "Reset" }),
        /* @__PURE__ */ jsx("button", { className: "kbd-modal-close", onClick: close, "aria-label": "Close", children: "\xD7" })
      ] })
    ] }),
    hint && /* @__PURE__ */ jsx("p", { className: "kbd-hint", children: hint }),
    shortcutGroups.map((group) => /* @__PURE__ */ jsxs("div", { className: "kbd-group", children: [
      /* @__PURE__ */ jsx("h3", { className: "kbd-group-title", children: group.name }),
      renderGroup(group)
    ] }, group.name)),
    pendingConflict && /* @__PURE__ */ jsxs("div", { className: "kbd-conflict-warning", style: {
      padding: "12px",
      marginTop: "16px",
      backgroundColor: "var(--kbd-warning-bg)",
      borderRadius: "var(--kbd-radius-sm)",
      border: "1px solid var(--kbd-warning)"
    }, children: [
      /* @__PURE__ */ jsxs("p", { style: { margin: "0 0 8px", color: "var(--kbd-warning)" }, children: [
        "This key is already bound to: ",
        pendingConflict.conflictsWith.join(", ")
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px" }, children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              if (addingActionRef.current) {
                handleBindingAdd?.(pendingConflict.action, pendingConflict.key);
              } else if (editingKeyRef.current) {
                handleBindingChange?.(pendingConflict.action, editingKeyRef.current, pendingConflict.key);
              }
              editingActionRef.current = null;
              editingKeyRef.current = null;
              addingActionRef.current = null;
              setEditingAction(null);
              setEditingKey(null);
              setAddingAction(null);
              setPendingConflict(null);
            },
            style: {
              padding: "4px 12px",
              backgroundColor: "var(--kbd-accent)",
              color: "white",
              border: "none",
              borderRadius: "var(--kbd-radius-sm)",
              cursor: "pointer"
            },
            children: "Override"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: cancelEditing,
            style: {
              padding: "4px 12px",
              backgroundColor: "var(--kbd-bg-secondary)",
              border: "1px solid var(--kbd-border)",
              borderRadius: "var(--kbd-radius-sm)",
              cursor: "pointer"
            },
            children: "Cancel"
          }
        )
      ] })
    ] })
  ] }) });
}

export { ActionsRegistryContext, Alt, Backspace, Command, Ctrl, DEFAULT_SEQUENCE_TIMEOUT, Down, Enter, HotkeysProvider, Kbd, Key, KeybindingEditor, Left, ModifierIcon, Omnibar, Option, Right, SequenceModal, Shift, ShortcutsModal, Up, createTwoColumnRenderer, findConflicts, formatBinding, formatCombination, formatKeyForDisplay, fuzzyMatch, getActionBindings, getConflictsArray, getKeyIcon, getModifierIcon, getSequenceCompletions, hasConflicts, isMac, isModifierKey, isSequence, normalizeKey, parseCombinationId, parseHotkeyString, searchActions, useAction, useActions, useActionsRegistry, useEditableHotkeys, useHotkeys, useHotkeysContext, useMaybeHotkeysContext, useOmnibar, useRecordHotkey };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map