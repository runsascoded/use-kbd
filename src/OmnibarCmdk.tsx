import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Command } from 'cmdk'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { useAction } from './useAction'
import { useOmnibar, type RemoteOmnibarResult } from './useOmnibar'
import { useParamEntry } from './useParamEntry'
import { ACTION_OMNIBAR, DEFAULT_BUILTIN_GROUP } from './constants'
import type { ActionSearchResult, OmnibarEntry } from './types'
import type { OmnibarResultRenderState } from './Omnibar'
import { ResultMain } from './OmnibarResultContent'
import { OmnibarNewTabHint, OmnibarResultRow } from './OmnibarResultRow'

/**
 * Registers the "Command palette" toggle action (⌘K). Split into its own
 * component so it mounts only for the modal palette — an inline palette is
 * always visible and needs no toggle, and mounting it would double-register
 * ACTION_OMNIBAR (the registry is last-write-wins, not ref-counted).
 */
function OmnibarToggleAction({ defaultBinding }: { defaultBinding: string }) {
  const ctx = useMaybeHotkeysContext()
  useAction(ACTION_OMNIBAR, {
    label: 'Command palette',
    group: ctx?.builtinGroup ?? DEFAULT_BUILTIN_GROUP,
    sortOrder: 1,
    defaultBindings: defaultBinding ? [defaultBinding] : [],
    handler: useCallback(() => ctx?.toggleOmnibar(), [ctx]),
  })
  return null
}

/**
 * Opt-in (shipped side-by-side with `<Omnibar />`, which stays the default): a
 * command palette backed by `cmdk` primitives instead of the hand-rolled
 * input/list/keyboard-nav in `<Omnibar />`, while keeping use-kbd's
 * action-registry + endpoint bridge (`useOmnibar`). Requires the optional peer
 * dep `cmdk`. Intended eventual end-state is to back `<Omnibar />` with this,
 * gated on a consumer dogfood — see specs/cmdk-delegation.md.
 *
 * Wired: registry actions + async endpoints, ranked filtering (`shouldFilter`
 * off), recents (own group when the query is empty), ParamEntry (numeric arg
 * capture), and scroll-mode endpoint pagination (near-bottom `onScroll` check).
 * cmdk owns input, list, keyboard nav, and a11y. See specs/cmdk-delegation.md.
 *
 * `inline` renders the palette as an always-visible, non-modal search box
 * (no backdrop / dialog / open-close gating) — the stationary form factor that
 * cmdk makes cheap and the hand-rolled modal `<Omnibar />` does not. Otherwise
 * it's a modal palette toggled by `defaultBinding` (⌘K).
 */
