import { useMemo } from 'react'
import type { ActionConfig, ActionHandler } from './useAction'
import { useActions } from './useAction'

export interface ActionPairEntry {
  defaultBindings?: string[]
  handler: ActionHandler
  keywords?: string[]
  enabled?: boolean
}

export interface ActionPairConfig {
  label: string
  group?: string
  mode?: string
  description?: string
  actions: [ActionPairEntry, ActionPairEntry]
  enabled?: boolean
  keywords?: string[]
}

/**
 * Register two inverse actions as a pair, displayed as a single compact row
 * in ShortcutsModal.
 *
 * Creates actions `{id}-a` and `{id}-b`, each with their own bindings and
 * handler. The pair is collapsed into a single row with a `/` separator
 * between the two binding groups.
 *
 * @example
 * ```tsx
 * useActionPair('view:zoom', {
 *   label: 'Zoom in / out',
 *   group: '3D: View',
 *   actions: [
 *     { defaultBindings: ['='], handler: zoomIn },
 *     { defaultBindings: ['-'], handler: zoomOut },
 *   ],
 * })
 * ```
 */
export function useActionPair(id: string, config: ActionPairConfig): void {
  const {
    label,
    group,
    mode,
    description,
    actions: [actionA, actionB],
    enabled,
    keywords,
  } = config

  const actionConfigs = useMemo(() => {
    const result: Record<string, ActionConfig> = {}

    const makeConfig = (entry: ActionPairEntry, index: 0 | 1): ActionConfig => ({
      label: `${label} ${index === 0 ? 'a' : 'b'}`,
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
      actionPair: { pairId: id, index },
    })

    result[`${id}-a`] = makeConfig(actionA, 0)
    result[`${id}-b`] = makeConfig(actionB, 1)

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
    enabled,
    // handlers excluded — refs handle staleness in useActions
  ])

  useActions(actionConfigs)
}
