import { useCallback, useMemo, useState } from 'react'
import {
  createTwoColumnRenderer,
  Kbd,
  ShortcutsModal,
  useAction,
} from 'use-kbd'
import 'use-kbd/styles.css'

interface DataRow {
  id: number
  name: string
  status: 'active' | 'pending' | 'inactive'
  value: number
}

// Generate 1000 synthetic rows
const NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon']
const STATUSES: DataRow['status'][] = ['active', 'pending', 'inactive']

const INITIAL_DATA: DataRow[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `${NAMES[i % NAMES.length]}-${Math.floor(i / NAMES.length) + 1}`,
  status: STATUSES[i % 3],
  value: Math.floor(Math.random() * 500) + 10,
}))

const PAGE_SIZES = [10, 20, 50, 100]

type SortDirection = 'asc' | 'desc' | null
type SortColumn = 'name' | 'status' | 'value'

function DataTable() {
  const [data, setData] = useState<DataRow[]>(INITIAL_DATA)
  const [history, setHistory] = useState<DataRow[][]>([]) // for undo
  // Multi-select state: hoveredIndex is cursor position, selectedIds is the selection set
  const [hoveredIndex, setHoveredIndex] = useState<number>(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set([1]))
  const [rangeAnchor, setRangeAnchor] = useState<number>(0) // index for shift-selection
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pageSizeDropdownOpen, setPageSizeDropdownOpen] = useState(false)

  // Save current data to history before mutation
  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-19), data])
  }, [data])

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

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize])

  // Helper to select a range of indices (inclusive)
  const selectRange = useCallback((from: number, to: number) => {
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    const newSelected = new Set<number>()
    for (let i = start; i <= end; i++) {
      if (paginatedData[i]) {
        newSelected.add(paginatedData[i].id)
      }
    }
    setSelectedIds(newSelected)
  }, [paginatedData])

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

  // Row navigation actions (within current page)
  // Regular up/down: move cursor and single-select
  useAction('nav:up', {
    label: 'Row up',
    group: 'Row Navigation',
    defaultBindings: ['k', 'arrowup'],
    handler: useCallback(() => {
      if (hoveredIndex > 0) {
        const newIndex = hoveredIndex - 1
        setHoveredIndex(newIndex)
        setRangeAnchor(newIndex)
        setSelectedIds(new Set([paginatedData[newIndex].id]))
      }
    }, [paginatedData, hoveredIndex]),
  })

  useAction('nav:down', {
    label: 'Row down',
    group: 'Row Navigation',
    defaultBindings: ['j', 'arrowdown'],
    handler: useCallback(() => {
      if (hoveredIndex < paginatedData.length - 1) {
        const newIndex = hoveredIndex + 1
        setHoveredIndex(newIndex)
        setRangeAnchor(newIndex)
        setSelectedIds(new Set([paginatedData[newIndex].id]))
      }
    }, [paginatedData, hoveredIndex]),
  })

  // Shift+up/down: extend selection range from anchor
  useAction('nav:extend-up', {
    label: 'Extend up',
    group: 'Row Navigation',
    defaultBindings: ['shift+k', 'shift+arrowup'],
    handler: useCallback(() => {
      if (hoveredIndex > 0) {
        const newIndex = hoveredIndex - 1
        setHoveredIndex(newIndex)
        selectRange(rangeAnchor, newIndex)
      }
    }, [hoveredIndex, rangeAnchor, selectRange]),
  })

  useAction('nav:extend-down', {
    label: 'Extend down',
    group: 'Row Navigation',
    defaultBindings: ['shift+j', 'shift+arrowdown'],
    handler: useCallback(() => {
      if (hoveredIndex < paginatedData.length - 1) {
        const newIndex = hoveredIndex + 1
        setHoveredIndex(newIndex)
        selectRange(rangeAnchor, newIndex)
      }
    }, [paginatedData, hoveredIndex, rangeAnchor, selectRange]),
  })

  useAction('nav:first', {
    label: 'First row',
    group: 'Row Navigation',
    defaultBindings: ['meta+arrowup'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        setHoveredIndex(0)
        setRangeAnchor(0)
        setSelectedIds(new Set([paginatedData[0].id]))
      }
    }, [paginatedData]),
  })

  useAction('nav:last', {
    label: 'Last row',
    group: 'Row Navigation',
    defaultBindings: ['meta+arrowdown'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        const lastIndex = paginatedData.length - 1
        setHoveredIndex(lastIndex)
        setRangeAnchor(lastIndex)
        setSelectedIds(new Set([paginatedData[lastIndex].id]))
      }
    }, [paginatedData]),
  })

  // Select to start/end of page
  useAction('nav:select-to-first', {
    label: 'Select to first',
    group: 'Row Navigation',
    defaultBindings: ['meta+shift+arrowup'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        setHoveredIndex(0)
        selectRange(rangeAnchor, 0)
      }
    }, [paginatedData, rangeAnchor, selectRange]),
  })

  useAction('nav:select-to-last', {
    label: 'Select to last',
    group: 'Row Navigation',
    defaultBindings: ['meta+shift+arrowdown'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        const lastIndex = paginatedData.length - 1
        setHoveredIndex(lastIndex)
        selectRange(rangeAnchor, lastIndex)
      }
    }, [paginatedData, rangeAnchor, selectRange]),
  })

  useAction('nav:select-all', {
    label: 'Select all',
    group: 'Selection',
    defaultBindings: ['ctrl+a'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        setSelectedIds(new Set(paginatedData.map(r => r.id)))
      }
    }, [paginatedData]),
  })

  // Page navigation actions
  useAction('page:prev', {
    label: 'Prev page',
    group: 'Page Navigation',
    defaultBindings: ['arrowleft'],
    handler: useCallback(() => {
      if (currentPage > 1) {
        setCurrentPage(p => p - 1)
      }
    }, [currentPage]),
  })

  useAction('page:next', {
    label: 'Next page',
    group: 'Page Navigation',
    defaultBindings: ['arrowright'],
    handler: useCallback(() => {
      if (currentPage < totalPages) {
        setCurrentPage(p => p + 1)
      }
    }, [currentPage, totalPages]),
  })

  useAction('page:first', {
    label: 'First page',
    group: 'Page Navigation',
    defaultBindings: ['meta+arrowleft'],
    handler: useCallback(() => {
      setCurrentPage(1)
    }, []),
  })

  useAction('page:last', {
    label: 'Last page',
    group: 'Page Navigation',
    defaultBindings: ['meta+arrowright'],
    handler: useCallback(() => {
      setCurrentPage(totalPages)
    }, [totalPages]),
  })

  // Page size actions (use numeric prefixes to control sort order in modal)
  useAction('pagesize:1-10', {
    label: '10 rows',
    group: 'Page Size',
    defaultBindings: ['1'],
    handler: useCallback(() => {
      setPageSize(10)
      setCurrentPage(1)
    }, []),
  })

  useAction('pagesize:2-20', {
    label: '20 rows',
    group: 'Page Size',
    defaultBindings: ['2'],
    handler: useCallback(() => {
      setPageSize(20)
      setCurrentPage(1)
    }, []),
  })

  useAction('pagesize:3-50', {
    label: '50 rows',
    group: 'Page Size',
    defaultBindings: ['5'],
    handler: useCallback(() => {
      setPageSize(50)
      setCurrentPage(1)
    }, []),
  })

  useAction('pagesize:4-100', {
    label: '100 rows',
    group: 'Page Size',
    defaultBindings: ['0'],
    handler: useCallback(() => {
      setPageSize(100)
      setCurrentPage(1)
    }, []),
  })

  // Status actions - set status on selected rows
  const setSelectedStatus = useCallback((status: DataRow['status']) => {
    saveHistory()
    setData(prev => prev.map(row =>
      selectedIds.has(row.id) ? { ...row, status } : row
    ))
  }, [selectedIds, saveHistory])

  // Undo action
  useAction('undo', {
    label: 'Undo',
    group: 'Edit',
    defaultBindings: ['z'],
    handler: useCallback(() => {
      if (history.length > 0) {
        const prevData = history[history.length - 1]
        setHistory(h => h.slice(0, -1))
        setData(prevData)
      }
    }, [history]),
  })

  useAction('status:active', {
    label: 'Set active',
    group: 'Status',
    defaultBindings: ['a'],
    handler: useCallback(() => setSelectedStatus('active'), [setSelectedStatus]),
  })

  useAction('status:pending', {
    label: 'Set pending',
    group: 'Status',
    defaultBindings: ['p'],
    handler: useCallback(() => setSelectedStatus('pending'), [setSelectedStatus]),
  })

  useAction('status:inactive', {
    label: 'Set inactive',
    group: 'Status',
    defaultBindings: ['i'],
    handler: useCallback(() => setSelectedStatus('inactive'), [setSelectedStatus]),
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


  // Two-column renderer for Sort group
  const SortRenderer = useMemo(() => createTwoColumnRenderer({
    headers: ['', 'Asc', 'Desc'],
    getRows: () => [
      { label: 'Name', leftAction: 'sort:name:asc', rightAction: 'sort:name:desc' },
      { label: 'Status', leftAction: 'sort:status:asc', rightAction: 'sort:status:desc' },
      { label: 'Value', leftAction: 'sort:value:asc', rightAction: 'sort:value:desc' },
    ],
  }), [])

  // Two-column renderer for Row Navigation group
  const RowNavRenderer = useMemo(() => createTwoColumnRenderer({
    headers: ['', 'Up', 'Down'],
    getRows: () => [
      { label: 'Move', leftAction: 'nav:up', rightAction: 'nav:down' },
      { label: 'Extend', leftAction: 'nav:extend-up', rightAction: 'nav:extend-down' },
      { label: 'Jump', leftAction: 'nav:first', rightAction: 'nav:last' },
      { label: 'Select to', leftAction: 'nav:select-to-first', rightAction: 'nav:select-to-last' },
    ],
  }), [])

  // Two-column renderer for Page Navigation group
  const PageNavRenderer = useMemo(() => createTwoColumnRenderer({
    headers: ['', 'Prev', 'Next'],
    getRows: () => [
      { label: 'One page', leftAction: 'page:prev', rightAction: 'page:next' },
      { label: 'First / Last', leftAction: 'page:first', rightAction: 'page:last' },
    ],
  }), [])

  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  // Calculate 1-based row indices for display
  const startRow = (currentPage - 1) * pageSize + 1
  const endRow = Math.min(currentPage * pageSize, sortedData.length)

  // Deselect when clicking outside the table
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Don't deselect if clicking inside table, pagination, or modals
    if (target.closest('.data-table') || target.closest('.pagination-controls') || target.closest('.kbd-modal') || target.closest('.kbd-backdrop')) {
      return
    }
    setSelectedIds(new Set())
    setHoveredIndex(-1)
  }, [])

  return (
    <div className="data-table-app" onClick={handleContainerClick}>
      <h1 id="demo">Data Table Demo</h1>
      <p className="hint">
        Press <Kbd action="global:0-help" /> for shortcuts.
        {selectedIds.size > 1 && <strong> ({selectedIds.size} selected)</strong>}
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th>Name{getSortIndicator('name')}</th>
            <th>Status{getSortIndicator('status')}</th>
            <th>Value{getSortIndicator('value')}</th>
          </tr>
        </thead>
        <tbody onMouseLeave={() => setHoveredIndex(-1)}>
          {paginatedData.map((row, index) => {
            const isHovered = index === hoveredIndex
            const isSelected = selectedIds.has(row.id)
            return (
              <tr
                key={row.id}
                className={`${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onClick={(e) => {
                  setHoveredIndex(index)
                  if (e.shiftKey) {
                    // Shift-click: range select from anchor to clicked
                    selectRange(rangeAnchor, index)
                  } else if (e.metaKey || e.ctrlKey) {
                    // Meta/Ctrl-click: toggle selection, start new range anchor
                    setRangeAnchor(index)
                    setSelectedIds(prev => {
                      const next = new Set(prev)
                      if (next.has(row.id)) {
                        next.delete(row.id)
                      } else {
                        next.add(row.id)
                      }
                      return next
                    })
                  } else {
                    // Normal click: single select
                    setRangeAnchor(index)
                    setSelectedIds(new Set([row.id]))
                  }
                }}
              >
                <td>{row.name}</td>
                <td><span className={`status-badge ${row.status}`}>{row.status}</span></td>
                <td>{row.value}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="pagination-controls">
        <div className="pagination-buttons">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="First page (⌘←)"
          >
            ⏮
          </button>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            title="Previous page (←)"
          >
            ◀
          </button>
          <span className="page-info">
            {startRow}–{endRow} of {sortedData.length}
          </span>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            title="Next page (→)"
          >
            ▶
          </button>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last page (⌘→)"
          >
            ⏭
          </button>
        </div>
        <div className="page-size-control">
          <button
            className={`page-size-btn ${pageSizeDropdownOpen ? 'open' : ''}`}
            onClick={() => setPageSizeDropdownOpen(o => !o)}
          >
            {pageSize} per page ▾
          </button>
          {pageSizeDropdownOpen && (
            <div className="page-size-dropdown">
              {PAGE_SIZES.map(size => (
                <button
                  key={size}
                  className={`page-size-option ${size === pageSize ? 'selected' : ''}`}
                  onClick={() => {
                    setPageSize(size)
                    setCurrentPage(1)
                    setPageSizeDropdownOpen(false)
                  }}
                >
                  {size} rows
                  <kbd className="page-size-key">{size === 10 ? '1' : size === 20 ? '2' : size === 50 ? '5' : '0'}</kbd>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ShortcutsModal
        editable
        groupOrder={[
          'Sort',
          'Row Navigation',
          'Page Navigation',
          'Page Size',
          'Selection',
          'Status',
          'Edit',
          'Global',
          'Navigation',
        ]}
        groupRenderers={{
          Sort: SortRenderer,
          'Row Navigation': RowNavRenderer,
          'Page Navigation': PageNavRenderer,
        }}
      />
    </div>
  )
}

export function TableDemo() {
  return <DataTable />
}
