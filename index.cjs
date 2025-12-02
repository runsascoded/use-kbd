'use strict';

var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

// src/useHotkeys.ts

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
function formatCombination(combo) {
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
function parseCombinationId(id) {
  const parts = id.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  return {
    key,
    modifiers: {
      ctrl: parts.includes("ctrl"),
      alt: parts.includes("alt"),
      shift: parts.includes("shift"),
      meta: parts.includes("meta")
    }
  };
}

// src/useHotkeys.ts
function parseHotkey(hotkey) {
  const parts = hotkey.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  return {
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    alt: parts.includes("alt") || parts.includes("option"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("command"),
    key
  };
}
function matchesHotkey(e, hotkey) {
  const eventKey = normalizeKey(e.key);
  const shiftMatches = isShiftedChar(e.key) ? hotkey.shift ? e.shiftKey : true : e.shiftKey === hotkey.shift;
  return e.ctrlKey === hotkey.ctrl && e.altKey === hotkey.alt && shiftMatches && e.metaKey === hotkey.meta && eventKey === hotkey.key;
}
function useHotkeys(keymap, handlers, options = {}) {
  const {
    enabled = true,
    target,
    preventDefault = true,
    stopPropagation = true,
    enableOnFormTags = false
  } = options;
  const handlersRef = react.useRef(handlers);
  handlersRef.current = handlers;
  const keymapRef = react.useRef(keymap);
  keymapRef.current = keymap;
  react.useEffect(() => {
    if (!enabled) return;
    const targetElement = target ?? window;
    const handleKeyDown = (e) => {
      if (!enableOnFormTags) {
        const target2 = e.target;
        if (target2 instanceof HTMLInputElement || target2 instanceof HTMLTextAreaElement || target2 instanceof HTMLSelectElement || target2.isContentEditable) {
          return;
        }
      }
      if (isModifierKey(e.key)) {
        return;
      }
      for (const [hotkeyStr, actionName] of Object.entries(keymapRef.current)) {
        const hotkey = parseHotkey(hotkeyStr);
        if (matchesHotkey(e, hotkey)) {
          const actions = Array.isArray(actionName) ? actionName : [actionName];
          for (const action of actions) {
            const handler = handlersRef.current[action];
            if (handler) {
              if (preventDefault) {
                e.preventDefault();
              }
              if (stopPropagation) {
                e.stopPropagation();
              }
              handler(e);
              return;
            }
          }
        }
      }
    };
    targetElement.addEventListener("keydown", handleKeyDown);
    return () => {
      targetElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, target, preventDefault, stopPropagation, enableOnFormTags]);
}
function useEventCallback(fn) {
  const ref = react.useRef(fn);
  ref.current = fn;
  return react.useCallback(((...args) => ref.current?.(...args)), []);
}
function useRecordHotkey(options = {}) {
  const { onCapture: onCaptureProp, onCancel: onCancelProp, preventDefault = true } = options;
  const onCapture = useEventCallback(onCaptureProp);
  const onCancel = useEventCallback(onCancelProp);
  const [isRecording, setIsRecording] = react.useState(false);
  const [combination, setCombination] = react.useState(null);
  const [activeKeys, setActiveKeys] = react.useState(null);
  const pressedKeysRef = react.useRef(/* @__PURE__ */ new Set());
  const hasNonModifierRef = react.useRef(false);
  const currentComboRef = react.useRef(null);
  const cancel = react.useCallback(() => {
    setIsRecording(false);
    setActiveKeys(null);
    pressedKeysRef.current.clear();
    hasNonModifierRef.current = false;
    currentComboRef.current = null;
    onCancel?.();
  }, [onCancel]);
  const startRecording = react.useCallback(() => {
    setIsRecording(true);
    setCombination(null);
    setActiveKeys(null);
    pressedKeysRef.current.clear();
    hasNonModifierRef.current = false;
    currentComboRef.current = null;
    return cancel;
  }, [cancel]);
  react.useEffect(() => {
    if (!isRecording) return;
    const handleKeyDown = (e) => {
      if (preventDefault) {
        e.preventDefault();
        e.stopPropagation();
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
        const display2 = formatCombination(combo);
        pressedKeysRef.current.clear();
        hasNonModifierRef.current = false;
        currentComboRef.current = null;
        setCombination(combo);
        setIsRecording(false);
        setActiveKeys(null);
        onCapture?.(combo, display2);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [isRecording, preventDefault]);
  const display = combination ? formatCombination(combination) : null;
  return {
    isRecording,
    startRecording,
    cancel,
    combination,
    display,
    activeKeys
  };
}
function useEditableHotkeys(defaults, handlers, options = {}) {
  const { storageKey, ...hotkeyOptions } = options;
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
  useHotkeys(keymap, handlers, hotkeyOptions);
  const setBinding = react.useCallback((action, key) => {
    setOverrides((prev) => ({ ...prev, [key]: action }));
  }, []);
  const setKeymap = react.useCallback((newOverrides) => {
    setOverrides((prev) => ({ ...prev, ...newOverrides }));
  }, []);
  const reset = react.useCallback(() => {
    setOverrides({});
  }, []);
  return { keymap, setBinding, setKeymap, reset, overrides };
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
function findConflicts(keymap) {
  const keyToActions = /* @__PURE__ */ new Map();
  for (const [key, actionOrActions] of Object.entries(keymap)) {
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
    const existing = keyToActions.get(key) ?? [];
    keyToActions.set(key, [...existing, ...actions]);
  }
  const conflicts = /* @__PURE__ */ new Map();
  for (const [key, actions] of keyToActions) {
    if (actions.length > 1) {
      conflicts.set(key, actions);
    }
  }
  return conflicts;
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
  const { isRecording, startRecording, cancel, activeKeys } = useRecordHotkey({
    onCapture: react.useCallback(
      (_combo, display) => {
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
                children: activeKeys ? formatCombination(activeKeys).display : "Press keys..."
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
  const [internalIsOpen, setInternalIsOpen] = react.useState(false);
  const isOpen = controlledIsOpen ?? internalIsOpen;
  const close = react.useCallback(() => {
    setInternalIsOpen(false);
    onClose?.();
  }, [onClose]);
  const open = react.useCallback(() => {
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
  const handleBackdropClick = react.useCallback(
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
    return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: children({ groups: shortcutGroups, close }) });
  }
  return /* @__PURE__ */ jsxRuntime.jsx(
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
      children: /* @__PURE__ */ jsxRuntime.jsxs(
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
            /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }, children: [
              /* @__PURE__ */ jsxRuntime.jsx("h2", { style: { margin: 0, fontSize: "1.25rem", fontWeight: 600 }, children: "Keyboard Shortcuts" }),
              /* @__PURE__ */ jsxRuntime.jsx(
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
            shortcutGroups.map((group) => /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { marginBottom: "16px" }, children: [
              /* @__PURE__ */ jsxRuntime.jsx("h3", { style: { margin: "0 0 8px", fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: "#666" }, children: group.name }),
              /* @__PURE__ */ jsxRuntime.jsx("dl", { style: { margin: 0 }, children: group.shortcuts.map(({ key, action, description }) => {
                const combo = parseCombinationId(key);
                const display = formatCombination(combo);
                return /* @__PURE__ */ jsxRuntime.jsxs(
                  "div",
                  {
                    style: { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #eee" },
                    children: [
                      /* @__PURE__ */ jsxRuntime.jsx("dt", { style: { color: "#333" }, children: description }),
                      /* @__PURE__ */ jsxRuntime.jsx("dd", { style: { margin: 0, fontFamily: "monospace", color: "#666" }, children: /* @__PURE__ */ jsxRuntime.jsx("kbd", { style: { backgroundColor: "#f5f5f5", padding: "2px 6px", borderRadius: "4px", border: "1px solid #ddd" }, children: display.display }) })
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

exports.KeybindingEditor = KeybindingEditor;
exports.ShortcutsModal = ShortcutsModal;
exports.formatCombination = formatCombination;
exports.formatKeyForDisplay = formatKeyForDisplay;
exports.isMac = isMac;
exports.isModifierKey = isModifierKey;
exports.normalizeKey = normalizeKey;
exports.parseCombinationId = parseCombinationId;
exports.useEditableHotkeys = useEditableHotkeys;
exports.useHotkeys = useHotkeys;
exports.useRecordHotkey = useRecordHotkey;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map