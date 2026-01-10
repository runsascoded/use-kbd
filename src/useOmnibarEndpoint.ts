import { useContext, useEffect, useRef } from 'react'
import { OmnibarEndpointsRegistryContext } from './OmnibarEndpointsRegistry'
import type { EndpointPagination, OmnibarEndpointConfig } from './types'

/**
 * Register a remote omnibar endpoint.
 *
 * Endpoints are automatically unregistered when the component unmounts,
 * making this ideal for colocating search providers with their data context.
 *
 * @example
 * ```tsx
 * function UsersPage() {
 *   const navigate = useNavigate()
 *
 *   useOmnibarEndpoint('users', {
 *     fetch: async (query, signal, pagination) => {
 *       const res = await fetch(`/api/users?q=${query}&offset=${pagination.offset}&limit=${pagination.limit}`, { signal })
 *       const { users, total } = await res.json()
 *       return {
 *         entries: users.map(u => ({
 *           id: `user:${u.id}`,
 *           label: u.name,
 *           description: u.email,
 *           handler: () => navigate(`/users/${u.id}`),
 *         })),
 *         total,
 *         hasMore: pagination.offset + users.length < total,
 *       }
 *     },
 *     group: 'Users',
 *     priority: 10,
 *     pageSize: 10,
 *     pagination: 'scroll',
 *   })
 *
 *   return <UsersList />
 * }
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

  // Keep fetch in a ref so we don't re-register on every render
  const fetchRef = useRef(config.fetch)
  fetchRef.current = config.fetch

  // Keep enabled state in ref too
  const enabledRef = useRef(config.enabled ?? true)
  enabledRef.current = config.enabled ?? true

  useEffect(() => {
    registryRef.current.register(id, {
      ...config,
      fetch: async (query, signal, pagination) => {
        if (!enabledRef.current) return { entries: [] }
        return fetchRef.current(query, signal, pagination)
      },
    })

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
    // Note: we use refs for fetch and enabled, so they don't cause re-registration
  ])
}
