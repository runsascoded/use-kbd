import { useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { ACTION_MODE_PREFIX } from './constants'
import { ModesRegistryContext } from './ModesRegistry'
import { useAction } from './useAction'
import type { ModeConfig, ModeState } from './types'

/**
 * Register a keyboard mode (sticky shortcut scope).
 *
 * Modes create a context where short single-key bindings become active.
 * Enter a mode via a sequence (e.g., `g n`), then use short keys (`o`, `p`)
 * that only exist while the mode is active. Escape exits the mode.
 *
 * @example
 * ```tsx
 * const navMode = useMode('nav:3d', {
 *   label: '3D Navigation',
 *   color: '#4fc3f7',
 *   defaultBindings: ['g n'],
 * })
 *
 * useAction('nav:orbit', {
 *   label: 'Orbit',
 *   mode: 'nav:3d',
 *   defaultBindings: ['o'],
 *   handler: () => setNavType('orbit'),
 * })
 * ```
 */
export function useMode(id: string, config: ModeConfig): ModeState {
  const registry = useContext(ModesRegistryContext)
  if (!registry) {
    throw new Error('useMode must be used within a HotkeysProvider')
  }

  const registryRef = useRef(registry)
  registryRef.current = registry

  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    registryRef.current.register(id, config)
    return () => {
      registryRef.current.unregister(id)
    }
  }, [
    id,
    config.label,
    config.color,
    JSON.stringify(config.defaultBindings),
    config.toggle,
    config.escapeExits,
    config.passthrough,
  ])

  // Register activation action
  const toggle = config.toggle !== false // default true
  const activationHandler = useCallback(() => {
    if (toggle) {
      registryRef.current.toggleMode(id)
    } else {
      registryRef.current.activateMode(id)
    }
  }, [id, toggle])

  useAction(`${ACTION_MODE_PREFIX}${id}`, {
    label: `${config.label} mode`,
    group: 'Modes',
    defaultBindings: config.defaultBindings ?? [],
    handler: activationHandler,
    hideFromModal: true,
  })

  const active = registry.activeMode === id

  const activate = useCallback(() => {
    registryRef.current.activateMode(id)
  }, [id])

  const deactivate = useCallback(() => {
    registryRef.current.deactivateMode()
  }, [])

  const toggleFn = useCallback(() => {
    registryRef.current.toggleMode(id)
  }, [id])

  return useMemo<ModeState>(() => ({
    id,
    active,
    label: config.label,
    color: config.color,
    activate,
    deactivate,
    toggle: toggleFn,
  }), [id, active, config.label, config.color, activate, deactivate, toggleFn])
}
