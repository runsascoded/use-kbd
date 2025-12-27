import type { ActionDefinition } from './types'

/**
 * Route matcher for scoping actions to specific routes.
 * - `undefined`: available on all routes
 * - `string`: exact match (e.g., '/editor')
 * - `RegExp`: pattern match (e.g., /^\/editor/)
 * - `(route: string) => boolean`: custom predicate
 */
export type RouteMatcher = string | RegExp | ((route: string) => boolean)

/**
 * Action metadata - static definition without runtime handler.
 * Used for defining actions that will have handlers bound later.
 */
export interface ActionMetadata extends ActionDefinition {
  /** Default key sequence(s) for this action */
  defaultBindings?: string[]
  /** Display group for shortcuts modal (e.g., "Time Range", "Navigation") */
  group?: string
  /** Route scope - when set, action only available on matching routes */
  route?: RouteMatcher
  /** Whether action is currently active (for visual feedback) */
  isActive?: () => boolean
}

/**
 * Full action definition with optional handler.
 * Handler can be provided inline or bound later via provider.
 */
export interface Action extends ActionMetadata {
  /** Callback to invoke when action is triggered (optional - can be bound via provider) */
  handler?: () => void
}

/**
 * Registry of action metadata keyed by action ID.
 */
export type ActionMetadataRegistry = Record<string, ActionMetadata>

/**
 * Registry of actions keyed by action ID.
 */
export type Actions = Record<string, Action>

/**
 * Actions organized by route.
 * '*' matches all routes (global actions).
 */
export type ActionsByRoute = Record<string, Record<string, Omit<Action, 'route'>>>

/**
 * Check if a route matches a RouteMatcher.
 */
export function matchesRoute(route: string, matcher: RouteMatcher | undefined): boolean {
  if (matcher === undefined) return true
  if (typeof matcher === 'string') return route === matcher
  if (matcher instanceof RegExp) return matcher.test(route)
  return matcher(route)
}

/**
 * Define actions with type safety.
 * Handlers are optional - they can be provided inline or bound later via HotkeysProvider.
 *
 * @example
 * ```tsx
 * // Without handlers (handlers bound via HotkeysProvider)
 * const ACTIONS = defineActions({
 *   'nav:home': {
 *     label: 'Go Home',
 *     defaultBindings: ['g h'],
 *     group: 'Navigation',
 *   },
 *   'edit:save': {
 *     label: 'Save',
 *     defaultBindings: ['meta+s'],
 *     group: 'Edit',
 *     route: '/editor',  // Only available on /editor
 *   },
 * })
 *
 * // With handlers inline
 * const actions = defineActions({
 *   'nav:home': {
 *     label: 'Go Home',
 *     handler: () => navigate('/'),
 *     defaultBindings: ['g h'],
 *     group: 'Navigation',
 *   },
 * })
 * ```
 */
export function defineActions<T extends Actions>(actions: T): T {
  return actions
}

/**
 * Define actions organized by route, then flatten to a single registry.
 * Convenient when thinking in terms of "what actions does each page have".
 *
 * @example
 * ```tsx
 * const actions = defineActionsByRoute({
 *   '*': {
 *     'nav:home': { label: 'Go Home', handler: () => navigate('/'), ... },
 *   },
 *   '/editor': {
 *     'edit:save': { label: 'Save', handler: () => save(), ... },
 *     'edit:undo': { label: 'Undo', handler: () => undo(), ... },
 *   },
 *   '/settings': {
 *     'settings:reset': { label: 'Reset', handler: () => reset(), ... },
 *   },
 * })
 * ```
 */
export function defineActionsByRoute(actionsByRoute: ActionsByRoute): Actions {
  const result: Actions = {}

  for (const [routePattern, routeActions] of Object.entries(actionsByRoute)) {
    for (const [actionId, action] of Object.entries(routeActions)) {
      // Convert route pattern to RouteMatcher
      let route: RouteMatcher | undefined
      if (routePattern === '*') {
        route = undefined // Available on all routes
      } else if (routePattern.includes('*') || routePattern.startsWith('^')) {
        // Looks like a regex pattern
        route = new RegExp(routePattern)
      } else {
        // Exact string match
        route = routePattern
      }

      result[actionId] = { ...action, route }
    }
  }

  return result
}

/**
 * Filter actions to only those available on a given route.
 */
export function filterActionsByRoute(actions: Actions, route: string): Actions {
  const result: Actions = {}
  for (const [id, action] of Object.entries(actions)) {
    if (matchesRoute(route, action.route)) {
      result[id] = action
    }
  }
  return result
}

/**
 * Extract default keymap from actions.
 * Returns a map of key -> action(s) from all actions' defaultBindings.
 */
export function getDefaultKeymap(actions: Actions): Record<string, string | string[]> {
  const keymap: Record<string, string[]> = {}

  for (const [actionId, action] of Object.entries(actions)) {
    if (action.defaultBindings) {
      for (const binding of action.defaultBindings) {
        if (!keymap[binding]) {
          keymap[binding] = []
        }
        keymap[binding].push(actionId)
      }
    }
  }

  // Simplify single-action bindings to strings
  const result: Record<string, string | string[]> = {}
  for (const [key, actionIds] of Object.entries(keymap)) {
    result[key] = actionIds.length === 1 ? actionIds[0] : actionIds
  }

  return result
}

/**
 * Extract handlers from actions.
 * Returns a map of actionId -> handler function.
 * Only includes actions that have handlers defined.
 */
export function getHandlers(actions: Actions): Record<string, () => void> {
  const handlers: Record<string, () => void> = {}
  for (const [actionId, action] of Object.entries(actions)) {
    if (action.handler) {
      handlers[actionId] = action.handler
    }
  }
  return handlers
}

/**
 * Extract ActionRegistry (for search/display) from Actions.
 * Strips runtime-only fields like handler.
 */
export function getActionRegistry(actions: Actions): Record<string, ActionDefinition> {
  const registry: Record<string, ActionDefinition> = {}
  for (const [actionId, action] of Object.entries(actions)) {
    registry[actionId] = {
      label: action.label,
      description: action.description,
      category: action.group, // Map group -> category for ActionDefinition
      keywords: action.keywords,
      icon: action.icon,
      enabled: action.enabled,
    }
  }
  return registry
}

/**
 * Get unique groups from actions, in order of first appearance.
 */
export function getGroups(actions: Actions): string[] {
  const seen = new Set<string>()
  const groups: string[] = []

  for (const action of Object.values(actions)) {
    if (action.group && !seen.has(action.group)) {
      seen.add(action.group)
      groups.push(action.group)
    }
  }

  return groups
}

/**
 * Group actions by their group field.
 */
export function groupActions(actions: Actions): Map<string | undefined, Actions> {
  const grouped = new Map<string | undefined, Actions>()

  for (const [actionId, action] of Object.entries(actions)) {
    const group = action.group
    if (!grouped.has(group)) {
      grouped.set(group, {})
    }
    grouped.get(group)![actionId] = action
  }

  return grouped
}
