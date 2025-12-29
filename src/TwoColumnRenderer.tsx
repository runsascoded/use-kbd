import type { ReactNode } from 'react'
import type { GroupRendererProps, ShortcutGroup } from './ShortcutsModal'

/**
 * Configuration for a row in a two-column table
 */
export interface TwoColumnRow {
  /** Label for the row (first column) */
  label: ReactNode
  /** Action ID for the left/first column */
  leftAction: string
  /** Action ID for the right/second column */
  rightAction: string
}

/**
 * Configuration for creating a two-column group renderer
 */
export interface TwoColumnConfig {
  /** Column headers: [label, left, right] */
  headers: [string, string, string]
  /**
   * Extract rows from the group's shortcuts.
   * Return array of { label, leftAction, rightAction }.
   */
  getRows: (group: ShortcutGroup) => TwoColumnRow[]
}

/**
 * Create a GroupRenderer that displays shortcuts in a two-column table.
 *
 * @example
 * ```tsx
 * // Pair actions by suffix (left:temp/right:temp)
 * const YAxisRenderer = createTwoColumnRenderer({
 *   headers: ['Metric', 'Left', 'Right'],
 *   getRows: (group) => {
 *     const metrics = ['temp', 'co2', 'humid']
 *     return metrics.map(m => ({
 *       label: m,
 *       leftAction: `left:${m}`,
 *       rightAction: `right:${m}`,
 *     }))
 *   },
 * })
 *
 * // Explicit pairs
 * const NavRenderer = createTwoColumnRenderer({
 *   headers: ['Navigation', 'Back', 'Forward'],
 *   getRows: () => [
 *     { label: 'Page', leftAction: 'nav:prev', rightAction: 'nav:next' },
 *   ],
 * })
 * ```
 */
export function createTwoColumnRenderer(config: TwoColumnConfig) {
  const { headers, getRows } = config
  const [labelHeader, leftHeader, rightHeader] = headers

  return function TwoColumnRenderer({ group, renderCell }: GroupRendererProps): ReactNode {
    // Build a map of actionId -> bindings for quick lookup
    const bindingsMap = new Map(
      group.shortcuts.map(s => [s.actionId, s.bindings])
    )

    const rows = getRows(group)

    return (
      <table className="kbd-table">
        <thead>
          <tr>
            <th>{labelHeader}</th>
            <th>{leftHeader}</th>
            <th>{rightHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, leftAction, rightAction }, i) => {
            const leftBindings = bindingsMap.get(leftAction) ?? []
            const rightBindings = bindingsMap.get(rightAction) ?? []
            // Skip row if neither action has bindings (action doesn't exist)
            if (leftBindings.length === 0 && rightBindings.length === 0) return null
            return (
              <tr key={i}>
                <td>{label}</td>
                <td>{leftAction ? renderCell(leftAction, leftBindings) : '-'}</td>
                <td>{rightAction ? renderCell(rightAction, rightBindings) : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }
}
