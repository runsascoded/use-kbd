import { useMemo } from 'react'
import type { Direction, ModifierName } from './types'
import type { ActionConfig, ActionHandler } from './useAction'
import { useActions } from './useAction'

const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down']

const ARROW_KEYS: Record<Direction, string> = {
  left: 'arrowleft',
  right: 'arrowright',
  up: 'arrowup',
  down: 'arrowdown',
}

export interface ArrowGroupConfig {
  label: string
  group?: string
  mode?: string
  description?: string
  defaultModifiers: ModifierName[]
  handlers: Record<Direction, ActionHandler>
  enabled?: boolean
  keywords?: string[]
  /** Additional per-direction bindings (e.g., { left: ['h'], right: ['l'] }) */
  extraBindings?: Partial<Record<Direction, string[]>>
}

/**
 * Register four directional arrow-key actions as a group.
 *
 * Creates actions `{id}-left`, `{id}-right`, `{id}-up`, `{id}-down`,
 * each bound to `{modifiers}+arrow{dir}`. The group is displayed as a
 * single compact row in ShortcutsModal.
 *
 * @example
 * ```tsx
 * useArrowGroup('nav:pan', {
 *   label: 'Pan',
 *   group: 'Camera',
 *   defaultModifiers: ['shift'],
 *   handlers: {
 *     left:  () => pan(-1, 0),
 *     right: () => pan(1, 0),
 *     up:    () => pan(0, -1),
 *     down:  () => pan(0, 1),
 *   },
 * })
 * ```
 */
export function useArrowGroup(id: string, config: ArrowGroupConfig): void {
  const {
    label,
    group,
    mode,
    description,
    defaultModifiers,
    handlers,
    enabled,
    keywords,
    extraBindings,
  } = config

  const actions = useMemo(() => {
    const modPrefix = defaultModifiers.length > 0
      ? defaultModifiers.join('+') + '+'
      : ''

    const result: Record<string, ActionConfig> = {}
    for (const dir of DIRECTIONS) {
      const arrowBinding = `${modPrefix}${ARROW_KEYS[dir]}`
      const extra = extraBindings?.[dir] ?? []
      const allBindings = [arrowBinding, ...extra]

      result[`${id}-${dir}`] = {
        label: `${label} ${dir}`,
        group,
        mode,
        description,
        defaultBindings: allBindings,
        keywords: keywords ? [...keywords, dir] : [dir],
        handler: handlers[dir],
        enabled,
        arrowGroup: { groupId: id, direction: dir },
      }
    }
    return result
  }, [
    id,
    label,
    group,
    mode,
    description,
    JSON.stringify(defaultModifiers),
    JSON.stringify(extraBindings),
    JSON.stringify(keywords),
    enabled,
    // handlers excluded — refs handle staleness in useActions
  ])

  useActions(actions)
}
