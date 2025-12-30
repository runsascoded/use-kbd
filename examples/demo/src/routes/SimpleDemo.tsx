import { useCallback, useMemo, useState } from 'react'
import {
  createTwoColumnRenderer,
  HotkeysProvider,
  Kbd,
  ShortcutsModal,
  useAction,
  useHotkeysContext,
} from 'use-kbd'
import 'use-kbd/styles.css'

interface DataRow {
  id: number
  name: string
  status: 'active' | 'pending' | 'inactive'
  value: number
}

const INITIAL_DATA: DataRow[] = [
  { id: 1, name: 'Alpha', status: 'active', value: 120 },
  { id: 2, name: 'Beta', status: 'pending', value: 85 },
  { id: 3, name: 'Gamma', status: 'active', value: 200 },
  { id: 4, name: 'Delta', status: 'inactive', value: 45 },
  { id: 5, name: 'Epsilon', status: 'pending', value: 160 },
]

type SortDirection = 'asc' | 'desc' | null
type SortColumn = 'name' | 'status' | 'value'

function DataTable() {
  const ctx = useHotkeysContext()

  const [data] = useState<DataRow[]>(INITIAL_DATA)
  const [selectedId, setSelectedId] = useState<number | null>(1)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [data, sortColumn, sortDirection])

  const selectedIndex = sortedData.findIndex(r => r.id === selectedId)

  // Sort handlers
  const sortNameAsc = useCallback(() => {
    setSortColumn('name')
    setSortDirection('asc')
  }, [])
  const sortNameDesc = useCallback(() => {
    setSortColumn('name')
    setSortDirection('desc')
  }, [])
  const sortStatusAsc = useCallback(() => {
    setSortColumn('status')
    setSortDirection('asc')
  }, [])
  const sortStatusDesc = useCallback(() => {
    setSortColumn('status')
    setSortDirection('desc')
  }, [])
  const sortValueAsc = useCallback(() => {
    setSortColumn('value')
    setSortDirection('asc')
  }, [])
  const sortValueDesc = useCallback(() => {
    setSortColumn('value')
    setSortDirection('desc')
  }, [])
  const sortClear = useCallback(() => {
    setSortColumn(null)
    setSortDirection(null)
  }, [])

  // Navigation actions
  useAction('nav:up', {
    label: 'Up',
    group: 'Navigation',
    defaultBindings: ['k', 'arrowup'],
    handler: useCallback(() => {
      if (selectedIndex > 0) {
        setSelectedId(sortedData[selectedIndex - 1].id)
      }
    }, [sortedData, selectedIndex]),
  })

  useAction('nav:down', {
    label: 'Down',
    group: 'Navigation',
    defaultBindings: ['j', 'arrowdown'],
    handler: useCallback(() => {
      if (selectedIndex < sortedData.length - 1) {
        setSelectedId(sortedData[selectedIndex + 1].id)
      }
    }, [sortedData, selectedIndex]),
  })

  useAction('nav:first', {
    label: 'First',
    group: 'Navigation',
    defaultBindings: ['meta+arrowup', 'ctrl+arrowup'],
    handler: useCallback(() => {
      if (sortedData.length > 0) {
        setSelectedId(sortedData[0].id)
      }
    }, [sortedData]),
  })

  useAction('nav:last', {
    label: 'Last',
    group: 'Navigation',
    defaultBindings: ['meta+arrowdown', 'ctrl+arrowdown'],
    handler: useCallback(() => {
      if (sortedData.length > 0) {
        setSelectedId(sortedData[sortedData.length - 1].id)
      }
    }, [sortedData]),
  })

  useAction('nav:pageup', {
    label: 'Page up',
    group: 'Navigation',
    defaultBindings: ['alt+arrowup'],
    handler: useCallback(() => {
      const newIndex = Math.max(0, selectedIndex - 3)
      setSelectedId(sortedData[newIndex].id)
    }, [sortedData, selectedIndex]),
  })

  useAction('nav:pagedown', {
    label: 'Page down',
    group: 'Navigation',
    defaultBindings: ['alt+arrowdown'],
    handler: useCallback(() => {
      const newIndex = Math.min(sortedData.length - 1, selectedIndex + 3)
      setSelectedId(sortedData[newIndex].id)
    }, [sortedData, selectedIndex]),
  })

  // Sort actions - paired asc/desc for each column (single keys for instant response)
  useAction('sort:name:asc', {
    label: 'Name ↑',
    group: 'Sort',
    defaultBindings: ['n'],
    handler: sortNameAsc,
  })

  useAction('sort:name:desc', {
    label: 'Name ↓',
    group: 'Sort',
    defaultBindings: ['shift+n'],
    handler: sortNameDesc,
  })

  useAction('sort:status:asc', {
    label: 'Status ↑',
    group: 'Sort',
    defaultBindings: ['s'],
    handler: sortStatusAsc,
  })

  useAction('sort:status:desc', {
    label: 'Status ↓',
    group: 'Sort',
    defaultBindings: ['shift+s'],
    handler: sortStatusDesc,
  })

  useAction('sort:value:asc', {
    label: 'Value ↑',
    group: 'Sort',
    defaultBindings: ['v'],
    handler: sortValueAsc,
  })

  useAction('sort:value:desc', {
    label: 'Value ↓',
    group: 'Sort',
    defaultBindings: ['shift+v'],
    handler: sortValueDesc,
  })

  useAction('sort:clear', {
    label: 'Clear',
    group: 'Sort',
    defaultBindings: ['c'],
    handler: sortClear,
  })

  // General actions
  useAction('help', {
    label: 'Show shortcuts',
    group: 'General',
    defaultBindings: ['?'],
    handler: () => ctx.toggleModal(),
  })

  // Two-column renderer for Sort group
  const SortRenderer = useMemo(() => createTwoColumnRenderer({
    headers: ['', 'Asc', 'Desc'],
    getRows: () => [
      { label: 'Name', leftAction: 'sort:name:asc', rightAction: 'sort:name:desc' },
      { label: 'Status', leftAction: 'sort:status:asc', rightAction: 'sort:status:desc' },
      { label: 'Value', leftAction: 'sort:value:asc', rightAction: 'sort:value:desc' },
    ],
  }), [])

  // Two-column renderer for Navigation group
  const NavRenderer = useMemo(() => createTwoColumnRenderer({
    headers: ['', 'Up', 'Down'],
    getRows: () => [
      { label: 'Single', leftAction: 'nav:up', rightAction: 'nav:down' },
      { label: 'Page', leftAction: 'nav:pageup', rightAction: 'nav:pagedown' },
      { label: 'Ends', leftAction: 'nav:first', rightAction: 'nav:last' },
    ],
  }), [])

  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="data-table-app">
      <h1>Data Table Demo</h1>
      <p className="hint">
        Uses <code>sequenceTimeout: 0</code> for instant response.
        Press <Kbd action="help" /> for shortcuts.
        Sort by name: <Kbd action="sort:name:asc" first /> / <Kbd action="sort:name:desc" first />
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th>Name{getSortIndicator('name')}</th>
            <th>Status{getSortIndicator('status')}</th>
            <th>Value{getSortIndicator('value')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map(row => (
            <tr
              key={row.id}
              className={row.id === selectedId ? 'selected' : ''}
              onClick={() => setSelectedId(row.id)}
            >
              <td>{row.name}</td>
              <td><span className={`status-badge ${row.status}`}>{row.status}</span></td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ShortcutsModal
        editable
        groupRenderers={{ Sort: SortRenderer, Navigation: NavRenderer }}
      />
    </div>
  )
}

export function SimpleDemo() {
  return (
    <HotkeysProvider
      config={{
        storageKey: 'use-kbd-demo-simple',
        sequenceTimeout: 0,
      }}
    >
      <DataTable />
    </HotkeysProvider>
  )
}
