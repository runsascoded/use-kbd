import { Fragment, useCallback } from 'react'
import { Command } from 'cmdk'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { useAction } from './useAction'
import { useOmnibar } from './useOmnibar'
import { ACTION_OMNIBAR, DEFAULT_BUILTIN_GROUP } from './constants'
import type { OmnibarEntry } from './types'

/**
 * SPIKE (cmdk-delegation branch): a command palette backed by `cmdk` primitives
 * instead of the hand-rolled input/list/keyboard-nav in `<Omnibar />`, while
 * keeping use-kbd's action-registry + endpoint bridge (`useOmnibar`).
 *
 * Purpose: prove cmdk can own the palette UI/UX (input, list, keyboard nav,
 * a11y) fed by the same registered actions + async endpoints. NOT wired for
 * ParamEntry, pagination, sequence completions, or recents highlighting yet —
 * those are the parity work in the branch plan. See specs/cmdk-delegation.md.
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

  const isOpen = ctx?.isOmnibarOpen ?? false
  if (!isOpen) return null

  // Group remote (endpoint) results by their display group.
  const remoteByGroup = new Map<string, typeof remoteResults>()
  for (const r of remoteResults) {
    const g = r.entry.group ?? r.endpointId
    const arr = remoteByGroup.get(g) ?? []
    arr.push(r)
    remoteByGroup.set(g, arr)
  }

  return (
    <div className="kbd-omnibar-backdrop" onClick={() => ctx?.closeOmnibar()}>
      <div className="kbd-omnibar" onClick={e => e.stopPropagation()}>
        <Command
          shouldFilter={false}
          loop
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); ctx?.closeOmnibar() } }}
        >
          <div className="kbd-omnibar-header">
            <Command.Input
              autoFocus
              className="kbd-omnibar-input"
              placeholder="Type a command…"
              value={query}
              onValueChange={setQuery}
            />
          </div>
          <Command.List className="kbd-omnibar-list">
            <Command.Empty className="kbd-omnibar-empty">
              {isLoadingRemote ? 'Searching…' : 'No results.'}
            </Command.Empty>

            {results.length > 0 && (
              <Command.Group heading="Actions" className="kbd-omnibar-group">
                {results.map(r => (
                  <Command.Item
                    key={r.id}
                    value={r.id}
                    className="kbd-omnibar-result"
                    onSelect={() => execute(r.id, r.captures)}
                  >
                    <span className="kbd-omnibar-result-label">{r.action.label}</span>
                    {r.bindings[0] && <kbd className="kbd-omnibar-binding">{r.bindings[0]}</kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {Array.from(remoteByGroup.entries()).map(([group, items]) => (
              <Fragment key={group}>
                <Command.Group heading={group} className="kbd-omnibar-group">
                  {items.map(r => (
                    <Command.Item
                      key={r.id}
                      value={r.id}
                      className="kbd-omnibar-result"
                      onSelect={() => execute(r.id)}
                    >
                      <span className="kbd-omnibar-result-label">{r.entry.label}</span>
                      {r.entry.description && (
                        <span className="kbd-omnibar-result-description">{r.entry.description}</span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              </Fragment>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
