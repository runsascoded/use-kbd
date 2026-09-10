import { useCallback, useEffect, useMemo } from 'react'
import { Command } from 'cmdk'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { useAction } from './useAction'
import { useOmnibar, type RemoteOmnibarResult } from './useOmnibar'
import { useParamEntry } from './useParamEntry'
import { ACTION_OMNIBAR, DEFAULT_BUILTIN_GROUP } from './constants'
import type { OmnibarEntry } from './types'

/**
 * SPIKE (cmdk-delegation branch): a command palette backed by `cmdk` primitives
 * instead of the hand-rolled input/list/keyboard-nav in `<Omnibar />`, while
 * keeping use-kbd's action-registry + endpoint bridge (`useOmnibar`).
 *
 * Wired: registry actions + async endpoints, ranked filtering (`shouldFilter`
 * off), recents (own group when the query is empty), ParamEntry (numeric arg
 * capture), and scroll-mode endpoint pagination (IntersectionObserver sentinels).
 * cmdk owns input, list, keyboard nav, and a11y. See specs/cmdk-delegation.md.
 */
export function OmnibarCmdk({ defaultBinding = 'meta+k' }: { defaultBinding?: string }) {
  const ctx = useMaybeHotkeysContext()
  const actions = ctx?.registry.actionRegistry ?? {}
  const keymap = ctx?.registry.keymap ?? {}

  useAction(ACTION_OMNIBAR, {
    label: 'Command palette',
    group: ctx?.builtinGroup ?? DEFAULT_BUILTIN_GROUP,
    sortOrder: 1,
    defaultBindings: defaultBinding ? [defaultBinding] : [],
    handler: useCallback(() => ctx?.toggleOmnibar(), [ctx]),
  })

  const handleExecuteRemote = useCallback((entry: OmnibarEntry) => {
    if ('href' in entry && entry.href) window.location.href = entry.href
  }, [])

  const {
    query,
    setQuery,
    results,
    remoteResults,
    execute,
    isLoadingRemote,
    endpointPagination,
    loadMore,
    pendingParamAction,
    submitParam,
    cancelParam,
  } = useOmnibar({
    actions,
    keymap,
    openKey: '', // trigger handled via useAction above
    enabled: false,
    onClose: () => ctx?.closeOmnibar(),
    onExecute: (id, captures) => ctx?.executeAction(id, captures),
    onExecuteRemote: handleExecuteRemote,
    endpointsRegistry: ctx?.endpointsRegistry,
    recentActionIds: ctx?.recentActionIds,
  })

  // Parameter entry (an action that needs a captured numeric arg).
  const paramEntry = useParamEntry({
    onSubmit: (_actionId, captures) => submitParam(captures[0]),
    onCancel: cancelParam,
  })
  useEffect(() => {
    if (pendingParamAction) {
      const label = results.find(r => r.id === pendingParamAction)?.action.label ?? pendingParamAction
      paramEntry.startParamEntry({ id: pendingParamAction, label })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingParamAction])

  const isOpen = ctx?.isOmnibarOpen ?? false

  // Recents (own group) vs the rest — only split them out when the query is empty.
  const recentIds = ctx?.recentActionIds
  const { recentResults, actionResults } = useMemo(() => {
    if (query !== '' || !recentIds?.length) return { recentResults: [], actionResults: results }
    const recentSet = new Set(recentIds)
    return {
      recentResults: results.filter(r => recentSet.has(r.id)),
      actionResults: results.filter(r => !recentSet.has(r.id)),
    }
  }, [query, results, recentIds])

  // Group remote (endpoint) results by their display group, tracking endpoint id.
  const remoteGroups = useMemo(() => {
    const byGroup = new Map<string, { endpointId: string; items: RemoteOmnibarResult[] }>()
    for (const r of remoteResults) {
      const g = r.entry.group ?? r.endpointId
      const bucket = byGroup.get(g) ?? { endpointId: r.endpointId, items: [] }
      bucket.items.push(r)
      byGroup.set(g, bucket)
    }
    return byGroup
  }, [remoteResults])

  // Scroll-mode pagination: when the list nears its bottom, load the next page
  // for every scroll-mode endpoint that has more. (Simpler and more robust than
  // per-endpoint IntersectionObserver sentinels against cmdk's re-renders.)
  const onListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 120) return
    for (const [id, info] of endpointPagination) {
      if (info.mode === 'scroll' && info.hasMore && !info.isLoading) loadMore(id)
    }
  }, [endpointPagination, loadMore])

  if (!isOpen) return null

  const inParamEntry = pendingParamAction != null

  return (
    <div className="kbd-omnibar-backdrop" onClick={() => ctx?.closeOmnibar()}>
      <div className="kbd-omnibar" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <Command
          shouldFilter={false}
          loop
          onKeyDown={e => { if (e.key === 'Escape' && !inParamEntry) { e.preventDefault(); ctx?.closeOmnibar() } }}
        >
          <div className="kbd-omnibar-header">
            {inParamEntry ? (
              <div className="kbd-omnibar-param-entry">
                <span className="kbd-omnibar-param-label">
                  {paramEntry.pendingAction?.label ?? pendingParamAction}
                </span>
                <input
                  ref={paramEntry.paramInputRef}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9.]*"
                  className="kbd-omnibar-param-input"
                  value={paramEntry.paramValue}
                  onChange={e => paramEntry.setParamValue(e.target.value)}
                  onKeyDown={paramEntry.handleParamKeyDown}
                  placeholder="Enter value…"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <span className="kbd-omnibar-param-hint">↵ to confirm · Esc to cancel</span>
              </div>
            ) : (
              <Command.Input
                autoFocus
                className="kbd-omnibar-input"
                placeholder="Type a command…"
                value={query}
                onValueChange={setQuery}
              />
            )}
          </div>

          <Command.List
            className="kbd-omnibar-list"
            hidden={inParamEntry}
            onScroll={onListScroll}
            // Bound the list so it scrolls (drives scroll-mode pagination).
            style={{ maxHeight: '55vh', overflowY: 'auto' }}
          >
            <Command.Empty className="kbd-omnibar-empty">
              {isLoadingRemote ? 'Searching…' : 'No results.'}
            </Command.Empty>

            {recentResults.length > 0 && (
              <Command.Group heading="Recent" className="kbd-omnibar-group">
                {recentResults.map(r => (
                  <Command.Item key={r.id} value={r.id} className="kbd-omnibar-result" onSelect={() => execute(r.id, r.captures)}>
                    <span className="kbd-omnibar-result-label">{r.action.label}</span>
                    {r.bindings[0] && <kbd className="kbd-omnibar-binding">{r.bindings[0]}</kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {actionResults.length > 0 && (
              <Command.Group heading="Actions" className="kbd-omnibar-group">
                {actionResults.map(r => (
                  <Command.Item key={r.id} value={r.id} className="kbd-omnibar-result" onSelect={() => execute(r.id, r.captures)}>
                    <span className="kbd-omnibar-result-label">{r.action.label}</span>
                    {r.bindings[0] && <kbd className="kbd-omnibar-binding">{r.bindings[0]}</kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {Array.from(remoteGroups.entries()).map(([group, { items }]) => (
              <Command.Group key={group} heading={group} className="kbd-omnibar-group">
                {items.map(r => (
                  <Command.Item key={r.id} value={r.id} className="kbd-omnibar-result" onSelect={() => execute(r.id)}>
                    <span className="kbd-omnibar-result-label">{r.entry.label}</span>
                    {r.entry.description && (
                      <span className="kbd-omnibar-result-description">{r.entry.description}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
            {isLoadingRemote && <div className="kbd-omnibar-loading" aria-hidden>Loading…</div>}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
