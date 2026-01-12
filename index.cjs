'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');

// src/types.ts
function extractCaptures(state) {
  return state.filter(
    (e) => (e.type === "digit" || e.type === "digits") && e.value !== void 0
  ).map((e) => e.value);
}
function isDigitPlaceholder(elem) {
  return elem.type === "digit" || elem.type === "digits";
}
function countPlaceholders(seq) {
  return seq.filter(isDigitPlaceholder).length;
}
function createTwoColumnRenderer(config) {
  const { headers, getRows } = config;
  const [labelHeader, leftHeader, rightHeader] = headers;
  return function TwoColumnRenderer({ group, renderCell }) {
    const bindingsMap = new Map(
      group.shortcuts.map((s) => [s.actionId, s.bindings])
    );
    const rows = getRows(group);
    return /* @__PURE__ */ jsxRuntime.jsxs("table", { className: "kbd-table", children: [
      /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: labelHeader }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: leftHeader }),
        /* @__PURE__ */ jsxRuntime.jsx("th", { children: rightHeader })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: rows.map(({ label, leftAction, rightAction }, i) => {
        const leftBindings = bindingsMap.get(leftAction) ?? [];
        const rightBindings = bindingsMap.get(rightAction) ?? [];
        if (leftBindings.length === 0 && rightBindings.length === 0) return null;
        return /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("td", { children: label }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { children: leftAction ? renderCell(leftAction, leftBindings) : "-" }),
          /* @__PURE__ */ jsxRuntime.jsx("td", { children: rightAction ? renderCell(rightAction, rightBindings) : "-" })
        ] }, i);
      }) })
    ] });
  };
}
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
  const [removedDefaults, setRemovedDefaults] = react.useState(() => {
    if (!storageKey || typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(`${storageKey}-removed`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const isDefaultBinding = react.useCallback((key, actionId) => {
    const action = actionsRef.current.get(actionId);
    return action?.config.defaultBindings?.includes(key) ?? false;
  }, []);
  const filterRedundantOverrides = react.useCallback((overrides2) => {
    const filtered = {};
    for (const [key, actionOrActions] of Object.entries(overrides2)) {
      if (actionOrActions === "") ; else if (Array.isArray(actionOrActions)) {
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
  const updateOverrides = react.useCallback((update) => {
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
  const updateRemovedDefaults = react.useCallback((update) => {
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
  const execute = react.useCallback((id, captures) => {
    const action = actionsRef.current.get(id);
    if (action && (action.config.enabled ?? true)) {
      action.config.handler(void 0, captures);
    }
  }, []);
  const keymap = react.useMemo(() => {
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
      if (actionOrActions === "") ; else {
        const actions2 = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
        for (const actionId of actions2) {
          addToKey(key, actionId);
        }
      }
    }
    return map;
  }, [actionsVersion, overrides, removedDefaults]);
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
  const getFirstBindingForAction = react.useCallback((actionId) => {
    return getBindingsForAction(actionId)[0];
  }, [getBindingsForAction]);
  const setBinding = react.useCallback((actionId, key) => {
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
  const removeBinding = react.useCallback((actionId, key) => {
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
  const resetOverrides = react.useCallback(() => {
    updateOverrides({});
    updateRemovedDefaults({});
  }, [updateOverrides, updateRemovedDefaults]);
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
var OmnibarEndpointsRegistryContext = react.createContext(null);
function useOmnibarEndpointsRegistry() {
  const endpointsRef = react.useRef(/* @__PURE__ */ new Map());
  const [endpointsVersion, setEndpointsVersion] = react.useState(0);
  const register = react.useCallback((id, config) => {
    endpointsRef.current.set(id, {
      id,
      config,
      registeredAt: Date.now()
    });
    setEndpointsVersion((v) => v + 1);
  }, []);
  const unregister = react.useCallback((id) => {
    endpointsRef.current.delete(id);
    setEndpointsVersion((v) => v + 1);
  }, []);
  const queryEndpoint = react.useCallback(async (endpointId, query, pagination, signal) => {
    const ep = endpointsRef.current.get(endpointId);
    if (!ep) return null;
    if (ep.config.enabled === false) return null;
    if (query.length < (ep.config.minQueryLength ?? 2)) return null;
    try {
      const response = await ep.config.fetch(query, signal, pagination);
      const entriesWithGroup = response.entries.map((entry) => ({
        ...entry,
        group: entry.group ?? ep.config.group
      }));
      return {
        endpointId: ep.id,
        entries: entriesWithGroup,
        total: response.total,
        hasMore: response.hasMore
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { endpointId: ep.id, entries: [] };
      }
      return {
        endpointId: ep.id,
        entries: [],
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }, []);
  const queryAll = react.useCallback(async (query, signal) => {
    const endpoints2 = Array.from(endpointsRef.current.values());
    const promises = endpoints2.filter((ep) => ep.config.enabled !== false).filter((ep) => query.length >= (ep.config.minQueryLength ?? 2)).map(async (ep) => {
      const pageSize = ep.config.pageSize ?? 10;
      const result = await queryEndpoint(ep.id, query, { offset: 0, limit: pageSize }, signal);
      return result ?? { endpointId: ep.id, entries: [] };
    });
    return Promise.all(promises);
  }, [queryEndpoint]);
  const endpoints = react.useMemo(() => {
    return new Map(endpointsRef.current);
  }, [endpointsVersion]);
  return react.useMemo(() => ({
    register,
    unregister,
    endpoints,
    queryAll,
    queryEndpoint
  }), [register, unregister, endpoints, queryAll, queryEndpoint]);
}

// src/constants.ts
var DEFAULT_SEQUENCE_TIMEOUT = Infinity;
var ACTION_MODAL = "__hotkeys:modal";
var ACTION_OMNIBAR = "__hotkeys:omnibar";
var ACTION_LOOKUP = "__hotkeys:lookup";

// src/utils.ts
var { max } = Math;
var SHIFTED_SYMBOLS = /* @__PURE__ */ new Set([
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
  "?",
  "~"
]);
function isShiftedSymbol(key) {
  return SHIFTED_SYMBOLS.has(key);
}
function isMac() {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.userAgentData?.platform;
  if (platform) {
    return platform === "macOS" || platform === "iOS";
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
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
    "tab": "\u21E5",
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
var DIGIT_PLACEHOLDER = "__DIGIT__";
var DIGITS_PLACEHOLDER = "__DIGITS__";
function isPlaceholderSentinel(key) {
  return key === DIGIT_PLACEHOLDER || key === DIGITS_PLACEHOLDER;
}
function formatSingleCombination(combo) {
  if (combo.key === DIGIT_PLACEHOLDER) {
    return { display: "#", id: "\\d" };
  }
  if (combo.key === DIGITS_PLACEHOLDER) {
    return { display: "##", id: "\\d+" };
  }
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
var NO_MODIFIERS = { ctrl: false, alt: false, shift: false, meta: false };
function parseSeqElem(str) {
  if (str === "\\d") {
    return { type: "digit" };
  }
  if (str === "\\d+") {
    return { type: "digits" };
  }
  if (str.length === 1 && /^[A-Z]$/.test(str)) {
    return {
      type: "key",
      key: str.toLowerCase(),
      modifiers: { ctrl: false, alt: false, shift: true, meta: false }
    };
  }
  const parts = str.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  return {
    type: "key",
    key,
    modifiers: {
      ctrl: parts.includes("ctrl") || parts.includes("control"),
      alt: parts.includes("alt") || parts.includes("option"),
      shift: parts.includes("shift"),
      meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("command")
    }
  };
}
function parseKeySeq(hotkeyStr) {
  if (!hotkeyStr.trim()) return [];
  const parts = hotkeyStr.trim().split(/\s+/);
  return parts.map(parseSeqElem);
}
function formatSeqElem(elem) {
  if (elem.type === "digit") {
    return { display: "\u27E8#\u27E9", id: "\\d" };
  }
  if (elem.type === "digits") {
    return { display: "\u27E8##\u27E9", id: "\\d+" };
  }
  const mac = isMac();
  const parts = [];
  const idParts = [];
  if (elem.modifiers.ctrl) {
    parts.push(mac ? "\u2303" : "Ctrl");
    idParts.push("ctrl");
  }
  if (elem.modifiers.meta) {
    parts.push(mac ? "\u2318" : "Win");
    idParts.push("meta");
  }
  if (elem.modifiers.alt) {
    parts.push(mac ? "\u2325" : "Alt");
    idParts.push("alt");
  }
  if (elem.modifiers.shift) {
    parts.push(mac ? "\u21E7" : "Shift");
    idParts.push("shift");
  }
  parts.push(formatKeyForDisplay(elem.key));
  idParts.push(elem.key);
  return {
    display: mac ? parts.join("") : parts.join("+"),
    id: idParts.join("+")
  };
}
function formatKeySeq(seq) {
  if (seq.length === 0) {
    return { display: "", id: "", isSequence: false };
  }
  const formatted = seq.map(formatSeqElem);
  if (seq.length === 1) {
    return { ...formatted[0], isSequence: false };
  }
  return {
    display: formatted.map((f) => f.display).join(" "),
    id: formatted.map((f) => f.id).join(" "),
    isSequence: true
  };
}
function hasDigitPlaceholders(seq) {
  return seq.some((elem) => elem.type === "digit" || elem.type === "digits");
}
function keySeqToHotkeySequence(seq) {
  return seq.map((elem) => {
    if (elem.type === "digit") {
      return { key: "\\d", modifiers: NO_MODIFIERS };
    }
    if (elem.type === "digits") {
      return { key: "\\d+", modifiers: NO_MODIFIERS };
    }
    return { key: elem.key, modifiers: elem.modifiers };
  });
}
function hotkeySequenceToKeySeq(seq) {
  return seq.map((combo) => {
    if (combo.key === "\\d" && !combo.modifiers.ctrl && !combo.modifiers.alt && !combo.modifiers.shift && !combo.modifiers.meta) {
      return { type: "digit" };
    }
    if (combo.key === "\\d+" && !combo.modifiers.ctrl && !combo.modifiers.alt && !combo.modifiers.shift && !combo.modifiers.meta) {
      return { type: "digits" };
    }
    return { type: "key", key: combo.key, modifiers: combo.modifiers };
  });
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
function keyMatchesPattern(pending, pattern) {
  if (pending.modifiers.ctrl !== pattern.modifiers.ctrl || pending.modifiers.alt !== pattern.modifiers.alt || pending.modifiers.shift !== pattern.modifiers.shift || pending.modifiers.meta !== pattern.modifiers.meta) {
    return false;
  }
  if (pending.key === pattern.key) return true;
  return /^[0-9]$/.test(pending.key) && (pattern.key === DIGIT_PLACEHOLDER || pattern.key === DIGITS_PLACEHOLDER);
}
function isDigitKey(key) {
  return /^[0-9]$/.test(key);
}
function seqElemsCouldConflict(a, b) {
  if (a.type === "digit" && b.type === "digit") return true;
  if (a.type === "digit" && b.type === "key" && isDigitKey(b.key)) return true;
  if (a.type === "key" && isDigitKey(a.key) && b.type === "digit") return true;
  if (a.type === "digits" && b.type === "digits") return true;
  if (a.type === "digits" && b.type === "digit") return true;
  if (a.type === "digit" && b.type === "digits") return true;
  if (a.type === "digits" && b.type === "key" && isDigitKey(b.key)) return true;
  if (a.type === "key" && isDigitKey(a.key) && b.type === "digits") return true;
  if (a.type === "key" && b.type === "key") {
    return a.key === b.key && a.modifiers.ctrl === b.modifiers.ctrl && a.modifiers.alt === b.modifiers.alt && a.modifiers.shift === b.modifiers.shift && a.modifiers.meta === b.modifiers.meta;
  }
  return false;
}
function keySeqIsPrefix(a, b) {
  if (a.length >= b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!seqElemsCouldConflict(a[i], b[i])) return false;
  }
  return true;
}
function keySeqsCouldConflict(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!seqElemsCouldConflict(a[i], b[i])) return false;
  }
  return true;
}
function findConflicts(keymap) {
  const conflicts = /* @__PURE__ */ new Map();
  const entries = Object.entries(keymap).map(([key, actionOrActions]) => ({
    key,
    sequence: parseHotkeyString(key),
    keySeq: parseKeySeq(key),
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
      if (keySeqsCouldConflict(a.keySeq, b.keySeq) && a.key !== b.key) {
        const existingA = conflicts.get(a.key) ?? [];
        if (!existingA.includes(`conflicts with: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `conflicts with: ${b.key}`]);
        }
        const existingB = conflicts.get(b.key) ?? [];
        if (!existingB.includes(`conflicts with: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `conflicts with: ${a.key}`]);
        }
        continue;
      }
      if (keySeqIsPrefix(a.keySeq, b.keySeq)) {
        const existingA = conflicts.get(a.key) ?? [];
        if (!existingA.includes(`prefix of: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `prefix of: ${b.key}`]);
        }
        const existingB = conflicts.get(b.key) ?? [];
        if (!existingB.includes(`has prefix: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `has prefix: ${a.key}`]);
        }
      } else if (keySeqIsPrefix(b.keySeq, a.keySeq)) {
        const existingB = conflicts.get(b.key) ?? [];
        if (!existingB.includes(`prefix of: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `prefix of: ${a.key}`]);
        }
        const existingA = conflicts.get(a.key) ?? [];
        if (!existingA.includes(`has prefix: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `has prefix: ${b.key}`]);
        }
      } else if (isPrefix(a.sequence, b.sequence)) {
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
    const keySeq = parseKeySeq(hotkeyStr);
    const hasDigitsPlaceholder = keySeq.some((e) => e.type === "digits");
    if (!hasDigitsPlaceholder && keySeq.length < pendingKeys.length) continue;
    let keySeqIdx = 0;
    let pendingIdx = 0;
    let isMatch = true;
    const captures = [];
    let currentDigits = "";
    for (; pendingIdx < pendingKeys.length && keySeqIdx < keySeq.length; pendingIdx++) {
      const elem = keySeq[keySeqIdx];
      if (elem.type === "digits") {
        if (!/^[0-9]$/.test(pendingKeys[pendingIdx].key)) {
          isMatch = false;
          break;
        }
        currentDigits += pendingKeys[pendingIdx].key;
        if (pendingIdx + 1 < pendingKeys.length && /^[0-9]$/.test(pendingKeys[pendingIdx + 1].key)) {
          continue;
        }
        captures.push(parseInt(currentDigits, 10));
        currentDigits = "";
        keySeqIdx++;
      } else if (elem.type === "digit") {
        if (!/^[0-9]$/.test(pendingKeys[pendingIdx].key)) {
          isMatch = false;
          break;
        }
        captures.push(parseInt(pendingKeys[pendingIdx].key, 10));
        keySeqIdx++;
      } else {
        const keyElem = elem;
        const targetCombo = { key: keyElem.key, modifiers: keyElem.modifiers };
        if (!keyMatchesPattern(pendingKeys[pendingIdx], targetCombo)) {
          isMatch = false;
          break;
        }
        keySeqIdx++;
      }
    }
    if (pendingIdx < pendingKeys.length) {
      isMatch = false;
    }
    if (!isMatch) continue;
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
    if (keySeqIdx === keySeq.length) {
      completions.push({
        nextKeys: "",
        fullSequence: hotkeyStr,
        display: formatKeySeq(keySeq),
        actions,
        isComplete: true,
        captures: captures.length > 0 ? captures : void 0
      });
    } else {
      const remainingKeySeq = keySeq.slice(keySeqIdx);
      const nextKeys = formatKeySeq(remainingKeySeq).display;
      completions.push({
        nextKeys,
        nextKeySeq: remainingKeySeq,
        fullSequence: hotkeyStr,
        display: formatKeySeq(keySeq),
        actions,
        isComplete: false,
        captures: captures.length > 0 ? captures : void 0
      });
    }
  }
  completions.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    return a.fullSequence.localeCompare(b.fullSequence);
  });
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
    const score = (labelMatch.matched ? labelMatch.score * 3 : 0) + (descMatch.matched ? descMatch.score * 1.5 : 0) + (groupMatch.matched ? groupMatch.score : 0) + (idMatch.matched ? idMatch.score * 0.5 : 0) + keywordScore * 2;
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
function isDigit(key) {
  return /^[0-9]$/.test(key);
}
function initMatchState(seq) {
  return seq.map((elem) => {
    if (elem.type === "digit") return { type: "digit" };
    if (elem.type === "digits") return { type: "digits" };
    return { type: "key", key: elem.key, modifiers: elem.modifiers };
  });
}
function matchesKeyElem(combo, elem) {
  const shiftMatches = isShiftedChar(combo.key) ? elem.modifiers.shift ? combo.modifiers.shift : true : combo.modifiers.shift === elem.modifiers.shift;
  return combo.modifiers.ctrl === elem.modifiers.ctrl && combo.modifiers.alt === elem.modifiers.alt && shiftMatches && combo.modifiers.meta === elem.modifiers.meta && combo.key === elem.key;
}
function advanceMatchState(state, pattern, combo) {
  const newState = [...state];
  let pos = 0;
  for (let i = 0; i < state.length; i++) {
    const elem = state[i];
    if (elem.type === "key" && !elem.matched) break;
    if (elem.type === "digit" && elem.value === void 0) break;
    if (elem.type === "digits" && elem.value === void 0) {
      if (!elem.partial) break;
      if (isDigit(combo.key)) {
        const newPartial = (elem.partial || "") + combo.key;
        newState[i] = { type: "digits", partial: newPartial };
        return { status: "partial", state: newState };
      } else {
        const digitValue = parseInt(elem.partial, 10);
        newState[i] = { type: "digits", value: digitValue };
        pos = i + 1;
        if (pos >= pattern.length) {
          return { status: "failed" };
        }
        break;
      }
    }
    pos++;
  }
  if (pos >= pattern.length) {
    return { status: "failed" };
  }
  const currentPattern = pattern[pos];
  if (currentPattern.type === "digit") {
    if (!isDigit(combo.key) || combo.modifiers.ctrl || combo.modifiers.alt || combo.modifiers.meta) {
      return { status: "failed" };
    }
    newState[pos] = { type: "digit", value: parseInt(combo.key, 10) };
  } else if (currentPattern.type === "digits") {
    if (!isDigit(combo.key) || combo.modifiers.ctrl || combo.modifiers.alt || combo.modifiers.meta) {
      return { status: "failed" };
    }
    newState[pos] = { type: "digits", partial: combo.key };
  } else {
    if (!matchesKeyElem(combo, currentPattern)) {
      return { status: "failed" };
    }
    newState[pos] = { type: "key", key: currentPattern.key, modifiers: currentPattern.modifiers, matched: true };
  }
  const isComplete = newState.every((elem) => {
    if (elem.type === "key") return elem.matched === true;
    if (elem.type === "digit") return elem.value !== void 0;
    if (elem.type === "digits") return elem.value !== void 0;
    return false;
  });
  if (isComplete) {
    const captures = newState.filter(
      (e) => (e.type === "digit" || e.type === "digits") && e.value !== void 0
    ).map((e) => e.value);
    return { status: "matched", state: newState, captures };
  }
  return { status: "partial", state: newState };
}
function isCollectingDigits(state) {
  return state.some((elem) => elem.type === "digits" && elem.partial !== void 0 && elem.value === void 0);
}
function finalizeDigits(state) {
  return state.map((elem) => {
    if (elem.type === "digits" && elem.partial !== void 0 && elem.value === void 0) {
      return { type: "digits", value: parseInt(elem.partial, 10) };
    }
    return elem;
  });
}
function extractMatchCaptures(state) {
  return state.filter(
    (e) => (e.type === "digit" || e.type === "digits") && e.value !== void 0
  ).map((e) => e.value);
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
  const matchStatesRef = react.useRef(/* @__PURE__ */ new Map());
  const parsedKeymapRef = react.useRef([]);
  react.useEffect(() => {
    parsedKeymapRef.current = Object.entries(keymap).map(([key, actionOrActions]) => ({
      key,
      sequence: parseHotkeyString(key),
      keySeq: parseKeySeq(key),
      actions: Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
    }));
  }, [keymap]);
  const clearPending = react.useCallback(() => {
    setPendingKeys([]);
    setIsAwaitingSequence(false);
    setTimeoutStartedAt(null);
    matchStatesRef.current.clear();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  const cancelSequence = react.useCallback(() => {
    clearPending();
    onSequenceCancel?.();
  }, [clearPending, onSequenceCancel]);
  const tryExecute = react.useCallback((sequence, e, captures) => {
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
            handler(e, captures);
            return true;
          }
        }
      }
    }
    return false;
  }, [preventDefault, stopPropagation]);
  const tryExecuteKeySeq = react.useCallback((matchKey, captures, e) => {
    for (const entry of parsedKeymapRef.current) {
      if (entry.key === matchKey) {
        for (const action of entry.actions) {
          const handler = handlersRef.current[action];
          if (handler) {
            if (preventDefault) {
              e.preventDefault();
            }
            if (stopPropagation) {
              e.stopPropagation();
            }
            handler(e, captures.length > 0 ? captures : void 0);
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
        let executed = false;
        for (const [key, state] of matchStatesRef.current.entries()) {
          const finalizedState = isCollectingDigits(state) ? finalizeDigits(state) : state;
          const isComplete = finalizedState.every((elem) => {
            if (elem.type === "key") return elem.matched === true;
            if (elem.type === "digit") return elem.value !== void 0;
            if (elem.type === "digits") return elem.value !== void 0;
            return false;
          });
          if (isComplete) {
            const captures = extractMatchCaptures(finalizedState);
            executed = tryExecuteKeySeq(key, captures, e);
            if (executed) break;
          }
        }
        if (!executed) {
          executed = tryExecute(pendingKeysRef.current, e);
        }
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
      if (e.key === "Backspace" && pendingKeysRef.current.length > 0) {
        let backspaceMatches = false;
        for (const entry of parsedKeymapRef.current) {
          let state = matchStatesRef.current.get(entry.key);
          if (!state) {
            state = initMatchState(entry.keySeq);
          }
          if (isCollectingDigits(state)) {
            continue;
          }
          const result = advanceMatchState(state, entry.keySeq, currentCombo);
          if (result.status === "matched" || result.status === "partial") {
            backspaceMatches = true;
            break;
          }
        }
        if (!backspaceMatches) {
          e.preventDefault();
          const newPending = pendingKeysRef.current.slice(0, -1);
          if (newPending.length === 0) {
            clearPending();
            onSequenceCancel?.();
          } else {
            setPendingKeys(newPending);
            matchStatesRef.current.clear();
            for (const combo of newPending) {
              for (const entry of parsedKeymapRef.current) {
                let state = matchStatesRef.current.get(entry.key);
                if (!state) {
                  state = initMatchState(entry.keySeq);
                }
                const result = advanceMatchState(state, entry.keySeq, combo);
                if (result.status === "partial") {
                  matchStatesRef.current.set(entry.key, result.state);
                } else {
                  matchStatesRef.current.delete(entry.key);
                }
              }
            }
          }
          return;
        }
      }
      const newSequence = [...pendingKeysRef.current, currentCombo];
      const completeMatches = [];
      let hasPartials = false;
      const matchStates = matchStatesRef.current;
      const hadPartialMatches = matchStates.size > 0;
      for (const entry of parsedKeymapRef.current) {
        let state = matchStates.get(entry.key);
        if (hadPartialMatches && !state) {
          continue;
        }
        if (!state) {
          state = initMatchState(entry.keySeq);
          matchStates.set(entry.key, state);
        }
        const result = advanceMatchState(state, entry.keySeq, currentCombo);
        if (result.status === "matched") {
          completeMatches.push({
            key: entry.key,
            state: result.state,
            captures: result.captures
          });
          matchStates.delete(entry.key);
        } else if (result.status === "partial") {
          matchStates.set(entry.key, result.state);
          hasPartials = true;
        } else {
          matchStates.delete(entry.key);
        }
      }
      if (completeMatches.length === 1 && !hasPartials) {
        const match = completeMatches[0];
        if (tryExecuteKeySeq(match.key, match.captures, e)) {
          clearPending();
          return;
        }
      }
      if (completeMatches.length > 0 || hasPartials) {
        setPendingKeys(newSequence);
        setIsAwaitingSequence(true);
        if (pendingKeysRef.current.length === 0) {
          onSequenceStart?.(newSequence);
        } else {
          onSequenceProgress?.(newSequence);
        }
        if (preventDefault) {
          e.preventDefault();
        }
        if (Number.isFinite(sequenceTimeout)) {
          setTimeoutStartedAt(Date.now());
          timeoutRef.current = setTimeout(() => {
            for (const [key, state] of matchStates.entries()) {
              if (isCollectingDigits(state)) {
                const finalizedState = finalizeDigits(state);
                const entry = parsedKeymapRef.current.find((e2) => e2.key === key);
                if (entry) {
                  const isComplete = finalizedState.every((elem) => {
                    if (elem.type === "key") return elem.matched === true;
                    if (elem.type === "digit") return elem.value !== void 0;
                    if (elem.type === "digits") return elem.value !== void 0;
                    return false;
                  });
                  if (isComplete) {
                    void extractMatchCaptures(finalizedState);
                  }
                }
              }
            }
            setPendingKeys([]);
            setIsAwaitingSequence(false);
            setTimeoutStartedAt(null);
            matchStatesRef.current.clear();
            onSequenceCancel?.();
            timeoutRef.current = null;
          }, sequenceTimeout);
        }
        return;
      }
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
        setPendingKeys(newSequence);
        if (preventDefault) {
          e.preventDefault();
        }
        return;
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
    tryExecuteKeySeq,
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
  storageKey: "use-kbd",
  sequenceTimeout: DEFAULT_SEQUENCE_TIMEOUT,
  disableConflicts: false,
  // Keep conflicting bindings active; SeqM handles disambiguation
  minViewportWidth: 768,
  enableOnTouch: false
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
  const endpointsRegistry = useOmnibarEndpointsRegistry();
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
  const modalStorageKey = `${config.storageKey}-modal-open`;
  const [isModalOpen, setIsModalOpen] = react.useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(modalStorageKey) === "true";
  });
  react.useEffect(() => {
    sessionStorage.setItem(modalStorageKey, String(isModalOpen));
  }, [modalStorageKey, isModalOpen]);
  const openModal = react.useCallback(() => setIsModalOpen(true), []);
  const closeModal = react.useCallback(() => setIsModalOpen(false), []);
  const toggleModal = react.useCallback(() => setIsModalOpen((prev) => !prev), []);
  const [isOmnibarOpen, setIsOmnibarOpen] = react.useState(false);
  const openOmnibar = react.useCallback(() => setIsOmnibarOpen(true), []);
  const closeOmnibar = react.useCallback(() => setIsOmnibarOpen(false), []);
  const toggleOmnibar = react.useCallback(() => setIsOmnibarOpen((prev) => !prev), []);
  const [isLookupOpen, setIsLookupOpen] = react.useState(false);
  const openLookup = react.useCallback(() => setIsLookupOpen(true), []);
  const closeLookup = react.useCallback(() => setIsLookupOpen(false), []);
  const toggleLookup = react.useCallback(() => setIsLookupOpen((prev) => !prev), []);
  const [isEditingBinding, setIsEditingBinding] = react.useState(false);
  const keymap = registry.keymap;
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
    return map;
  }, [registry.actions]);
  const hotkeysEnabled = isEnabled && !isEditingBinding && !isOmnibarOpen && !isLookupOpen;
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
  react.useEffect(() => {
    if (isAwaitingSequence && isModalOpen) {
      closeModal();
    }
  }, [isAwaitingSequence, isModalOpen, closeModal]);
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
    endpointsRegistry,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    isLookupOpen,
    openLookup,
    closeLookup,
    toggleLookup,
    isEditingBinding,
    setIsEditingBinding,
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
    endpointsRegistry,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    isLookupOpen,
    openLookup,
    closeLookup,
    toggleLookup,
    isEditingBinding,
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
  return /* @__PURE__ */ jsxRuntime.jsx(ActionsRegistryContext.Provider, { value: registry, children: /* @__PURE__ */ jsxRuntime.jsx(OmnibarEndpointsRegistryContext.Provider, { value: endpointsRegistry, children: /* @__PURE__ */ jsxRuntime.jsx(HotkeysContext.Provider, { value, children }) }) });
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
      handler: (e, captures) => {
        if (enabledRef.current) {
          handlerRef.current(e, captures);
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
        handler: (e, captures) => {
          if (enabledRef.current[id]) {
            handlersRef.current[id]?.(e, captures);
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
function useOmnibarEndpoint(id, config) {
  const registry = react.useContext(OmnibarEndpointsRegistryContext);
  if (!registry) {
    throw new Error("useOmnibarEndpoint must be used within a HotkeysProvider");
  }
  const registryRef = react.useRef(registry);
  registryRef.current = registry;
  const fetchRef = react.useRef(config.fetch);
  fetchRef.current = config.fetch;
  const enabledRef = react.useRef(config.enabled ?? true);
  enabledRef.current = config.enabled ?? true;
  react.useEffect(() => {
    registryRef.current.register(id, {
      ...config,
      fetch: async (query, signal, pagination) => {
        if (!enabledRef.current) return { entries: [] };
        return fetchRef.current(query, signal, pagination);
      }
    });
    return () => {
      registryRef.current.unregister(id);
    };
  }, [
    id,
    config.group,
    config.priority,
    config.minQueryLength,
    config.pageSize,
    config.pagination
    // Note: we use refs for fetch and enabled, so they don't cause re-registration
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
    sequenceTimeout = DEFAULT_SEQUENCE_TIMEOUT,
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
  const hashCycleRef = react.useRef(0);
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
    hashCycleRef.current = 0;
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
    hashCycleRef.current = 0;
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
      if (sequenceTimeout === 0) {
        submit(currentSequence);
      } else if (Number.isFinite(sequenceTimeout)) {
        timeoutRef.current = setTimeout(() => {
          submit(currentSequence);
        }, sequenceTimeout);
      }
    }
  }, [pauseTimeout, isRecording, sequenceTimeout, submit]);
  react.useEffect(() => {
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
      let nonModifierKey = "";
      for (const k of pressedKeysRef.current) {
        if (!isModifierKey(k)) {
          nonModifierKey = normalizeKey(k);
          hasNonModifierRef.current = true;
          break;
        }
      }
      const combo = {
        key: nonModifierKey,
        modifiers: {
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey && !isShiftedSymbol(nonModifierKey),
          meta: e.metaKey
        }
      };
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
        let combo = currentComboRef.current;
        pressedKeysRef.current.clear();
        hasNonModifierRef.current = false;
        currentComboRef.current = null;
        setActiveKeys(null);
        let newSequence;
        const noModifiers = !combo.modifiers.ctrl && !combo.modifiers.alt && !combo.modifiers.meta && !combo.modifiers.shift;
        if (combo.key === "#" && noModifiers) {
          const pending = pendingKeysRef.current;
          const lastCombo = pending[pending.length - 1];
          if (hashCycleRef.current === 0) {
            combo = { key: DIGIT_PLACEHOLDER, modifiers: { ctrl: false, alt: false, shift: false, meta: false } };
            newSequence = [...pending, combo];
            hashCycleRef.current = 1;
          } else if (hashCycleRef.current === 1 && lastCombo?.key === DIGIT_PLACEHOLDER) {
            newSequence = [...pending.slice(0, -1), { key: DIGITS_PLACEHOLDER, modifiers: { ctrl: false, alt: false, shift: false, meta: false } }];
            hashCycleRef.current = 2;
          } else if (hashCycleRef.current === 2 && lastCombo?.key === DIGITS_PLACEHOLDER) {
            newSequence = [...pending.slice(0, -1), { key: "#", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }];
            hashCycleRef.current = 3;
          } else {
            combo = { key: DIGIT_PLACEHOLDER, modifiers: { ctrl: false, alt: false, shift: false, meta: false } };
            newSequence = [...pending, combo];
            hashCycleRef.current = 1;
          }
        } else {
          hashCycleRef.current = 0;
          newSequence = [...pendingKeysRef.current, combo];
        }
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
  return {
    isRecording,
    startRecording,
    cancel,
    commit,
    sequence,
    display,
    pendingKeys,
    activeKeys,
    sequenceTimeout
  };
}
function useEditableHotkeys(defaults, handlers, options = {}) {
  const { storageKey, disableConflicts = false, ...hotkeyOptions } = options;
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
var { max: max2, min } = Math;
var DEFAULT_DEBOUNCE_MS = 150;
function useOmnibar(options) {
  const {
    actions,
    handlers,
    keymap = {},
    openKey = "meta+k",
    enabled = true,
    onExecute,
    onExecuteRemote,
    onOpen,
    onClose,
    maxResults = 10,
    endpointsRegistry,
    debounceMs = DEFAULT_DEBOUNCE_MS
  } = options;
  const [isOpen, setIsOpen] = react.useState(false);
  const [query, setQuery] = react.useState("");
  const [selectedIndex, setSelectedIndex] = react.useState(0);
  const [endpointStates, setEndpointStates] = react.useState(/* @__PURE__ */ new Map());
  const handlersRef = react.useRef(handlers);
  handlersRef.current = handlers;
  const onExecuteRef = react.useRef(onExecute);
  onExecuteRef.current = onExecute;
  const onExecuteRemoteRef = react.useRef(onExecuteRemote);
  onExecuteRemoteRef.current = onExecuteRemote;
  const abortControllerRef = react.useRef(null);
  const debounceTimerRef = react.useRef(null);
  const currentQueryRef = react.useRef(query);
  currentQueryRef.current = query;
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
  react.useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (!endpointsRegistry || !query.trim()) {
      setEndpointStates(/* @__PURE__ */ new Map());
      return;
    }
    setEndpointStates((prev) => {
      const next = new Map(prev);
      for (const [id] of endpointsRegistry.endpoints) {
        next.set(id, { entries: [], offset: 0, isLoading: true });
      }
      return next;
    });
    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        const endpointResults = await endpointsRegistry.queryAll(query, controller.signal);
        if (controller.signal.aborted) return;
        setEndpointStates(() => {
          const next = /* @__PURE__ */ new Map();
          for (const epResult of endpointResults) {
            const ep = endpointsRegistry.endpoints.get(epResult.endpointId);
            const pageSize = ep?.config.pageSize ?? 10;
            next.set(epResult.endpointId, {
              entries: epResult.entries,
              offset: pageSize,
              total: epResult.total,
              hasMore: epResult.hasMore ?? (epResult.total !== void 0 ? epResult.entries.length < epResult.total : void 0),
              isLoading: false
            });
          }
          return next;
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Omnibar endpoint query failed:", error);
        setEndpointStates((prev) => {
          const next = new Map(prev);
          for (const [id, state] of next) {
            next.set(id, { ...state, isLoading: false });
          }
          return next;
        });
      }
    }, debounceMs);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, endpointsRegistry, debounceMs]);
  const loadMore = react.useCallback(async (endpointId) => {
    if (!endpointsRegistry) return;
    const currentState = endpointStates.get(endpointId);
    if (!currentState || currentState.isLoading) return;
    if (currentState.hasMore === false) return;
    const ep = endpointsRegistry.endpoints.get(endpointId);
    if (!ep) return;
    const pageSize = ep.config.pageSize ?? 10;
    setEndpointStates((prev) => {
      const next = new Map(prev);
      const state = next.get(endpointId);
      if (state) {
        next.set(endpointId, { ...state, isLoading: true });
      }
      return next;
    });
    try {
      const controller = new AbortController();
      const result = await endpointsRegistry.queryEndpoint(
        endpointId,
        currentQueryRef.current,
        { offset: currentState.offset, limit: pageSize },
        controller.signal
      );
      if (!result) return;
      setEndpointStates((prev) => {
        const next = new Map(prev);
        const state = next.get(endpointId);
        if (state) {
          next.set(endpointId, {
            entries: [...state.entries, ...result.entries],
            offset: state.offset + pageSize,
            total: result.total ?? state.total,
            hasMore: result.hasMore ?? (result.total !== void 0 ? state.entries.length + result.entries.length < result.total : void 0),
            isLoading: false
          });
        }
        return next;
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error(`Omnibar loadMore failed for ${endpointId}:`, error);
      setEndpointStates((prev) => {
        const next = new Map(prev);
        const state = next.get(endpointId);
        if (state) {
          next.set(endpointId, { ...state, isLoading: false });
        }
        return next;
      });
    }
  }, [endpointsRegistry, endpointStates]);
  const remoteResults = react.useMemo(() => {
    if (!endpointsRegistry) return [];
    const processed = [];
    for (const [endpointId, state] of endpointStates) {
      const endpoint = endpointsRegistry.endpoints.get(endpointId);
      const priority = endpoint?.config.priority ?? 0;
      for (const entry of state.entries) {
        const labelMatch = fuzzyMatch(query, entry.label);
        const descMatch = entry.description ? fuzzyMatch(query, entry.description) : null;
        const keywordsMatch = entry.keywords?.map((k) => fuzzyMatch(query, k)) ?? [];
        let score = 0;
        let labelMatches = [];
        if (labelMatch.matched) {
          score = Math.max(score, labelMatch.score * 3);
          labelMatches = labelMatch.ranges;
        }
        if (descMatch?.matched) {
          score = Math.max(score, descMatch.score * 1.5);
        }
        for (const km of keywordsMatch) {
          if (km.matched) {
            score = Math.max(score, km.score * 2);
          }
        }
        processed.push({
          id: `${endpointId}:${entry.id}`,
          entry,
          endpointId,
          priority,
          score: score || 1,
          labelMatches
        });
      }
    }
    processed.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.score - a.score;
    });
    return processed;
  }, [endpointStates, endpointsRegistry, query]);
  const isLoadingRemote = react.useMemo(() => {
    for (const [, state] of endpointStates) {
      if (state.isLoading) return true;
    }
    return false;
  }, [endpointStates]);
  const endpointPagination = react.useMemo(() => {
    const info = /* @__PURE__ */ new Map();
    if (!endpointsRegistry) return info;
    for (const [endpointId, state] of endpointStates) {
      const ep = endpointsRegistry.endpoints.get(endpointId);
      info.set(endpointId, {
        endpointId,
        loaded: state.entries.length,
        total: state.total,
        hasMore: state.hasMore ?? false,
        isLoading: state.isLoading,
        mode: ep?.config.pagination ?? "none"
      });
    }
    return info;
  }, [endpointStates, endpointsRegistry]);
  const totalResults = results.length + remoteResults.length;
  const completions = react.useMemo(() => {
    return getSequenceCompletions(pendingKeys, keymap);
  }, [pendingKeys, keymap]);
  react.useEffect(() => {
    setSelectedIndex(0);
  }, [results, remoteResults]);
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
    setSelectedIndex((prev) => min(prev + 1, totalResults - 1));
  }, [totalResults]);
  const selectPrev = react.useCallback(() => {
    setSelectedIndex((prev) => max2(prev - 1, 0));
  }, []);
  const resetSelection = react.useCallback(() => {
    setSelectedIndex(0);
  }, []);
  const execute = react.useCallback((actionId) => {
    const localCount = results.length;
    if (actionId) {
      const remoteResult = remoteResults.find((r) => r.id === actionId);
      if (remoteResult) {
        close();
        const entry = remoteResult.entry;
        if ("handler" in entry && entry.handler) {
          entry.handler();
        }
        onExecuteRemoteRef.current?.(entry);
        return;
      }
      close();
      if (handlersRef.current?.[actionId]) {
        const event = new KeyboardEvent("keydown", { key: "Enter" });
        handlersRef.current[actionId](event);
      }
      onExecuteRef.current?.(actionId);
      return;
    }
    if (selectedIndex < localCount) {
      const id = results[selectedIndex]?.id;
      if (!id) return;
      close();
      if (handlersRef.current?.[id]) {
        const event = new KeyboardEvent("keydown", { key: "Enter" });
        handlersRef.current[id](event);
      }
      onExecuteRef.current?.(id);
    } else {
      const remoteIndex = selectedIndex - localCount;
      const remoteResult = remoteResults[remoteIndex];
      if (!remoteResult) return;
      close();
      const entry = remoteResult.entry;
      if ("handler" in entry && entry.handler) {
        entry.handler();
      }
      onExecuteRemoteRef.current?.(entry);
    }
  }, [results, remoteResults, selectedIndex, close]);
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
    remoteResults,
    isLoadingRemote,
    endpointPagination,
    loadMore,
    selectedIndex,
    totalResults,
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
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 19V5M5 12l7-7 7 7" })
    }
  );
}
function Down({ className, style }) {
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
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 5v14M5 12l7 7 7-7" })
    }
  );
}
function Left({ className, style }) {
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
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M19 12H5M12 5l-7 7 7 7" })
    }
  );
}
function Right({ className, style }) {
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
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M5 12h14M12 5l7 7-7 7" })
    }
  );
}
function Enter({ className, style }) {
  return /* @__PURE__ */ jsxRuntime.jsxs(
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
        /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M9 10l-4 4 4 4" }),
        /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M19 6v8a2 2 0 01-2 2H5" })
      ]
    }
  );
}
function Backspace({ className, style }) {
  return /* @__PURE__ */ jsxRuntime.jsxs(
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
        /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" }),
        /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "18", y1: "9", x2: "12", y2: "15" }),
        /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "12", y1: "9", x2: "18", y2: "15" })
      ]
    }
  );
}
function Tab({ className, style }) {
  return /* @__PURE__ */ jsxRuntime.jsxs(
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
        /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "4", y1: "12", x2: "16", y2: "12" }),
        /* @__PURE__ */ jsxRuntime.jsx("polyline", { points: "12 8 16 12 12 16" }),
        /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "20", y1: "6", x2: "20", y2: "18" })
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
    case "tab":
      return Tab;
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
var Command = react.forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "svg",
    {
      ref,
      className,
      style: { ...baseStyle2, ...style },
      viewBox: "0 0 24 24",
      fill: "currentColor",
      ...props,
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M6 4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v4H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2h4v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2v-4h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2h-4V6a2 2 0 0 0-2-2H6zm4 6h4v4h-4v-4z" })
    }
  )
);
Command.displayName = "Command";
var Ctrl = react.forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
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
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M6 15l6-6 6 6" })
    }
  )
);
Ctrl.displayName = "Ctrl";
var Shift = react.forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
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
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M14 3L3 14h6v7h10v-7h6L14 3z" })
    }
  )
);
Shift.displayName = "Shift";
var Option = react.forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
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
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M4 6h6l8 12h6M14 6h6" })
    }
  )
);
Option.displayName = "Option";
var Alt = react.forwardRef(
  ({ className, style, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
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
      children: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M4 18h8M12 18l4-6M12 18l4 0M16 12l4-6h-8" })
    }
  )
);
Alt.displayName = "Alt";
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
      return isMac() ? Option : Alt;
  }
}
var ModifierIcon = react.forwardRef(
  ({ modifier, ...props }, ref) => {
    const Icon = getModifierIcon(modifier);
    return /* @__PURE__ */ jsxRuntime.jsx(Icon, { ref, ...props });
  }
);
ModifierIcon.displayName = "ModifierIcon";
function renderModifierIcons(modifiers, className = "kbd-modifier-icon") {
  const icons = [];
  if (modifiers.meta) {
    icons.push(/* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "meta", className }, "meta"));
  }
  if (modifiers.ctrl) {
    icons.push(/* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "ctrl", className }, "ctrl"));
  }
  if (modifiers.alt) {
    icons.push(/* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "alt", className }, "alt"));
  }
  if (modifiers.shift) {
    icons.push(/* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "shift", className }, "shift"));
  }
  return icons;
}
function renderKeyContent(key, iconClassName = "kbd-key-icon") {
  const Icon = getKeyIcon(key);
  const displayKey = formatKeyForDisplay(key);
  return Icon ? /* @__PURE__ */ jsxRuntime.jsx(Icon, { className: iconClassName }) : /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: displayKey });
}
function renderSeqElem(elem, index, kbdClassName = "kbd-kbd") {
  if (elem.type === "digit") {
    return /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: kbdClassName, children: "\u27E8#\u27E9" }, index);
  }
  if (elem.type === "digits") {
    return /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: kbdClassName, children: "\u27E8##\u27E9" }, index);
  }
  return /* @__PURE__ */ jsxRuntime.jsxs("kbd", { className: kbdClassName, children: [
    renderModifierIcons(elem.modifiers),
    renderKeyContent(elem.key)
  ] }, index);
}
function renderKeySeq(keySeq, kbdClassName = "kbd-kbd") {
  return keySeq.map((elem, i) => renderSeqElem(elem, i, kbdClassName));
}
function KeyCombo({ combo }) {
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    renderModifierIcons(combo.modifiers),
    renderKeyContent(combo.key)
  ] });
}
function SeqElemDisplay({ elem }) {
  if (elem.type === "digit") {
    return /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-placeholder", title: "Any single digit (0-9)", children: "#" });
  }
  if (elem.type === "digits") {
    return /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-placeholder", title: "One or more digits (0-9)", children: "##" });
  }
  return /* @__PURE__ */ jsxRuntime.jsx(KeyCombo, { combo: { key: elem.key, modifiers: elem.modifiers } });
}
function BindingDisplay({ binding }) {
  const sequence = parseKeySeq(binding);
  return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: sequence.map((elem, i) => /* @__PURE__ */ jsxRuntime.jsxs(react.Fragment, { children: [
    i > 0 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-sequence-sep", children: " " }),
    /* @__PURE__ */ jsxRuntime.jsx(SeqElemDisplay, { elem })
  ] }, i)) });
}
function Kbd({
  action,
  separator = " / ",
  all = false,
  fallback = null,
  className,
  clickable = true
}) {
  const ctx = useMaybeHotkeysContext();
  const warnedRef = react.useRef(false);
  const bindings = ctx ? all ? ctx.registry.getBindingsForAction(action) : [ctx.registry.getFirstBindingForAction(action)].filter(Boolean) : [];
  react.useEffect(() => {
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
    return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: fallback });
  }
  const content = bindings.map((binding, i) => /* @__PURE__ */ jsxRuntime.jsxs(react.Fragment, { children: [
    i > 0 && separator,
    /* @__PURE__ */ jsxRuntime.jsx(BindingDisplay, { binding })
  ] }, binding));
  if (clickable) {
    return /* @__PURE__ */ jsxRuntime.jsx(
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
  return /* @__PURE__ */ jsxRuntime.jsx("kbd", { className, children: content });
}
function Key(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(Kbd, { ...props, clickable: false });
}
function Kbds(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(Kbd, { ...props, all: true });
}
function KbdModal(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(Kbd, { ...props, action: ACTION_MODAL });
}
function KbdOmnibar(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(Kbd, { ...props, action: ACTION_OMNIBAR });
}
function KbdLookup(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(Kbd, { ...props, action: ACTION_LOOKUP });
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
      const combo = parseHotkeyString(key);
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
function LookupModal({ defaultBinding = "meta+shift+k" } = {}) {
  const {
    isLookupOpen,
    closeLookup,
    toggleLookup,
    registry,
    executeAction
  } = useHotkeysContext();
  useAction(ACTION_LOOKUP, {
    label: "Key lookup",
    group: "Global",
    defaultBindings: defaultBinding ? [defaultBinding] : [],
    handler: react.useCallback(() => toggleLookup(), [toggleLookup])
  });
  const [pendingKeys, setPendingKeys] = react.useState([]);
  const [selectedIndex, setSelectedIndex] = react.useState(0);
  const allBindings = react.useMemo(() => {
    const results = [];
    const keymap = registry.keymap;
    for (const [binding, actionOrActions] of Object.entries(keymap)) {
      if (binding.startsWith("__")) continue;
      const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
      const sequence = parseHotkeyString(binding);
      const keySeq = parseKeySeq(binding);
      const display = formatKeySeq(keySeq).display;
      const labels = actions.map((actionId) => {
        const action = registry.actions.get(actionId);
        return action?.config.label || actionId;
      });
      results.push({ binding, sequence, keySeq, display, actions, labels });
    }
    results.sort((a, b) => a.binding.localeCompare(b.binding));
    return results;
  }, [registry.keymap, registry.actions]);
  const filteredBindings = react.useMemo(() => {
    if (pendingKeys.length === 0) return allBindings;
    return allBindings.filter((result) => {
      const keySeq = result.keySeq;
      if (keySeq.length < pendingKeys.length) return false;
      let keySeqIdx = 0;
      for (let i = 0; i < pendingKeys.length && keySeqIdx < keySeq.length; i++) {
        const pending = pendingKeys[i];
        const elem = keySeq[keySeqIdx];
        const isDigit2 = /^[0-9]$/.test(pending.key);
        if (elem.type === "digits") {
          if (!isDigit2) return false;
          if (i + 1 < pendingKeys.length && /^[0-9]$/.test(pendingKeys[i + 1].key)) {
            continue;
          }
          keySeqIdx++;
        } else if (elem.type === "digit") {
          if (!isDigit2) return false;
          keySeqIdx++;
        } else {
          if (pending.key !== elem.key) return false;
          if (pending.modifiers.ctrl !== elem.modifiers.ctrl) return false;
          if (pending.modifiers.alt !== elem.modifiers.alt) return false;
          if (pending.modifiers.shift !== elem.modifiers.shift) return false;
          if (pending.modifiers.meta !== elem.modifiers.meta) return false;
          keySeqIdx++;
        }
      }
      return true;
    });
  }, [allBindings, pendingKeys]);
  const groupedByNextKey = react.useMemo(() => {
    const groups = /* @__PURE__ */ new Map();
    for (const result of filteredBindings) {
      if (result.sequence.length > pendingKeys.length) {
        const nextCombo = result.sequence[pendingKeys.length];
        const nextKey = formatCombination([nextCombo]).display;
        const existing = groups.get(nextKey) || [];
        existing.push(result);
        groups.set(nextKey, existing);
      } else {
        const existing = groups.get("") || [];
        existing.push(result);
        groups.set("", existing);
      }
    }
    return groups;
  }, [filteredBindings, pendingKeys]);
  const formattedPendingKeys = react.useMemo(() => {
    if (pendingKeys.length === 0) return "";
    return formatCombination(pendingKeys).display;
  }, [pendingKeys]);
  react.useEffect(() => {
    if (isLookupOpen) {
      setPendingKeys([]);
      setSelectedIndex(0);
    }
  }, [isLookupOpen]);
  react.useEffect(() => {
    setSelectedIndex(0);
  }, [filteredBindings.length]);
  react.useEffect(() => {
    if (!isLookupOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (pendingKeys.length > 0) {
          setPendingKeys([]);
        } else {
          closeLookup();
        }
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setPendingKeys((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredBindings.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredBindings[selectedIndex];
        if (selected && selected.actions.length > 0) {
          closeLookup();
          executeAction(selected.actions[0]);
        }
        return;
      }
      if (isModifierKey(e.key)) return;
      e.preventDefault();
      const newCombo = {
        key: normalizeKey(e.key),
        modifiers: {
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey
        }
      };
      setPendingKeys((prev) => [...prev, newCombo]);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLookupOpen, pendingKeys, filteredBindings, selectedIndex, closeLookup, executeAction]);
  const handleBackdropClick = react.useCallback(() => {
    closeLookup();
  }, [closeLookup]);
  if (!isLookupOpen) return null;
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-lookup-backdrop", onClick: handleBackdropClick, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-lookup", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-lookup-header", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-lookup-search", children: formattedPendingKeys ? /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "kbd-sequence-keys", children: formattedPendingKeys }) : /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-lookup-placeholder", children: "Type keys to filter..." }) }),
      /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "kbd-lookup-hint", children: [
        "\u2191\u2193 navigate \xB7 Enter select \xB7 Esc ",
        pendingKeys.length > 0 ? "clear" : "close",
        " \xB7 \u232B back"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-lookup-results", children: filteredBindings.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-lookup-empty", children: "No matching shortcuts" }) : filteredBindings.map((result, index) => /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        className: `kbd-lookup-result ${index === selectedIndex ? "selected" : ""}`,
        onClick: () => {
          closeLookup();
          if (result.actions.length > 0) {
            executeAction(result.actions[0]);
          }
        },
        onMouseEnter: () => setSelectedIndex(index),
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-lookup-binding", children: renderKeySeq(result.keySeq) }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-lookup-labels", children: result.labels.join(", ") })
        ]
      },
      result.binding
    )) }),
    pendingKeys.length > 0 && groupedByNextKey.size > 1 && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-lookup-continuations", children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-lookup-continuations-label", children: "Continue with:" }),
      Array.from(groupedByNextKey.keys()).filter((k) => k !== "").slice(0, 8).map((nextKey) => /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "kbd-kbd kbd-small", children: nextKey }, nextKey)),
      groupedByNextKey.size > 9 && /* @__PURE__ */ jsxRuntime.jsx("span", { children: "..." })
    ] })
  ] }) });
}
function SeqElemBadge({ elem }) {
  if (elem.type === "digit") {
    return /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-placeholder", title: "Any single digit (0-9)", children: "#" });
  }
  if (elem.type === "digits") {
    return /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-placeholder", title: "One or more digits (0-9)", children: "##" });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    elem.modifiers.meta && /* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "meta", className: "kbd-modifier-icon" }),
    elem.modifiers.ctrl && /* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "ctrl", className: "kbd-modifier-icon" }),
    elem.modifiers.alt && /* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "alt", className: "kbd-modifier-icon" }),
    elem.modifiers.shift && /* @__PURE__ */ jsxRuntime.jsx(ModifierIcon, { modifier: "shift", className: "kbd-modifier-icon" }),
    /* @__PURE__ */ jsxRuntime.jsx("span", { children: formatKeyForDisplay(elem.key) })
  ] });
}
function BindingBadge({ binding }) {
  const keySeq = parseKeySeq(binding);
  return /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "kbd-kbd", children: keySeq.map((elem, i) => /* @__PURE__ */ jsxRuntime.jsxs(react.Fragment, { children: [
    i > 0 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-sequence-sep", children: " " }),
    /* @__PURE__ */ jsxRuntime.jsx(SeqElemBadge, { elem })
  ] }, i)) });
}
function Omnibar({
  actions: actionsProp,
  handlers: handlersProp,
  keymap: keymapProp,
  defaultBinding = "meta+k",
  isOpen: isOpenProp,
  onOpen: onOpenProp,
  onClose: onCloseProp,
  onExecute: onExecuteProp,
  onExecuteRemote: onExecuteRemoteProp,
  maxResults = 10,
  placeholder = "Type a command...",
  children,
  backdropClassName = "kbd-omnibar-backdrop",
  omnibarClassName = "kbd-omnibar"
}) {
  const inputRef = react.useRef(null);
  const ctx = useMaybeHotkeysContext();
  const actions = actionsProp ?? ctx?.registry.actionRegistry ?? {};
  const keymap = keymapProp ?? ctx?.registry.keymap ?? {};
  useAction(ACTION_OMNIBAR, {
    label: "Command palette",
    group: "Global",
    defaultBindings: defaultBinding ? [defaultBinding] : [],
    handler: react.useCallback(() => ctx?.toggleOmnibar(), [ctx?.toggleOmnibar])
  });
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
  const handleExecuteRemote = react.useCallback((entry) => {
    if (onExecuteRemoteProp) {
      onExecuteRemoteProp(entry);
    } else if ("href" in entry && entry.href) {
      window.location.href = entry.href;
    }
  }, [onExecuteRemoteProp]);
  const {
    isOpen: internalIsOpen,
    close,
    query,
    setQuery,
    results,
    remoteResults,
    isLoadingRemote,
    endpointPagination,
    loadMore,
    selectedIndex,
    totalResults,
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
    openKey: "",
    // Trigger is handled via useAction, not useOmnibar
    enabled: false,
    onOpen: handleOpen,
    onClose: handleClose,
    onExecute: handleExecute,
    onExecuteRemote: handleExecuteRemote,
    maxResults,
    endpointsRegistry: ctx?.endpointsRegistry
  });
  const isOpen = isOpenProp ?? ctx?.isOmnibarOpen ?? internalIsOpen;
  const resultsContainerRef = react.useRef(null);
  const sentinelRefs = react.useRef(/* @__PURE__ */ new Map());
  const remoteResultsByEndpoint = react.useMemo(() => {
    const grouped = /* @__PURE__ */ new Map();
    for (const result of remoteResults) {
      const existing = grouped.get(result.endpointId) ?? [];
      existing.push(result);
      grouped.set(result.endpointId, existing);
    }
    return grouped;
  }, [remoteResults]);
  react.useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);
  react.useEffect(() => {
    if (!isOpen) return;
    const container = resultsContainerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const endpointId = entry.target.dataset.endpointId;
          if (!endpointId) continue;
          const paginationInfo = endpointPagination.get(endpointId);
          if (!paginationInfo) continue;
          if (paginationInfo.mode !== "scroll") continue;
          if (!paginationInfo.hasMore) continue;
          if (paginationInfo.isLoading) continue;
          loadMore(endpointId);
        }
      },
      {
        root: container,
        rootMargin: "100px",
        // Trigger slightly before sentinel is visible
        threshold: 0
      }
    );
    for (const [_endpointId, sentinel] of sentinelRefs.current) {
      if (sentinel) {
        observer.observe(sentinel);
      }
    }
    return () => observer.disconnect();
  }, [isOpen, endpointPagination, loadMore]);
  react.useEffect(() => {
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
      remoteResults,
      isLoadingRemote,
      endpointPagination,
      loadMore,
      selectedIndex,
      totalResults,
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
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-omnibar-results", ref: resultsContainerRef, children: totalResults === 0 && !isLoadingRemote ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-omnibar-no-results", children: query ? "No matching commands" : "Start typing to search commands..." }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      results.map((result, i) => /* @__PURE__ */ jsxRuntime.jsxs(
        "div",
        {
          className: `kbd-omnibar-result ${i === selectedIndex ? "selected" : ""}`,
          onClick: () => execute(result.id),
          children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-omnibar-result-label", children: result.action.label }),
            result.action.group && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-omnibar-result-category", children: result.action.group }),
            result.bindings.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-omnibar-result-bindings", children: result.bindings.slice(0, 2).map((binding) => /* @__PURE__ */ jsxRuntime.jsx(BindingBadge, { binding }, binding)) })
          ]
        },
        result.id
      )),
      (() => {
        let remoteIndex = 0;
        return Array.from(remoteResultsByEndpoint.entries()).map(([endpointId, endpointResults]) => {
          const paginationInfo = endpointPagination.get(endpointId);
          const showPagination = paginationInfo?.mode === "scroll" && paginationInfo.total !== void 0;
          return /* @__PURE__ */ jsxRuntime.jsxs(react.Fragment, { children: [
            endpointResults.map((result) => {
              const absoluteIndex = results.length + remoteIndex;
              remoteIndex++;
              return /* @__PURE__ */ jsxRuntime.jsxs(
                "div",
                {
                  className: `kbd-omnibar-result ${absoluteIndex === selectedIndex ? "selected" : ""}`,
                  onClick: () => execute(result.id),
                  children: [
                    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-omnibar-result-label", children: result.entry.label }),
                    result.entry.group && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-omnibar-result-category", children: result.entry.group }),
                    result.entry.description && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-omnibar-result-description", children: result.entry.description })
                  ]
                },
                result.id
              );
            }),
            paginationInfo?.mode === "scroll" && /* @__PURE__ */ jsxRuntime.jsx(
              "div",
              {
                className: "kbd-omnibar-pagination",
                ref: (el) => sentinelRefs.current.set(endpointId, el),
                "data-endpoint-id": endpointId,
                children: paginationInfo.isLoading ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-omnibar-pagination-loading", children: "Loading more..." }) : showPagination ? /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "kbd-omnibar-pagination-info", children: [
                  paginationInfo.loaded,
                  " of ",
                  paginationInfo.total
                ] }) : paginationInfo.hasMore ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-omnibar-pagination-more", children: "Scroll for more..." }) : null
              }
            )
          ] }, endpointId);
        });
      })(),
      isLoadingRemote && remoteResults.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-omnibar-loading", children: "Searching..." })
    ] }) })
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
    registry,
    executeAction
  } = useHotkeysContext();
  const [selectedIndex, setSelectedIndex] = react.useState(0);
  const [hasInteracted, setHasInteracted] = react.useState(false);
  const completions = react.useMemo(() => {
    if (pendingKeys.length === 0) return [];
    return getCompletions(pendingKeys);
  }, [getCompletions, pendingKeys]);
  const flatCompletions = react.useMemo(() => {
    const items = [];
    for (const c of completions) {
      for (const action of c.actions) {
        const displayKey = c.isComplete ? "\u21B5" : c.nextKeys;
        items.push({
          completion: c,
          action,
          displayKey,
          isComplete: c.isComplete
        });
      }
    }
    return items;
  }, [completions]);
  const itemCount = flatCompletions.length;
  const shouldShowTimeout = timeoutStartedAt !== null && completions.length === 1 && !hasInteracted;
  react.useEffect(() => {
    setSelectedIndex(0);
    setHasInteracted(false);
  }, [pendingKeys]);
  const executeSelected = react.useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < flatCompletions.length) {
      const item = flatCompletions[selectedIndex];
      executeAction(item.action, item.completion.captures);
      cancelSequence();
    }
  }, [selectedIndex, flatCompletions, executeAction, cancelSequence]);
  react.useEffect(() => {
    if (!isAwaitingSequence || pendingKeys.length === 0) return;
    const handleKeyDown = (e) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.min(prev + 1, itemCount - 1));
          setHasInteracted(true);
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          setHasInteracted(true);
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          executeSelected();
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isAwaitingSequence, pendingKeys.length, itemCount, executeSelected]);
  const renderKey = react.useCallback((combo, index) => {
    const { key, modifiers } = combo;
    return /* @__PURE__ */ jsxRuntime.jsxs("kbd", { className: "kbd-kbd", children: [
      renderModifierIcons(modifiers),
      renderKeyContent(key)
    ] }, index);
  }, []);
  const getActionLabel = (actionId, captures) => {
    const action = registry.actions.get(actionId);
    let label = action?.config.label || actionId;
    if (captures && captures.length > 0) {
      let captureIdx = 0;
      label = label.replace(/\bN\b/g, () => {
        if (captureIdx < captures.length) {
          return String(captures[captureIdx++]);
        }
        return "N";
      });
    }
    return label;
  };
  if (!isAwaitingSequence || pendingKeys.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-sequence-backdrop", onClick: cancelSequence, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-sequence", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-sequence-current", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-sequence-keys", children: pendingKeys.map((combo, i) => renderKey(combo, i)) }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-sequence-ellipsis", children: "\u2026" })
    ] }),
    shouldShowTimeout && /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        className: "kbd-sequence-timeout",
        style: { animationDuration: `${sequenceTimeout}ms` }
      },
      timeoutStartedAt
    ),
    flatCompletions.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-sequence-completions", children: flatCompletions.map((item, index) => /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        className: `kbd-sequence-completion ${index === selectedIndex ? "selected" : ""} ${item.isComplete ? "complete" : ""}`,
        children: [
          item.isComplete ? /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "kbd-kbd", children: "\u21B5" }) : item.completion.nextKeySeq ? renderKeySeq(item.completion.nextKeySeq) : /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "kbd-kbd", children: item.displayKey }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-sequence-arrow", children: "\u2192" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-sequence-actions", children: getActionLabel(item.action, item.completion.captures) })
        ]
      },
      `${item.completion.fullSequence}-${item.action}`
    )) }),
    flatCompletions.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "kbd-sequence-empty", children: "No matching shortcuts" })
  ] }) });
}
var DefaultTooltip = ({ children }) => /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children });
var TooltipContext = react.createContext(DefaultTooltip);
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
    if (actionRegistry?.[actionId]?.hideFromModal) continue;
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
      if (action.hideFromModal) continue;
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
  return /* @__PURE__ */ jsxRuntime.jsxs("span", { className, children: [
    renderModifierIcons(combo.modifiers),
    renderKeyContent(combo.key)
  ] });
}
function SeqElemDisplay2({ elem, className }) {
  const Tooltip = react.useContext(TooltipContext);
  if (elem.type === "digit") {
    return /* @__PURE__ */ jsxRuntime.jsx(Tooltip, { title: "Any single digit (0-9)", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: `kbd-placeholder ${className || ""}`, children: "#" }) });
  }
  if (elem.type === "digits") {
    return /* @__PURE__ */ jsxRuntime.jsx(Tooltip, { title: "One or more digits (0-9)", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: `kbd-placeholder ${className || ""}`, children: "##" }) });
  }
  return /* @__PURE__ */ jsxRuntime.jsx(KeyDisplay, { combo: { key: elem.key, modifiers: elem.modifiers }, className });
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
  const keySeq = parseKeySeq(binding);
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
      content = /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        pendingKeys.map((combo, i) => /* @__PURE__ */ jsxRuntime.jsxs(react.Fragment, { children: [
          i > 0 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-sequence-sep", children: " " }),
          /* @__PURE__ */ jsxRuntime.jsx(KeyDisplay, { combo })
        ] }, i)),
        activeKeys && activeKeys.key && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-sequence-sep", children: " \u2192 " }),
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
      content = "...";
    }
    return /* @__PURE__ */ jsxRuntime.jsxs("kbd", { className: kbdClassName, tabIndex: editable ? 0 : void 0, children: [
      content,
      pendingKeys && pendingKeys.length > 0 && Number.isFinite(timeoutDuration) && /* @__PURE__ */ jsxRuntime.jsx(
        "span",
        {
          className: "kbd-timeout-bar",
          style: { animationDuration: `${timeoutDuration}ms` }
        },
        pendingKeys.length
      )
    ] });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs("kbd", { className: kbdClassName, onClick: handleClick, tabIndex: editable ? 0 : void 0, onKeyDown: editable && onEdit ? (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onEdit();
    }
  } : void 0, children: [
    keySeq.length > 1 ? keySeq.map((elem, i) => /* @__PURE__ */ jsxRuntime.jsxs(react.Fragment, { children: [
      i > 0 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-sequence-sep", children: " " }),
      /* @__PURE__ */ jsxRuntime.jsx(SeqElemDisplay2, { elem })
    ] }, i)) : keySeq.length === 1 ? /* @__PURE__ */ jsxRuntime.jsx(SeqElemDisplay2, { elem: keySeq[0] }) : (
      // Fallback for legacy parsing
      /* @__PURE__ */ jsxRuntime.jsx(KeyDisplay, { combo: sequence[0] })
    ),
    editable && onRemove && /* @__PURE__ */ jsxRuntime.jsx(
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
  defaultBinding = "?",
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
  showUnbound,
  TooltipComponent: TooltipComponentProp = DefaultTooltip
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
  const [internalIsOpen, setInternalIsOpen] = react.useState(false);
  const isOpen = isOpenProp ?? ctx?.isModalOpen ?? internalIsOpen;
  const [editingAction, setEditingAction] = react.useState(null);
  const [editingKey, setEditingKey] = react.useState(null);
  const [addingAction, setAddingAction] = react.useState(null);
  const [pendingConflict, setPendingConflict] = react.useState(null);
  const [hasPendingConflictState, setHasPendingConflictState] = react.useState(false);
  const editingActionRef = react.useRef(null);
  const editingKeyRef = react.useRef(null);
  const addingActionRef = react.useRef(null);
  const setIsEditingBindingRef = react.useRef(ctx?.setIsEditingBinding);
  setIsEditingBindingRef.current = ctx?.setIsEditingBinding;
  const conflicts = react.useMemo(() => findConflicts(keymap), [keymap]);
  const actionBindings = react.useMemo(() => getActionBindings(keymap), [keymap]);
  const close = react.useCallback(() => {
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
  useAction(ACTION_MODAL, {
    label: "Show shortcuts",
    group: "Global",
    defaultBindings: defaultBinding ? [defaultBinding] : [],
    handler: react.useCallback(() => {
      if (ctx) {
        ctx.toggleModal();
      } else {
        setInternalIsOpen((prev) => !prev);
      }
    }, [ctx])
  });
  const checkConflict = react.useCallback((newKey, forAction) => {
    const existingActions = keymap[newKey];
    if (!existingActions) return null;
    const actions = Array.isArray(existingActions) ? existingActions : [existingActions];
    const conflicts2 = actions.filter((a) => a !== forAction);
    return conflicts2.length > 0 ? conflicts2 : null;
  }, [keymap]);
  const combinationsEqual2 = react.useCallback((a, b) => {
    return a.key === b.key && a.modifiers.ctrl === b.modifiers.ctrl && a.modifiers.alt === b.modifiers.alt && a.modifiers.shift === b.modifiers.shift && a.modifiers.meta === b.modifiers.meta;
  }, []);
  const isSequencePrefix = react.useCallback((a, b) => {
    if (a.length >= b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!combinationsEqual2(a[i], b[i])) return false;
    }
    return true;
  }, [combinationsEqual2]);
  const sequencesEqual = react.useCallback((a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!combinationsEqual2(a[i], b[i])) return false;
    }
    return true;
  }, [combinationsEqual2]);
  const { isRecording, startRecording, cancel, pendingKeys, activeKeys, sequenceTimeout } = useRecordHotkey({
    onCapture: react.useCallback(
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
        setIsEditingBindingRef.current?.(false);
      },
      [checkConflict, handleBindingChange, handleBindingAdd]
    ),
    onCancel: react.useCallback(() => {
      editingActionRef.current = null;
      editingKeyRef.current = null;
      addingActionRef.current = null;
      setEditingAction(null);
      setEditingKey(null);
      setAddingAction(null);
      setPendingConflict(null);
      setIsEditingBindingRef.current?.(false);
    }, []),
    // Tab to next/prev editable kbd and start editing
    onTab: react.useCallback(() => {
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
    onShiftTab: react.useCallback(() => {
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
  const startEditingBinding = react.useCallback(
    (action, key) => {
      addingActionRef.current = null;
      editingActionRef.current = action;
      editingKeyRef.current = key;
      setAddingAction(null);
      setEditingAction(action);
      setEditingKey(key);
      setPendingConflict(null);
      ctx?.setIsEditingBinding(true);
      startRecording();
    },
    [startRecording, ctx?.setIsEditingBinding]
  );
  const startAddingBinding = react.useCallback(
    (action) => {
      editingActionRef.current = null;
      editingKeyRef.current = null;
      addingActionRef.current = action;
      setEditingAction(null);
      setEditingKey(null);
      setAddingAction(action);
      setPendingConflict(null);
      ctx?.setIsEditingBinding(true);
      startRecording();
    },
    [startRecording, ctx?.setIsEditingBinding]
  );
  const startEditing = react.useCallback(
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
  const cancelEditing = react.useCallback(() => {
    cancel();
    editingActionRef.current = null;
    editingKeyRef.current = null;
    addingActionRef.current = null;
    setEditingAction(null);
    setEditingKey(null);
    setAddingAction(null);
    setPendingConflict(null);
    ctx?.setIsEditingBinding(false);
  }, [cancel, ctx?.setIsEditingBinding]);
  const removeBinding = react.useCallback(
    (action, key) => {
      handleBindingRemove?.(action, key);
    },
    [handleBindingRemove]
  );
  const reset = react.useCallback(() => {
    handleReset?.();
  }, [handleReset]);
  const pendingConflictInfo = react.useMemo(() => {
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
  react.useEffect(() => {
    setHasPendingConflictState(pendingConflictInfo.hasConflict);
  }, [pendingConflictInfo.hasConflict]);
  const renderEditableKbd = react.useCallback(
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
      return /* @__PURE__ */ jsxRuntime.jsx(
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
  const renderAddButton = react.useCallback(
    (actionId) => {
      const isAddingThis = addingAction === actionId;
      if (isAddingThis) {
        return /* @__PURE__ */ jsxRuntime.jsx(
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
      return /* @__PURE__ */ jsxRuntime.jsx(
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
  const renderCell = react.useCallback(
    (actionId, keys) => {
      const showAddButton = editable && (multipleBindings || keys.length === 0);
      return /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "kbd-action-bindings", children: [
        keys.map((key) => /* @__PURE__ */ jsxRuntime.jsx(react.Fragment, { children: renderEditableKbd(actionId, key, true) }, key)),
        showAddButton && renderAddButton(actionId)
      ] });
    },
    [renderEditableKbd, renderAddButton, editable, multipleBindings]
  );
  const groupRendererProps = react.useMemo(() => ({
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
  useHotkeys(
    { escape: "closeShortcuts" },
    { closeShortcuts: close },
    { enabled: isOpen }
  );
  react.useEffect(() => {
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
  react.useEffect(() => {
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
  const handleBackdropClick = react.useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );
  const handleModalClick = react.useCallback(
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
  const shortcutGroups = react.useMemo(
    () => organizeShortcuts(keymap, labels, descriptions, groupNames, groupOrder, ctx?.registry.actionRegistry, effectiveShowUnbound),
    [keymap, labels, descriptions, groupNames, groupOrder, ctx?.registry.actionRegistry, effectiveShowUnbound]
  );
  if (!isOpen) return null;
  if (children) {
    return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: children({
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
    return group.shortcuts.map(({ actionId, label, description, bindings }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-action", children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "kbd-action-label", title: description, children: label }),
      renderCell(actionId, bindings)
    ] }, actionId));
  };
  return /* @__PURE__ */ jsxRuntime.jsx(TooltipContext.Provider, { value: TooltipComponentProp, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: backdropClassName, onClick: handleBackdropClick, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: modalClassName, role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts", onClick: handleModalClick, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-modal-header", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "kbd-modal-title", children: title }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-modal-header-buttons", children: [
        editable && handleReset && /* @__PURE__ */ jsxRuntime.jsx("button", { className: "kbd-reset-btn", onClick: reset, children: "Reset" }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: "kbd-modal-close", onClick: close, "aria-label": "Close", children: "\xD7" })
      ] })
    ] }),
    hint && /* @__PURE__ */ jsxRuntime.jsx("p", { className: "kbd-hint", children: hint }),
    shortcutGroups.map((group) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-group", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "kbd-group-title", children: group.name }),
      renderGroup(group)
    ] }, group.name)),
    pendingConflict && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "kbd-conflict-warning", style: {
      padding: "12px",
      marginTop: "16px",
      backgroundColor: "var(--kbd-warning-bg)",
      borderRadius: "var(--kbd-radius-sm)",
      border: "1px solid var(--kbd-warning)"
    }, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("p", { style: { margin: "0 0 8px", color: "var(--kbd-warning)" }, children: [
        "This key is already bound to: ",
        pendingConflict.conflictsWith.join(", ")
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", gap: "8px" }, children: [
        /* @__PURE__ */ jsxRuntime.jsx(
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
        /* @__PURE__ */ jsxRuntime.jsx(
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
  ] }) }) });
}

exports.ACTION_LOOKUP = ACTION_LOOKUP;
exports.ACTION_MODAL = ACTION_MODAL;
exports.ACTION_OMNIBAR = ACTION_OMNIBAR;
exports.ActionsRegistryContext = ActionsRegistryContext;
exports.Alt = Alt;
exports.Backspace = Backspace;
exports.Command = Command;
exports.Ctrl = Ctrl;
exports.DEFAULT_SEQUENCE_TIMEOUT = DEFAULT_SEQUENCE_TIMEOUT;
exports.DIGITS_PLACEHOLDER = DIGITS_PLACEHOLDER;
exports.DIGIT_PLACEHOLDER = DIGIT_PLACEHOLDER;
exports.Down = Down;
exports.Enter = Enter;
exports.HotkeysProvider = HotkeysProvider;
exports.Kbd = Kbd;
exports.KbdLookup = KbdLookup;
exports.KbdModal = KbdModal;
exports.KbdOmnibar = KbdOmnibar;
exports.Kbds = Kbds;
exports.Key = Key;
exports.KeybindingEditor = KeybindingEditor;
exports.Left = Left;
exports.LookupModal = LookupModal;
exports.ModifierIcon = ModifierIcon;
exports.Omnibar = Omnibar;
exports.OmnibarEndpointsRegistryContext = OmnibarEndpointsRegistryContext;
exports.Option = Option;
exports.Right = Right;
exports.SequenceModal = SequenceModal;
exports.Shift = Shift;
exports.ShortcutsModal = ShortcutsModal;
exports.Up = Up;
exports.countPlaceholders = countPlaceholders;
exports.createTwoColumnRenderer = createTwoColumnRenderer;
exports.extractCaptures = extractCaptures;
exports.findConflicts = findConflicts;
exports.formatBinding = formatBinding;
exports.formatCombination = formatCombination;
exports.formatKeyForDisplay = formatKeyForDisplay;
exports.formatKeySeq = formatKeySeq;
exports.fuzzyMatch = fuzzyMatch;
exports.getActionBindings = getActionBindings;
exports.getConflictsArray = getConflictsArray;
exports.getKeyIcon = getKeyIcon;
exports.getModifierIcon = getModifierIcon;
exports.getSequenceCompletions = getSequenceCompletions;
exports.hasConflicts = hasConflicts;
exports.hasDigitPlaceholders = hasDigitPlaceholders;
exports.hotkeySequenceToKeySeq = hotkeySequenceToKeySeq;
exports.isDigitPlaceholder = isDigitPlaceholder;
exports.isMac = isMac;
exports.isModifierKey = isModifierKey;
exports.isPlaceholderSentinel = isPlaceholderSentinel;
exports.isSequence = isSequence;
exports.isShiftedSymbol = isShiftedSymbol;
exports.keySeqToHotkeySequence = keySeqToHotkeySequence;
exports.normalizeKey = normalizeKey;
exports.parseHotkeyString = parseHotkeyString;
exports.parseKeySeq = parseKeySeq;
exports.searchActions = searchActions;
exports.useAction = useAction;
exports.useActions = useActions;
exports.useActionsRegistry = useActionsRegistry;
exports.useEditableHotkeys = useEditableHotkeys;
exports.useHotkeys = useHotkeys;
exports.useHotkeysContext = useHotkeysContext;
exports.useMaybeHotkeysContext = useMaybeHotkeysContext;
exports.useOmnibar = useOmnibar;
exports.useOmnibarEndpoint = useOmnibarEndpoint;
exports.useOmnibarEndpointsRegistry = useOmnibarEndpointsRegistry;
exports.useRecordHotkey = useRecordHotkey;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map