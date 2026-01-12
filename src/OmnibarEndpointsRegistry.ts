import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import type { EndpointPagination, OmnibarEndpointAsyncConfig, OmnibarEntry } from './types'

export interface RegisteredEndpoint {
  id: string
  /** Internal config is always async (useOmnibarEndpoint normalizes sync endpoints) */
  config: OmnibarEndpointAsyncConfig
  registeredAt: number
}

/**
 * Result from querying an endpoint
 */
export interface EndpointQueryResult {
  endpointId: string
  entries: OmnibarEntry[]
  /** Total count from endpoint (if provided) */
  total?: number
  /** Whether endpoint has more results (if provided) */
  hasMore?: boolean
  error?: Error
}

export interface OmnibarEndpointsRegistryValue {
  /** Register an endpoint. Called by useOmnibarEndpoint on mount. */
  register: (id: string, config: OmnibarEndpointAsyncConfig) => void
  /** Unregister an endpoint. Called by useOmnibarEndpoint on unmount. */
  unregister: (id: string) => void
  /** Currently registered endpoints */
  endpoints: Map<string, RegisteredEndpoint>
  /** Query all registered endpoints (initial page) */
  queryAll: (query: string, signal: AbortSignal) => Promise<EndpointQueryResult[]>
  /** Query a single endpoint with specific pagination (for load-more) */
  queryEndpoint: (endpointId: string, query: string, pagination: EndpointPagination, signal: AbortSignal) => Promise<EndpointQueryResult | null>
}

export const OmnibarEndpointsRegistryContext = createContext<OmnibarEndpointsRegistryValue | null>(null)

/**
 * Hook to create an omnibar endpoints registry.
 * Used internally by HotkeysProvider.
 */
export function useOmnibarEndpointsRegistry(): OmnibarEndpointsRegistryValue {
  // Registered endpoints (mutable for perf, state for re-renders)
  const endpointsRef = useRef<Map<string, RegisteredEndpoint>>(new Map())
  const [endpointsVersion, setEndpointsVersion] = useState(0)

  const register = useCallback((id: string, config: OmnibarEndpointAsyncConfig) => {
    endpointsRef.current.set(id, {
      id,
      config,
      registeredAt: Date.now(),
    })
    setEndpointsVersion(v => v + 1)
  }, [])

  const unregister = useCallback((id: string) => {
    endpointsRef.current.delete(id)
    setEndpointsVersion(v => v + 1)
  }, [])

  /** Query a single endpoint */
  const queryEndpoint = useCallback(async (
    endpointId: string,
    query: string,
    pagination: EndpointPagination,
    signal: AbortSignal,
  ): Promise<EndpointQueryResult | null> => {
    const ep = endpointsRef.current.get(endpointId)
    if (!ep) return null
    // Note: enabled check is handled by the wrapped fetch function in useOmnibarEndpoint
    if (query.length < (ep.config.minQueryLength ?? 2)) return null

    try {
      const response = await ep.config.fetch(query, signal, pagination)
      // Apply default group if entries don't have one
      const entriesWithGroup = response.entries.map(entry => ({
        ...entry,
        group: entry.group ?? ep.config.group,
      }))
      return {
        endpointId: ep.id,
        entries: entriesWithGroup,
        total: response.total,
        hasMore: response.hasMore,
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { endpointId: ep.id, entries: [] }
      }
      return {
        endpointId: ep.id,
        entries: [],
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }, [])

  /** Query all endpoints (initial page for each) */
  const queryAll = useCallback(async (
    query: string,
    signal: AbortSignal,
  ): Promise<EndpointQueryResult[]> => {
    const endpoints = Array.from(endpointsRef.current.values())

    // Filter by minQueryLength only (enabled is handled by the wrapped fetch function)
    const filteredByMinQuery = endpoints.filter(ep => {
      const minLen = ep.config.minQueryLength ?? 2
      return query.length >= minLen
    })

    const promises = filteredByMinQuery
      .map(async (ep): Promise<EndpointQueryResult> => {
        const pageSize = ep.config.pageSize ?? 10
        const result = await queryEndpoint(ep.id, query, { offset: 0, limit: pageSize }, signal)
        return result ?? { endpointId: ep.id, entries: [] }
      })

    return Promise.all(promises)
  }, [queryEndpoint])

  // Create a snapshot of the map for consumers
  const endpoints = useMemo(() => {
    return new Map(endpointsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointsVersion])

  return useMemo(() => ({
    register,
    unregister,
    endpoints,
    queryAll,
    queryEndpoint,
  }), [register, unregister, endpoints, queryAll, queryEndpoint])
}
