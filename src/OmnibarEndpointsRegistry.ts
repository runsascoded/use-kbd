import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import type { OmnibarEndpointConfig, OmnibarEntry } from './types'

export interface RegisteredEndpoint {
  id: string
  config: OmnibarEndpointConfig
  registeredAt: number
}

/**
 * Result from querying an endpoint
 */
export interface EndpointQueryResult {
  endpointId: string
  entries: OmnibarEntry[]
  error?: Error
}

export interface OmnibarEndpointsRegistryValue {
  /** Register an endpoint. Called by useOmnibarEndpoint on mount. */
  register: (id: string, config: OmnibarEndpointConfig) => void
  /** Unregister an endpoint. Called by useOmnibarEndpoint on unmount. */
  unregister: (id: string) => void
  /** Currently registered endpoints */
  endpoints: Map<string, RegisteredEndpoint>
  /** Query all registered endpoints and return aggregated results */
  queryAll: (query: string, signal: AbortSignal) => Promise<EndpointQueryResult[]>
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

  const register = useCallback((id: string, config: OmnibarEndpointConfig) => {
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

  const queryAll = useCallback(async (
    query: string,
    signal: AbortSignal,
  ): Promise<EndpointQueryResult[]> => {
    const endpoints = Array.from(endpointsRef.current.values())
    const results: EndpointQueryResult[] = []

    // Query all enabled endpoints in parallel
    const promises = endpoints
      .filter(ep => ep.config.enabled !== false)
      .filter(ep => query.length >= (ep.config.minQueryLength ?? 2))
      .map(async (ep): Promise<EndpointQueryResult> => {
        try {
          const entries = await ep.config.fetch(query, signal)
          // Apply default group if entries don't have one
          const entriesWithGroup = entries.map(entry => ({
            ...entry,
            group: entry.group ?? ep.config.group,
          }))
          return {
            endpointId: ep.id,
            entries: entriesWithGroup,
          }
        } catch (error) {
          // Don't throw on abort - just return empty
          if (error instanceof Error && error.name === 'AbortError') {
            return { endpointId: ep.id, entries: [] }
          }
          return {
            endpointId: ep.id,
            entries: [],
            error: error instanceof Error ? error : new Error(String(error)),
          }
        }
      })

    const settled = await Promise.all(promises)
    results.push(...settled)

    return results
  }, [])

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
  }), [register, unregister, endpoints, queryAll])
}
