import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import { dbg } from './debug'
import type { ModeConfig, RegisteredMode } from './types'

export interface ModesRegistryValue {
  /** Register a mode. Called by useMode on mount. */
  register: (id: string, config: ModeConfig) => void
  /** Unregister a mode. Called by useMode on unmount. */
  unregister: (id: string) => void
  /** Currently registered modes */
  modes: Map<string, RegisteredMode>
  /** Currently active mode ID (null if none) */
  activeMode: string | null
  /** Activate a mode by ID */
  activateMode: (id: string) => void
  /** Deactivate the current mode */
  deactivateMode: () => void
  /** Toggle a mode: deactivate if active, activate otherwise */
  toggleMode: (id: string) => void
}

export const ModesRegistryContext = createContext<ModesRegistryValue | null>(null)

/**
 * Hook to create a modes registry.
 * Used internally by HotkeysProvider.
 */
export function useModesRegistry(): ModesRegistryValue {
  const modesRef = useRef<Map<string, RegisteredMode>>(new Map())
  const [modesVersion, setModesVersion] = useState(0)
  const [activeMode, setActiveMode] = useState<string | null>(null)

  // Keep a ref to activeMode for use in callbacks without stale closures
  const activeModeRef = useRef<string | null>(null)
  activeModeRef.current = activeMode

  const register = useCallback((id: string, config: ModeConfig) => {
    dbg.modes('register mode: %s (%s)', id, config.label)
    modesRef.current.set(id, {
      config,
      registeredAt: Date.now(),
    })
    setModesVersion(v => v + 1)
  }, [])

  const unregister = useCallback((id: string) => {
    dbg.modes('unregister mode: %s', id)
    modesRef.current.delete(id)
    // If the unregistered mode was active, deactivate it
    if (activeModeRef.current === id) {
      setActiveMode(null)
    }
    setModesVersion(v => v + 1)
  }, [])

  const activateMode = useCallback((id: string) => {
    const mode = modesRef.current.get(id)
    if (!mode) return
    dbg.modes('activate mode: %s', id)

    // Deactivate previous mode if different
    const prev = activeModeRef.current
    if (prev && prev !== id) {
      const prevMode = modesRef.current.get(prev)
      prevMode?.config.onDeactivate?.()
    }

    activeModeRef.current = id
    setActiveMode(id)
    mode.config.onActivate?.()
  }, [])

  const deactivateMode = useCallback(() => {
    const current = activeModeRef.current
    if (!current) return
    dbg.modes('deactivate mode: %s', current)

    const mode = modesRef.current.get(current)
    activeModeRef.current = null
    setActiveMode(null)
    mode?.config.onDeactivate?.()
  }, [])

  const toggleMode = useCallback((id: string) => {
    if (activeModeRef.current === id) {
      deactivateMode()
    } else {
      activateMode(id)
    }
  }, [activateMode, deactivateMode])

  const modes = useMemo(() => {
    return new Map(modesRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modesVersion])

  return useMemo(() => ({
    register,
    unregister,
    modes,
    activeMode,
    activateMode,
    deactivateMode,
    toggleMode,
  }), [
    register,
    unregister,
    modes,
    activeMode,
    activateMode,
    deactivateMode,
    toggleMode,
  ])
}