export function OmnibarCmdk({
  defaultBinding = 'meta+k',
  inline = false,
  placeholder = 'Type a command…',
  renderResult,
  renderRemoteResult,
}: {
  defaultBinding?: string
  inline?: boolean
  placeholder?: string
  /** Replace a local action result's row content; see `OmnibarProps.renderResult` */
  renderResult?: (result: ActionSearchResult, state: OmnibarResultRenderState) => ReactNode
  /** Replace an endpoint result's row content; see `OmnibarProps.renderRemoteResult` */
  renderRemoteResult?: (result: RemoteOmnibarResult, state: OmnibarResultRenderState) => ReactNode
}) {
  const ctx = useMaybeHotkeysContext()
  const actions = ctx?.registry.actionRegistry ?? {}
  const keymap = ctx?.registry.keymap ?? {}
  const [selectedId, setSelectedId] = useState('')

  const handleExecuteRemote = useCallback((entry: OmnibarEntry) => {
    if ('href' in entry && entry.href) window.location.href = entry.href
  }, [])

  const {
    query,
    setQuery,
    results,
    remoteResults,
    execute,
    close,
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
    onExecute: (id, captures, event) => ctx?.executeAction(id, captures, event),
    onExecuteRemote: handleExecuteRemote,
    endpointsRegistry: ctx?.endpointsRegistry,
    recentActionIds: ctx?.recentActionIds,
    isEnabled: ctx?.registry.isActionEnabled,
    // Re-read live `enabled` state each time the modal opens
    refreshKey: ctx?.isOmnibarOpen,
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

  const inParamEntry = pendingParamAction != null
  const selectedResult = results.find(r => r.id === selectedId)
  const selectedRemoteResult = remoteResults.find(r => r.id === selectedId)
  const selectedHref = selectedResult?.action.href ?? selectedRemoteResult?.entry.href

  const body = (
    <Command
      shouldFilter={false}
      loop
      value={selectedId}
      onValueChange={setSelectedId}
      onKeyDown={e => {
        if (inParamEntry) return
        if (e.key === 'Escape' && !inline) {
          e.preventDefault()
          ctx?.closeOmnibar()
        } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          // cmdk's onSelect only carries the value; retain the native event.
          e.preventDefault()
          if (selectedResult || selectedRemoteResult) execute(selectedId, undefined, e.nativeEvent)
        }
      }}
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
            autoFocus={!inline}
            className="kbd-omnibar-input"
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
        )}
      </div>

      <Command.List
        className="kbd-omnibar-list"
        hidden={inParamEntry}
        onScroll={onListScroll}
      >
        <Command.Empty className="kbd-omnibar-empty">
          {isLoadingRemote ? 'Searching…' : 'No results.'}
        </Command.Empty>

        {recentResults.length > 0 && (
          <Command.Group heading="Recent" className="kbd-omnibar-group">
            {recentResults.map(r => (
              <Command.Item key={r.id} value={r.id} asChild>
                <OmnibarResultRow href={r.action.href} className="kbd-omnibar-result" onNavigate={close} onExecute={event => execute(r.id, r.captures, event)}>
                  {renderResult ? renderResult(r, { selected: r.id === selectedId, query }) : <>
                    <ResultMain label={r.action.label} labelMatches={r.labelMatches} matches={r.matches} />
                    {r.bindings[0] && <kbd className="kbd-omnibar-binding">{r.bindings[0]}</kbd>}
                  </>}
                </OmnibarResultRow>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {actionResults.length > 0 && (
          <Command.Group heading="Actions" className="kbd-omnibar-group">
            {actionResults.map(r => (
              <Command.Item key={r.id} value={r.id} asChild>
                <OmnibarResultRow href={r.action.href} className="kbd-omnibar-result" onNavigate={close} onExecute={event => execute(r.id, r.captures, event)}>
                  {renderResult ? renderResult(r, { selected: r.id === selectedId, query }) : <>
                    <ResultMain label={r.action.label} labelMatches={r.labelMatches} matches={r.matches} />
                    {r.bindings[0] && <kbd className="kbd-omnibar-binding">{r.bindings[0]}</kbd>}
                  </>}
                </OmnibarResultRow>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {Array.from(remoteGroups.entries()).map(([group, { items }]) => (
          <Command.Group key={group} heading={group} className="kbd-omnibar-group">
            {items.map(r => (
              <Command.Item key={r.id} value={r.id} asChild>
                <OmnibarResultRow href={r.entry.href} className="kbd-omnibar-result" onNavigate={close} onExecute={event => execute(r.id, undefined, event)}>
                  {renderRemoteResult ? renderRemoteResult(r, { selected: r.id === selectedId, query }) : <>
                    <ResultMain label={r.entry.label} labelMatches={r.labelMatches} matches={r.matches} fields={['keyword']} />
                    {r.entry.description && (
                      <span className="kbd-omnibar-result-description">{r.entry.description}</span>
                    )}
                  </>}
                </OmnibarResultRow>
              </Command.Item>
            ))}
          </Command.Group>
        ))}
        {isLoadingRemote && <div className="kbd-omnibar-loading" aria-hidden>Loading…</div>}
      </Command.List>
      {!inParamEntry && selectedHref && <OmnibarNewTabHint />}
    </Command>
  )

  // Inline: always-visible, non-modal. No backdrop, dialog, open-gating, or ⌘K
  // toggle action.
  if (inline) {
    return <div className="kbd-omnibar kbd-omnibar-inline">{body}</div>
  }

  // Modal: register the ⌘K toggle (even while closed), show backdrop + dialog
  // only when open.
  return (
    <>
      <OmnibarToggleAction defaultBinding={defaultBinding} />
      {isOpen && (
        <div className="kbd-omnibar-backdrop" onClick={() => ctx?.closeOmnibar()}>
          <div className="kbd-omnibar" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            {body}
          </div>
        </div>
      )}
    </>
  )
}
