'use strict';

var react = require('react');
var base = require('@rdub/base');
var jsxRuntime = require('react/jsx-runtime');

// src/HotkeysProvider.tsx
var ActionsRegistryContext = react.createContext(null);
function useActionsRegistry(options = {}) {
  const { storageKey } = options;
  const actionsRef = react.useRef(/* @__PURE__ */ new Map());
  const [actionsVersion, setActionsVersion] = react.useState(0);
  const [overrides, setOverrides] = react.useState(() => {
    if (!storageKey || typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const updateOverrides = react.useCallback((newOverrides) => {
    setOverrides(newOverrides);
    if (storageKey && typeof window !== "undefined") {
      try {
        if (Object.keys(newOverrides).length === 0) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(newOverrides));
        }
      } catch {
      }
    }
  }, [storageKey]);
  const register = react.useCallback((id, config) => {
    actionsRef.current.set(id, {
      config,
      registeredAt: Date.now()
    });
    setActionsVersion((v) => v + 1);
  }, []);
  const unregister = react.useCallback((id) => {
    actionsRef.current.delete(id);
    setActionsVersion((v) => v + 1);
  }, []);
  const execute = react.useCallback((id) => {
    const action = actionsRef.current.get(id);
    if (action && (action.config.enabled ?? true)) {
      action.config.handler();
    }
  }, []);
  const keymap = react.useMemo(() => {
    const map = {};
    for (const [id, { config }] of actionsRef.current) {
      for (const binding of config.defaultBindings ?? []) {
        if (overrides[binding] !== void 0) continue;
        const existing = map[binding];
        if (existing) {
          map[binding] = Array.isArray(existing) ? [...existing, id] : [existing, id];
        } else {
          map[binding] = id;
        }
      }
    }
    for (const [key, actionOrActions] of Object.entries(overrides)) {
      if (actionOrActions === "") {
        delete map[key];
      } else {
        map[key] = actionOrActions;
      }
    }
    return map;
  }, [actionsVersion, overrides]);
  const actionRegistry = react.useMemo(() => {
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
  const getBindingsForAction = react.useCallback((actionId) => {
    const bindings = [];
    for (const [key, action] of Object.entries(keymap)) {
      const actions2 = Array.isArray(action) ? action : [action];
      if (actions2.includes(actionId)) {
        bindings.push(key);
      }
    }
    return bindings;
  }, [keymap]);
  const setBinding = react.useCallback((actionId, key) => {
    updateOverrides({
      ...overrides,
      [key]: actionId
    });
  }, [overrides, updateOverrides]);
  const removeBinding = react.useCallback((key) => {
    const action = actionsRef.current.get(overrides[key]);
    const isDefault = action?.config.defaultBindings?.includes(key);
    if (isDefault) {
      updateOverrides({ ...overrides, [key]: "" });
    } else {
      const { [key]: _, ...rest } = overrides;
      updateOverrides(rest);
    }
  }, [overrides, updateOverrides]);
  const resetOverrides = react.useCallback(() => {
    updateOverrides({});
  }, [updateOverrides]);
  const actions = react.useMemo(() => {
    return new Map(actionsRef.current);
  }, [actionsVersion]);
  return react.useMemo(() => ({
    register,
    unregister,
    execute,
    actions,
    keymap,
    actionRegistry,
    getBindingsForAction,
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
    overrides,
    setBinding,
    removeBinding,
    resetOverrides
  ]);
}
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
          keywordScore = base.max(keywordScore, kwMatch.score);
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
    sequenceTimeout = 1e3,
    onTimeout = "submit",
    onSequenceStart,
    onSequenceProgress,
    onSequenceCancel
  } = options;
  const [pendingKeys, setPendingKeys] = react.useState([]);
  const [isAwaitingSequence, setIsAwaitingSequence] = react.useState(false);
  const [timeoutStartedAt, setTimeoutStartedAt] = react.useState(null);
  const handlersRef = react.useRef(handlers);
  handlersRef.current = handlers;
  const keymapRef = react.useRef(keymap);
  keymapRef.current = keymap;
  const timeoutRef = react.useRef(null);
  const pendingKeysRef = react.useRef([]);
  pendingKeysRef.current = pendingKeys;
  const parsedKeymapRef = react.useRef([]);
  react.useEffect(() => {
    parsedKeymapRef.current = Object.entries(keymap).map(([key, actionOrActions]) => ({
      key,
      sequence: parseHotkeyString(key),
      actions: Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
    }));
  }, [keymap]);
  const clearPending = react.useCallback(() => {
    setPendingKeys([]);
    setIsAwaitingSequence(false);
    setTimeoutStartedAt(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  const cancelSequence = react.useCallback(() => {
    clearPending();
    onSequenceCancel?.();
  }, [clearPending, onSequenceCancel]);
  const tryExecute = react.useCallback((sequence, e) => {
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
  const hasPotentialMatch = react.useCallback((sequence) => {
    for (const entry of parsedKeymapRef.current) {
      if (isPartialMatch(sequence, entry.sequence) || sequencesMatch(sequence, entry.sequence)) {
        return true;
      }
    }
    return false;
  }, []);
  const hasSequenceExtension = react.useCallback((sequence) => {
    for (const entry of parsedKeymapRef.current) {
      if (entry.sequence.length > sequence.length && isPartialMatch(sequence, entry.sequence)) {
        return true;
      }
    }
    return false;
  }, []);
  react.useEffect(() => {
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
var HotkeysContext = react.createContext(null);
var DEFAULT_CONFIG = {
  storageKey: "hotkeys",
  sequenceTimeout: 1e3,
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
  const config = react.useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...configProp
  }), [configProp]);
  const registry = useActionsRegistry({ storageKey: config.storageKey });
  const [isEnabled, setIsEnabled] = react.useState(true);
  react.useEffect(() => {
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
  const [isModalOpen, setIsModalOpen] = react.useState(false);
  const openModal = react.useCallback(() => setIsModalOpen(true), []);
  const closeModal = react.useCallback(() => setIsModalOpen(false), []);
  const toggleModal = react.useCallback(() => setIsModalOpen((prev) => !prev), []);
  const [isOmnibarOpen, setIsOmnibarOpen] = react.useState(false);
  const openOmnibar = react.useCallback(() => setIsOmnibarOpen(true), []);
  const closeOmnibar = react.useCallback(() => setIsOmnibarOpen(false), []);
  const toggleOmnibar = react.useCallback(() => setIsOmnibarOpen((prev) => !prev), []);
  const keymap = react.useMemo(() => {
    const map = { ...registry.keymap };
    if (config.modalTrigger !== false) {
      map[config.modalTrigger] = "__hotkeys:modal";
    }
    if (config.omnibarTrigger !== false) {
      map[config.omnibarTrigger] = "__hotkeys:omnibar";
    }
    return map;
  }, [registry.keymap, config.modalTrigger, config.omnibarTrigger]);
  const conflicts = react.useMemo(() => findConflicts(keymap), [keymap]);
  const hasConflicts2 = conflicts.size > 0;
  const effectiveKeymap = react.useMemo(() => {
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
  const handlers = react.useMemo(() => {
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
    timeoutStartedAt: sequenceTimeoutStartedAt,
    sequenceTimeout
  } = useHotkeys(effectiveKeymap, handlers, {
    enabled: hotkeysEnabled,
    sequenceTimeout: config.sequenceTimeout
  });
  const searchActionsHelper = react.useCallback(
    (query) => searchActions(query, registry.actionRegistry, keymap),
    [registry.actionRegistry, keymap]
  );
  const getCompletions = react.useCallback(
    (pending) => getSequenceCompletions(pending, keymap),
    [keymap]
  );
  const value = react.useMemo(() => ({
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
    sequenceTimeoutStartedAt,
    sequenceTimeout,
    conflicts,
    hasConflicts2,
    searchActionsHelper,
    getCompletions
  ]);
  return /* @__PURE__ */ jsxRuntime.jsx(ActionsRegistryContext.Provider, { value: registry, children: /* @__PURE__ */ jsxRuntime.jsx(HotkeysContext.Provider, { value, children }) });
}
function useHotkeysContext() {
  const context = react.useContext(HotkeysContext);
  if (!context) {
    throw new Error("useHotkeysContext must be used within a HotkeysProvider");
  }
  return context;
}
function useMaybeHotkeysContext() {
  return react.useContext(HotkeysContext);
}
function useAction(id, config) {
  const registry = react.useContext(ActionsRegistryContext);
  if (!registry) {
    throw new Error("useAction must be used within a HotkeysProvider");
  }
  const registryRef = react.useRef(registry);
  registryRef.current = registry;
  const handlerRef = react.useRef(config.handler);
  handlerRef.current = config.handler;
  const enabledRef = react.useRef(config.enabled ?? true);
  enabledRef.current = config.enabled ?? true;
  react.useEffect(() => {
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
  const registry = react.useContext(ActionsRegistryContext);
  if (!registry) {
    throw new Error("useActions must be used within a HotkeysProvider");
  }
  const registryRef = react.useRef(registry);
  registryRef.current = registry;
  const handlersRef = react.useRef({});
  const enabledRef = react.useRef({});
  for (const [id, config] of Object.entries(actions)) {
    handlersRef.current[id] = config.handler;
    enabledRef.current[id] = config.enabled ?? true;
  }
  react.useEffect(() => {
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
  const ref = react.useRef(fn);
  ref.current = fn;
  return react.useCallback(((...args) => ref.current?.(...args)), []);
}
function useRecordHotkey(options = {}) {
  const {
    onCapture: onCaptureProp,
    onCancel: onCancelProp,
    onTab: onTabProp,
    onShiftTab: onShiftTabProp,
    preventDefault = true,
    sequenceTimeout = 1e3,
    pauseTimeout = false
  } = options;
  const onCapture = useEventCallback(onCaptureProp);
  const onCancel = useEventCallback(onCancelProp);
  const onTab = useEventCallback(onTabProp);
  const onShiftTab = useEventCallback(onShiftTabProp);
  const [isRecording, setIsRecording] = react.useState(false);
  const [sequence, setSequence] = react.useState(null);
  const [pendingKeys, setPendingKeys] = react.useState([]);
  const [activeKeys, setActiveKeys] = react.useState(null);
  const pressedKeysRef = react.useRef(/* @__PURE__ */ new Set());
  const hasNonModifierRef = react.useRef(false);
  const currentComboRef = react.useRef(null);
  const timeoutRef = react.useRef(null);
  const pauseTimeoutRef = react.useRef(pauseTimeout);
  pauseTimeoutRef.current = pauseTimeout;
  const pendingKeysRef = react.useRef([]);
  const clearTimeout_ = react.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  const submit = react.useCallback((seq) => {
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
  const cancel = react.useCallback(() => {
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
  const commit = react.useCallback(() => {
    const current = pendingKeysRef.current;
    if (current.length > 0) {
      submit(current);
    } else {
      cancel();
    }
  }, [submit, cancel]);
  const startRecording = react.useCallback(() => {
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
  react.useEffect(() => {
    if (pauseTimeout) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else if (isRecording && pendingKeysRef.current.length > 0 && !timeoutRef.current) {
      const currentSequence = pendingKeysRef.current;
      timeoutRef.current = setTimeout(() => {
        submit(currentSequence);
      }, sequenceTimeout);
    }
  }, [pauseTimeout, isRecording, sequenceTimeout, submit]);
  react.useEffect(() => {
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
      if (e.key === "Tab" && !e.shiftKey && onTab) {
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
        if (pendingSeq.length > 0) {
          const display2 = formatCombination(pendingSeq);
          onCapture?.(pendingSeq, display2);
        }
        onTab();
        return;
      }
      if (e.key === "Tab" && e.shiftKey && onShiftTab) {
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
        if (pendingSeq.length > 0) {
          const display2 = formatCombination(pendingSeq);
          onCapture?.(pendingSeq, display2);
        }
        onShiftTab();
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
        if (!pauseTimeoutRef.current) {
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
    combination
    // deprecated
  };
}
function useEditableHotkeys(defaults, handlers, options = {}) {
  const { storageKey, disableConflicts = true, ...hotkeyOptions } = options;
  const [overrides, setOverrides] = react.useState(() => {
    if (!storageKey || typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  react.useEffect(() => {
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
  const keymap = react.useMemo(() => {
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
  const conflicts = react.useMemo(() => findConflicts(keymap), [keymap]);
  const hasConflictsValue = conflicts.size > 0;
  const effectiveKeymap = react.useMemo(() => {
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
  const setBinding = react.useCallback((action, key) => {
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
  const setKeymap = react.useCallback((newOverrides) => {
    setOverrides((prev) => ({ ...prev, ...newOverrides }));
  }, []);
  const reset = react.useCallback(() => {
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
  const [isOpen, setIsOpen] = react.useState(false);
  const [query, setQuery] = react.useState("");
  const [selectedIndex, setSelectedIndex] = react.useState(0);
  const handlersRef = react.useRef(handlers);
  handlersRef.current = handlers;
  const onExecuteRef = react.useRef(onExecute);
  onExecuteRef.current = onExecute;
  const omnibarKeymap = react.useMemo(() => {
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
  const results = react.useMemo(() => {
    const allResults = searchActions(query, actions, keymap);
    return allResults.slice(0, maxResults);
  }, [query, actions, keymap, maxResults]);
  const completions = react.useMemo(() => {
    return getSequenceCompletions(pendingKeys, keymap);
  }, [pendingKeys, keymap]);
  react.useEffect(() => {
    setSelectedIndex(0);
  }, [results]);
  const open = react.useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setSelectedIndex(0);
    onOpen?.();
  }, [onOpen]);
  const close = react.useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
    onClose?.();
  }, [onClose]);
  const toggle = react.useCallback(() => {
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
  const selectNext = react.useCallback(() => {
    setSelectedIndex((prev) => base.min(prev + 1, results.length - 1));
  }, [results.length]);
  const selectPrev = react.useCallback(() => {
    setSelectedIndex((prev) => base.max(prev - 1, 0));
  }, []);
  const resetSelection = react.useCallback(() => {
    setSelectedIndex(0);
  }, []);
  const execute = react.useCallback((actionId) => {
    const id = actionId ?? results[selectedIndex]?.id;
    if (!id) return;
    close();
    if (handlersRef.current?.[id]) {
      const event = new KeyboardEvent("keydown", { key: "Enter" });
      handlersRef.current[id](event);
    }
    onExecuteRef.current?.(id);
  }, [results, selectedIndex, close]);
  react.useEffect(() => {
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
  const [editingAction, setEditingAction] = react.useState(null);
  const actionMap = react.useMemo(() => buildActionMap(keymap), [keymap]);
  const defaultActionMap = react.useMemo(() => buildActionMap(defaults), [defaults]);
  const conflicts = react.useMemo(() => findConflicts(keymap), [keymap]);
  const { isRecording, startRecording, cancel, pendingKeys, activeKeys } = useRecordHotkey({
    onCapture: react.useCallback(
      (_sequence, display) => {
        if (editingAction) {
          onChange(editingAction, display.id);
          setEditingAction(null);
        }
      },
      [editingAction, onChange]
    ),
    onCancel: react.useCallback(() => {
      setEditingAction(null);
    }, [])
  });
  const startEditing = react.useCallback(
    (action) => {
      setEditingAction(action);
      startRecording();
    },
    [startRecording]
  );
  const cancelEditing = react.useCallback(() => {
    cancel();
    setEditingAction(null);
  }, [cancel]);
  const reset = react.useCallback(() => {
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
  const bindings = react.useMemo(() => {
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
    return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: children({
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
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }, children: [
      /* @__PURE__ */ jsxRuntime.jsx("h3", { style: { margin: 0 }, children: "Keybindings" }),
      onReset && /* @__PURE__ */ jsxRuntime.jsx(
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
    /* @__PURE__ */ jsxRuntime.jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [
      /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("th", { style: { textAlign: "left", padding: "8px", borderBottom: "2px solid #ddd" }, children: "Action" }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { style: { textAlign: "left", padding: "8px", borderBottom: "2px solid #ddd" }, children: "Keybinding" }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { style: { width: "80px", padding: "8px", borderBottom: "2px solid #ddd" } })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: bindings.map(({ action, display, description, isDefault, hasConflict }) => {
        const isEditing = editingAction === action;
        return /* @__PURE__ */ jsxRuntime.jsxs("tr", { style: { backgroundColor: hasConflict ? "#fff3cd" : void 0 }, children: [
          /* @__PURE__ */ jsxRuntime.jsxs("td", { style: { padding: "8px", borderBottom: "1px solid #eee" }, children: [
            description,
            !isDefault && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { marginLeft: "8px", fontSize: "0.75rem", color: "#666" }, children: "(modified)" })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("td", { style: { padding: "8px", borderBottom: "1px solid #eee" }, children: [
            isEditing ? /* @__PURE__ */ jsxRuntime.jsx(
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
            ) : /* @__PURE__ */ jsxRuntime.jsx(
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
            hasConflict && !isEditing && /* @__PURE__ */ jsxRuntime.jsx("span", { style: { marginLeft: "8px", color: "#856404", fontSize: "0.75rem" }, children: "\u26A0 Conflict" })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { style: { padding: "8px", borderBottom: "1px solid #eee", textAlign: "center" }, children: isEditing ? /* @__PURE__ */ jsxRuntime.jsx(
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
          ) : /* @__PURE__ */ jsxRuntime.jsx(
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
var baseStyle = {
  width: "1.2em",
  height: "1.2em",
  marginRight: "2px",
  verticalAlign: "middle"
};
var wideStyle = {
  ...baseStyle,
  width: "1.4em"
};
function CommandIcon({ className, style }) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    "svg",
    {
      className,
      style: { ...baseStyle, ...style },
      viewBox: "0 0 24 24",
      fill: "currentColor",
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M6 4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v4H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2h4v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2v-4h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2h-4V6a2 2 0 0 0-2-2H6zm4 6h4v4h-4v-4z" })
    }
  );
}
function CtrlIcon({ className, style }) {
  return /* @__PURE__ */ jsxRuntime.jsx(
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
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M6 15l6-6 6 6" })
    }
  );
}
function ShiftIcon({ className, style }) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    "svg",
    {
      className,
      style: { ...wideStyle, ...style },
      viewBox: "0 0 28 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M14 3L3 14h6v7h10v-7h6L14 3z" })
    }
  );
}
function OptIcon({ className, style }) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    "svg",
    {
      className,
      style: { ...baseStyle, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M4 6h6l8 12h6M14 6h6" })
    }
  );
}
function AltIcon({ className, style }) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    "svg",
    {
      className,
      style: { ...baseStyle, ...style },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M4 18h8M12 18l4-6M12 18l4 0M16 12l4-6h-8" })
    }
  );
}
var isMac2 = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
function getModifierIcon(modifier) {
  switch (modifier) {
    case "meta":
      return CommandIcon;
    case "ctrl":
      return CtrlIcon;
    case "shift":
      return ShiftIcon;
    case "opt":
      return OptIcon;
    case "alt":
      return isMac2 ? OptIcon : AltIcon;
  }
}
function ModifierIcon({ modifier, ...props }) {
  const Icon = getModifierIcon(modifier);
  return /* @__PURE__ */ jsxRuntime.jsx(Icon, { ...props });
}
function BindingBadge({ binding }) {
  const sequence = parseHotkeyString(binding);
  return /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "hotkeys-kbd", children: sequence.map((combo, i) => /* @__PURE__ */ jsxRuntime.jsxs(react.Fragment, { children: [
    i > 0 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-sequence-sep", children: " " }),
    combo.modifiers.meta && /* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "meta", className: "hotkeys-modifier-icon" }),
    combo.modifiers.ctrl && /* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "ctrl", className: "hotkeys-modifier-icon" }),
    combo.modifiers.alt && /* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "alt", className: "hotkeys-modifier-icon" }),
    combo.modifiers.shift && /* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "shift", className: "hotkeys-modifier-icon" }),
    /* @__PURE__ */ jsxRuntime.jsx("span", { children: combo.key.length === 1 ? combo.key.toUpperCase() : combo.key })
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
  backdropClassName = "hotkeys-omnibar-backdrop",
  omnibarClassName = "hotkeys-omnibar"
}) {
  const inputRef = react.useRef(null);
  const ctx = useMaybeHotkeysContext();
  const actions = actionsProp ?? ctx?.registry.actionRegistry ?? {};
  const keymap = keymapProp ?? ctx?.registry.keymap ?? {};
  const enabled = enabledProp ?? !ctx;
  const handleExecute = react.useCallback((actionId) => {
    if (onExecuteProp) {
      onExecuteProp(actionId);
    } else if (ctx?.executeAction) {
      ctx.executeAction(actionId);
    }
  }, [onExecuteProp, ctx]);
  const handleClose = react.useCallback(() => {
    if (onCloseProp) {
      onCloseProp();
    } else if (ctx?.closeOmnibar) {
      ctx.closeOmnibar();
    }
  }, [onCloseProp, ctx]);
  const handleOpen = react.useCallback(() => {
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
  react.useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);
  const handleKeyDown = react.useCallback(
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
  const handleBackdropClick = react.useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );
  if (!isOpen) return null;
  if (children) {
    return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: children({
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
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: backdropClassName, onClick: handleBackdropClick, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: omnibarClassName, role: "dialog", "aria-modal": "true", "aria-label": "Command palette", children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      "input",
      {
        ref: inputRef,
        type: "text",
        className: "hotkeys-omnibar-input",
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
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "hotkeys-omnibar-results", children: results.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "hotkeys-omnibar-no-results", children: query ? "No matching commands" : "Start typing to search commands..." }) : results.map((result, i) => /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        className: `hotkeys-omnibar-result ${i === selectedIndex ? "selected" : ""}`,
        onClick: () => execute(result.id),
        onMouseEnter: () => {
        },
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-omnibar-result-label", children: result.action.label }),
          result.action.group && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-omnibar-result-category", children: result.action.group }),
          result.bindings.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "hotkeys-omnibar-result-bindings", children: result.bindings.slice(0, 2).map((binding) => /* @__PURE__ */ jsxRuntime.jsx(BindingBadge, { binding }, binding)) })
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
    sequenceTimeoutStartedAt: timeoutStartedAt,
    sequenceTimeout,
    getCompletions,
    registry
  } = useHotkeysContext();
  const completions = react.useMemo(() => {
    if (pendingKeys.length === 0) return [];
    return getCompletions(pendingKeys);
  }, [getCompletions, pendingKeys]);
  const formattedPendingKeys = react.useMemo(() => {
    if (pendingKeys.length === 0) return "";
    return formatCombination(pendingKeys).display;
  }, [pendingKeys]);
  const getActionLabel = (actionId) => {
    const action = registry.actions.get(actionId);
    return action?.config.label || actionId;
  };
  const groupedCompletions = react.useMemo(() => {
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
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "hotkeys-sequence-backdrop", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hotkeys-sequence", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hotkeys-sequence-current", children: [
      /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "hotkeys-sequence-keys", children: formattedPendingKeys }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-sequence-ellipsis", children: "\u2026" })
    ] }),
    timeoutStartedAt && /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        className: "hotkeys-sequence-timeout",
        style: { animationDuration: `${sequenceTimeout}ms` }
      },
      timeoutStartedAt
    ),
    completions.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "hotkeys-sequence-completions", children: Array.from(groupedCompletions.entries()).map(([nextKey, comps]) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hotkeys-sequence-completion", children: [
      /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "hotkeys-kbd", children: nextKey.toUpperCase() }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-sequence-arrow", children: "\u2192" }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-sequence-actions", children: comps.flatMap((c) => c.actions).map((action, i) => /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
        i > 0 && ", ",
        getActionLabel(action)
      ] }, action)) })
    ] }, nextKey)) }),
    completions.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "hotkeys-sequence-empty", children: "No matching shortcuts" })
  ] }) });
}
function parseActionId(actionId) {
  const colonIndex = actionId.indexOf(":");
  if (colonIndex > 0) {
    return { group: actionId.slice(0, colonIndex), name: actionId.slice(colonIndex + 1) };
  }
  return { group: "General", name: actionId };
}
function organizeShortcuts(keymap, labels, descriptions, groupNames, groupOrder) {
  const actionBindings = getActionBindings(keymap);
  const groupMap = /* @__PURE__ */ new Map();
  for (const [actionId, bindings] of actionBindings) {
    const { group: groupKey, name } = parseActionId(actionId);
    const groupName = groupNames?.[groupKey] ?? groupKey;
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, { name: groupName, shortcuts: [] });
    }
    groupMap.get(groupName).shortcuts.push({
      actionId,
      label: labels?.[actionId] ?? name,
      description: descriptions?.[actionId],
      bindings
    });
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
    parts.push(/* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "meta", className: "hotkeys-modifier-icon" }, "meta"));
  }
  if (modifiers.ctrl) {
    parts.push(/* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "ctrl", className: "hotkeys-modifier-icon" }, "ctrl"));
  }
  if (modifiers.alt) {
    parts.push(/* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "alt", className: "hotkeys-modifier-icon" }, "alt"));
  }
  if (modifiers.shift) {
    parts.push(/* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "shift", className: "hotkeys-modifier-icon" }, "shift"));
  }
  const keyDisplay = key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
  parts.push(/* @__PURE__ */ jsxRuntime.jsx("span", { children: keyDisplay }, "key"));
  return /* @__PURE__ */ jsxRuntime.jsx("span", { className, children: parts });
}
function BindingDisplay({
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
  activeKeys
}) {
  const sequence = parseHotkeyString(binding);
  const display = formatCombination(sequence);
  let kbdClassName = "hotkeys-kbd";
  if (editable) kbdClassName += " editable";
  if (isEditing) kbdClassName += " editing";
  if (isConflict) kbdClassName += " conflict";
  if (isPendingConflict) kbdClassName += " pending-conflict";
  if (isDefault) kbdClassName += " default-binding";
  if (className) kbdClassName += " " + className;
  const handleClick = editable && onEdit ? onEdit : void 0;
  if (isEditing) {
    let content;
    if (pendingKeys && pendingKeys.length > 0) {
      content = /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        pendingKeys.map((combo, i) => /* @__PURE__ */ jsxRuntime.jsxs(react.Fragment, { children: [
          i > 0 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-sequence-sep", children: " " }),
          /* @__PURE__ */ jsxRuntime.jsx(KeyDisplay, { combo })
        ] }, i)),
        activeKeys && activeKeys.key && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-sequence-sep", children: " \u2192 " }),
          /* @__PURE__ */ jsxRuntime.jsx(KeyDisplay, { combo: activeKeys })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: "..." })
      ] });
    } else if (activeKeys && activeKeys.key) {
      content = /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(KeyDisplay, { combo: activeKeys }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: "..." })
      ] });
    } else {
      content = "Press keys...";
    }
    return /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: kbdClassName, children: content });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs("kbd", { className: kbdClassName, onClick: handleClick, children: [
    display.isSequence ? sequence.map((combo, i) => /* @__PURE__ */ jsxRuntime.jsxs(react.Fragment, { children: [
      i > 0 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-sequence-sep", children: " " }),
      /* @__PURE__ */ jsxRuntime.jsx(KeyDisplay, { combo })
    ] }, i)) : /* @__PURE__ */ jsxRuntime.jsx(KeyDisplay, { combo: sequence[0] }),
    editable && onRemove && /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        className: "hotkeys-remove-btn",
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
  backdropClassName = "hotkeys-backdrop",
  modalClassName = "hotkeys-modal"
}) {
  const ctx = useMaybeHotkeysContext();
  const contextLabels = react.useMemo(() => {
    const registry = ctx?.registry.actionRegistry;
    if (!registry) return void 0;
    const labels2 = {};
    for (const [id, action] of Object.entries(registry)) {
      labels2[id] = action.label;
    }
    return labels2;
  }, [ctx?.registry.actionRegistry]);
  const contextDescriptions = react.useMemo(() => {
    const registry = ctx?.registry.actionRegistry;
    if (!registry) return void 0;
    const descriptions2 = {};
    for (const [id, action] of Object.entries(registry)) {
      if (action.description) descriptions2[id] = action.description;
    }
    return descriptions2;
  }, [ctx?.registry.actionRegistry]);
  const contextGroups = react.useMemo(() => {
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
  const shouldAutoRegisterOpen = autoRegisterOpen ?? !ctx;
  const [internalIsOpen, setInternalIsOpen] = react.useState(false);
  const isOpen = isOpenProp ?? ctx?.isModalOpen ?? internalIsOpen;
  const [editingAction, setEditingAction] = react.useState(null);
  const [editingBindingIndex, setEditingBindingIndex] = react.useState(null);
  const [pendingConflict, setPendingConflict] = react.useState(null);
  const conflicts = react.useMemo(() => findConflicts(keymap), [keymap]);
  const actionBindings = react.useMemo(() => getActionBindings(keymap), [keymap]);
  const close = react.useCallback(() => {
    setInternalIsOpen(false);
    setEditingAction(null);
    setEditingBindingIndex(null);
    setPendingConflict(null);
    if (onCloseProp) {
      onCloseProp();
    } else if (ctx?.closeModal) {
      ctx.closeModal();
    }
  }, [onCloseProp, ctx]);
  const open = react.useCallback(() => {
    if (ctx?.openModal) {
      ctx.openModal();
    } else {
      setInternalIsOpen(true);
    }
  }, [ctx]);
  const checkConflict = react.useCallback((newKey, forAction) => {
    const existingActions = keymap[newKey];
    if (!existingActions) return null;
    const actions = Array.isArray(existingActions) ? existingActions : [existingActions];
    const conflicts2 = actions.filter((a) => a !== forAction);
    return conflicts2.length > 0 ? conflicts2 : null;
  }, [keymap]);
  const { isRecording, startRecording, cancel, pendingKeys, activeKeys } = useRecordHotkey({
    onCapture: react.useCallback(
      (sequence, display) => {
        if (!editingAction) return;
        const conflictActions = checkConflict(display.id, editingAction);
        if (conflictActions && conflictActions.length > 0) {
          setPendingConflict({
            action: editingAction,
            key: display.id,
            conflictsWith: conflictActions
          });
          return;
        }
        const oldBindings = actionBindings.get(editingAction) ?? [];
        const oldKey = editingBindingIndex !== null ? oldBindings[editingBindingIndex] : null;
        if (editingBindingIndex !== null && oldKey) {
          onBindingChange?.(editingAction, oldKey, display.id);
        } else {
          onBindingAdd?.(editingAction, display.id);
        }
        setEditingAction(null);
        setEditingBindingIndex(null);
      },
      [editingAction, editingBindingIndex, actionBindings, checkConflict, onBindingChange, onBindingAdd]
    ),
    onCancel: react.useCallback(() => {
      setEditingAction(null);
      setEditingBindingIndex(null);
      setPendingConflict(null);
    }, []),
    pauseTimeout: pendingConflict !== null
  });
  const startEditing = react.useCallback(
    (action, bindingIndex) => {
      setEditingAction(action);
      setEditingBindingIndex(bindingIndex ?? null);
      setPendingConflict(null);
      startRecording();
    },
    [startRecording]
  );
  const cancelEditing = react.useCallback(() => {
    cancel();
    setEditingAction(null);
    setEditingBindingIndex(null);
    setPendingConflict(null);
  }, [cancel]);
  const removeBinding = react.useCallback(
    (action, key) => {
      onBindingRemove?.(action, key);
    },
    [onBindingRemove]
  );
  const reset = react.useCallback(() => {
    onReset?.();
  }, [onReset]);
  const modalKeymap = shouldAutoRegisterOpen ? { [openKey]: "openShortcuts" } : {};
  useHotkeys(
    { ...modalKeymap, escape: "closeShortcuts" },
    {
      openShortcuts: open,
      closeShortcuts: close
    },
    { enabled: shouldAutoRegisterOpen || isOpen }
  );
  react.useEffect(() => {
    if (!isOpen || !editingAction) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelEditing();
      }
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [isOpen, editingAction, cancelEditing]);
  const handleBackdropClick = react.useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );
  const shortcutGroups = react.useMemo(
    () => organizeShortcuts(keymap, labels, descriptions, groupNames, groupOrder),
    [keymap, labels, descriptions, groupNames, groupOrder]
  );
  if (!isOpen) return null;
  if (children) {
    return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: children({
      groups: shortcutGroups,
      close,
      editable,
      editingAction,
      editingBindingIndex,
      pendingKeys,
      activeKeys,
      conflicts,
      startEditing,
      cancelEditing,
      removeBinding,
      reset
    }) });
  }
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: backdropClassName, onClick: handleBackdropClick, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: modalClassName, role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hotkeys-modal-header", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "hotkeys-modal-title", children: "Keyboard Shortcuts" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { className: "hotkeys-modal-close", onClick: close, "aria-label": "Close", children: "\xD7" })
    ] }),
    shortcutGroups.map((group) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hotkeys-group", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "hotkeys-group-title", children: group.name }),
      group.shortcuts.map(({ actionId, label, description, bindings }) => {
        const isEditingThisAction = editingAction === actionId;
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hotkeys-action", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hotkeys-action-label", title: description, children: label }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hotkeys-action-bindings", children: [
            bindings.map((binding, idx) => {
              const conflictActions = conflicts.get(binding);
              const isConflict = conflictActions && conflictActions.length > 1;
              const isEditing = isEditingThisAction && editingBindingIndex === idx;
              const isDefault = defaults ? (() => {
                const defaultAction = defaults[binding];
                if (!defaultAction) return false;
                const defaultActions = Array.isArray(defaultAction) ? defaultAction : [defaultAction];
                return defaultActions.includes(actionId);
              })() : true;
              return /* @__PURE__ */ jsxRuntime.jsx(
                BindingDisplay,
                {
                  binding,
                  editable,
                  isEditing,
                  isConflict,
                  isDefault,
                  onEdit: () => startEditing(actionId, idx),
                  onRemove: editable ? () => removeBinding(actionId, binding) : void 0,
                  pendingKeys,
                  activeKeys
                },
                binding
              );
            }),
            editable && multipleBindings && !isEditingThisAction && /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                className: "hotkeys-add-btn",
                onClick: () => startEditing(actionId),
                disabled: isRecording && !isEditingThisAction,
                children: "+"
              }
            ),
            isEditingThisAction && editingBindingIndex === null && /* @__PURE__ */ jsxRuntime.jsx(
              BindingDisplay,
              {
                binding: "",
                isEditing: true,
                pendingKeys,
                activeKeys
              }
            )
          ] })
        ] }, actionId);
      })
    ] }, group.name)),
    pendingConflict && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hotkeys-conflict-warning", style: {
      padding: "12px",
      marginTop: "16px",
      backgroundColor: "var(--hk-warning-bg)",
      borderRadius: "var(--hk-radius-sm)",
      border: "1px solid var(--hk-warning)"
    }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("p", { style: { margin: "0 0 8px", color: "var(--hk-warning)" }, children: [
        "This key is already bound to: ",
        pendingConflict.conflictsWith.join(", ")
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", gap: "8px" }, children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            onClick: () => {
              const oldBindings = actionBindings.get(pendingConflict.action) ?? [];
              const oldKey = editingBindingIndex !== null ? oldBindings[editingBindingIndex] : null;
              if (editingBindingIndex !== null && oldKey) {
                onBindingChange?.(pendingConflict.action, oldKey, pendingConflict.key);
              } else {
                onBindingAdd?.(pendingConflict.action, pendingConflict.key);
              }
              setEditingAction(null);
              setEditingBindingIndex(null);
              setPendingConflict(null);
            },
            style: {
              padding: "4px 12px",
              backgroundColor: "var(--hk-accent)",
              color: "white",
              border: "none",
              borderRadius: "var(--hk-radius-sm)",
              cursor: "pointer"
            },
            children: "Override"
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            onClick: cancelEditing,
            style: {
              padding: "4px 12px",
              backgroundColor: "var(--hk-bg-secondary)",
              border: "1px solid var(--hk-border)",
              borderRadius: "var(--hk-radius-sm)",
              cursor: "pointer"
            },
            children: "Cancel"
          }
        )
      ] })
    ] }),
    editable && onReset && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { marginTop: "16px", textAlign: "right" }, children: /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        onClick: reset,
        style: {
          padding: "6px 12px",
          backgroundColor: "var(--hk-bg-secondary)",
          border: "1px solid var(--hk-border)",
          borderRadius: "var(--hk-radius-sm)",
          cursor: "pointer",
          color: "var(--hk-text)"
        },
        children: "Reset to defaults"
      }
    ) })
  ] }) });
}

