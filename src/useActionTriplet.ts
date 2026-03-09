import { useMemo } from 'react'
import type { ActionConfig, ActionHandler } from './useAction'
import { useActions } from './useAction'

export interface ActionTripletEntry {
  defaultBindings?: string[]
  handler: ActionHandler
  keywords?: string[]
  enabled?: boolean
}

export interface ActionTripletConfig {
  label: string
  group?: string
  mode?: string
  description?: string
  actions: [ActionTripletEntry, ActionTripletEntry, ActionTripletEntry]
  enabled?: boolean
  keywords?: string[]
}

const SUFFIXES = ['a', 'b', 'c'] as const

/**
 * Register three related actions as a triplet, displayed as a single compact
 * row in ShortcutsModal.
 *
 * Creates actions `{id}-a`, `{id}-b`, and `{id}-c`, each with their own
 * bindings and handler. The triplet is collapsed into a single row with `/`
 * separators between the three binding groups.
 *
 * @example
 * ```tsx
 * useActionTriplet('slice', {
 *   label: 'Slice along X / Y / Z',
 *   group: '3D: Edit',
 *   actions: [
 *     { defaultBindings: ['x'], handler: sliceX },
 *     { defaultBindings: ['y'], handler: sliceY },
 *     { defaultBindings: ['z'], handler: sliceZ },
 *   ],
 * })
 * ```
 */
export function useActionTriplet(id: string, config: ActionTripletConfig): void {
  const {
    label,
    group,
    mode,
    description,
    actions: [actionA, actionB, actionC],
    enabled,
    keywords,
  } = config

  const actionConfigs = useMemo(() => {
    const result: Record<string, ActionConfig> = {}

    const makeConfig = (entry: ActionTripletEntry, index: 0 | 1 | 2): ActionConfig => ({
      label: `${label} ${SUFFIXES[index]}`,
      group,
      mode,
      description,
      defaultBindings: entry.defaultBindings,
      keywords: [
        ...(keywords ?? []),
        ...(entry.keywords ?? []),
      ],
      handler: entry.handler,
      enabled: entry.enabled ?? enabled,
      actionTriplet: { tripletId: id, index },
    })

    result[`${id}-a`] = makeConfig(actionA, 0)
    result[`${id}-b`] = makeConfig(actionB, 1)
    result[`${id}-c`] = makeConfig(actionC, 2)

    return result
  }, [
    id,
    label,
    group,
    mode,
    description,
    JSON.stringify(keywords),
    JSON.stringify(actionA.defaultBindings),
    JSON.stringify(actionA.keywords),
    actionA.enabled,
    JSON.stringify(actionB.defaultBindings),
    JSON.stringify(actionB.keywords),
    actionB.enabled,
    JSON.stringify(actionC.defaultBindings),
    JSON.stringify(actionC.keywords),
    actionC.enabled,
    enabled,
    // handlers and enabled excluded — patched below to avoid stale closures
  ])

  actionConfigs[`${id}-a`].handler = actionA.handler
  actionConfigs[`${id}-b`].handler = actionB.handler
  actionConfigs[`${id}-c`].handler = actionC.handler
  actionConfigs[`${id}-a`].enabled = actionA.enabled ?? enabled
  actionConfigs[`${id}-b`].enabled = actionB.enabled ?? enabled
  actionConfigs[`${id}-c`].enabled = actionC.enabled ?? enabled

  useActions(actionConfigs)
}
