import { useContext, useEffect, useRef } from 'react'
import { OmnibarEndpointsRegistryContext } from './OmnibarEndpointsRegistry'
import type { EndpointPagination, EndpointResponse, OmnibarEndpointAsyncConfig, OmnibarEndpointConfig } from './types'

type FetchFn = (query: string, signal: AbortSignal, pagination: EndpointPagination) => Promise<EndpointResponse>
type FilterFn = (query: string, pagination: EndpointPagination) => EndpointResponse

/**
 * Register an omnibar endpoint for dynamic search results.
 *
 * Supports both async (remote API) and sync (in-memory) endpoints:
 * - Use `fetch` for async operations that need AbortSignal support
 * - Use `filter` for sync in-memory filtering (skips debouncing for instant results)
 *
 * Endpoints are automatically unregistered when the component unmounts,
 * making this ideal for colocating search providers with their data context.
 *
 * @example Async endpoint (remote API)
 * ```tsx
 * useOmnibarEndpoint('users', {
 *   fetch: async (query, signal, pagination) => {
 *     const res = await fetch(`/api/users?q=${query}`, { signal })
 *     const { users, total } = await res.json()
 *     return {
 *       entries: users.map(u => ({
 *         id: `user:${u.id}`,
 *         label: u.name,
 *         handler: () => navigate(`/users/${u.id}`),
 *       })),
 *       total,
 *       hasMore: pagination.offset + users.length < total,
 *     }
 *   },
 *   group: 'Users',
 * })
 * ```
 *
 * @example Sync endpoint (in-memory filtering)
 * ```tsx
 * useOmnibarEndpoint('stations', {
 *   filter: (query, pagination) => {
 *     const matches = stations.filter(s => s.name.includes(query))
 *     return {
 *       entries: matches.slice(pagination.offset, pagination.offset + pagination.limit)
 *         .map(s => ({ id: s.id, label: s.name, handler: () => select(s) })),
 *       total: matches.length,
 *       hasMore: pagination.offset + pagination.limit < matches.length,
 *     }
 *   },
 *   group: 'Stations',
 *   minQueryLength: 0,
 * })
 * ```
 */
export function useOmnibarEndpoint(id: string, config: OmnibarEndpointConfig): void {
  const registry = useContext(OmnibarEndpointsRegistryContext)
  if (!registry) {
    throw new Error('useOmnibarEndpoint must be used within a HotkeysProvider')
  }

  // Keep registry in a ref to avoid re-running effect when registry object changes
  const registryRef = useRef(registry)
  registryRef.current = registry

  // Determine if this is a sync or async endpoint
  const isSync = 'filter' in config && config.filter !== undefined
  const fetchFn = isSync ? undefined : (config as { fetch: FetchFn }).fetch
  const filterFn = isSync ? (config as { filter: FilterFn }).filter : undefined

  // Keep fetch/filter in refs so we don't re-register on every render
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn
  const filterRef = useRef(filterFn)
  filterRef.current = filterFn
  const isSyncRef = useRef(isSync)
  isSyncRef.current = isSync

  // Keep enabled state in ref too
  const enabledRef = useRef(config.enabled ?? true)
  enabledRef.current = config.enabled ?? true

  useEffect(() => {
    // Normalize to async config for registry (which always uses fetch internally)
    const asyncConfig: OmnibarEndpointAsyncConfig = {
      group: config.group,
      priority: config.priority,
      minQueryLength: config.minQueryLength,
      enabled: config.enabled,
      pageSize: config.pageSize,
      pagination: config.pagination,
      fetch: async (query, signal, pagination) => {
        if (!enabledRef.current) return { entries: [] }
        if (isSyncRef.current && filterRef.current) {
          // Sync: call filter directly (no await needed, but Promise.resolve for consistency)
          return filterRef.current(query, pagination)
        }
        // Async: call fetch
        return fetchRef.current!(query, signal, pagination)
      },
    }

    registryRef.current.register(id, asyncConfig)

    return () => {
      registryRef.current.unregister(id)
    }
  }, [
    id,
    config.group,
    config.priority,
    config.minQueryLength,
    config.pageSize,
    config.pagination,
    // Note: we use refs for fetch/filter and enabled, so they don't cause re-registration
  ])
}