exports.ActionsRegistryContext = ActionsRegistryContext;
exports.AltIcon = AltIcon;
exports.CommandIcon = CommandIcon;
exports.CtrlIcon = CtrlIcon;
exports.HotkeysProvider = HotkeysProvider;
exports.KeybindingEditor = KeybindingEditor;
exports.ModifierIcon = ModifierIcon;
exports.Omnibar = Omnibar;
exports.OptIcon = OptIcon;
exports.SequenceModal = SequenceModal;
exports.ShiftIcon = ShiftIcon;
exports.ShortcutsModal = ShortcutsModal;
exports.findConflicts = findConflicts;
exports.formatCombination = formatCombination;
exports.formatKeyForDisplay = formatKeyForDisplay;
exports.fuzzyMatch = fuzzyMatch;
exports.getActionBindings = getActionBindings;
exports.getConflictsArray = getConflictsArray;
exports.getModifierIcon = getModifierIcon;
exports.getSequenceCompletions = getSequenceCompletions;
exports.hasConflicts = hasConflicts;
exports.isMac = isMac;
exports.isModifierKey = isModifierKey;
exports.isSequence = isSequence;
exports.normalizeKey = normalizeKey;
exports.parseCombinationId = parseCombinationId;
exports.parseHotkeyString = parseHotkeyString;
exports.searchActions = searchActions;
exports.useAction = useAction;
exports.useActions = useActions;
exports.useActionsRegistry = useActionsRegistry;
exports.useEditableHotkeys = useEditableHotkeys;
exports.useHotkeys = useHotkeys;
exports.useHotkeysContext = useHotkeysContext;
exports.useMaybeHotkeysContext = useMaybeHotkeysContext;
exports.useOmnibar = useOmnibar;
exports.useRecordHotkey = useRecordHotkey;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map