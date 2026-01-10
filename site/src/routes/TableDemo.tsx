import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Tooltip from '@mui/material/Tooltip'
import {
  createTwoColumnRenderer,
  KbdModal,
  KbdOmnibar,
  ShortcutsModal,
  useAction,
  useOmnibarEndpoint,
} from 'use-kbd'
import type { OmnibarEntry } from 'use-kbd'
import type { TooltipProps } from 'use-kbd'
import 'use-kbd/styles.css'

/** MUI Tooltip wrapper for use-kbd */
function MuiTooltip({ title, children }: TooltipProps) {
  return (
    <Tooltip
      title={title}
      placement="top"
      arrow
      PopperProps={{
        disablePortal: true,
      }}
    >
      <span style={{ display: 'inline' }}>{children}</span>
    </Tooltip>
  )
}

interface DataRow {
  id: number
  name: string
  status: 'active' | 'pending' | 'inactive'
  value: number
}

// Generate 1000 synthetic rows
const NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon']
const STATUSES: DataRow['status'][] = ['active', 'pending', 'inactive']

// Mulberry32 PRNG - deterministic pseudo-random number generator
function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const rng = mulberry32(42) // Fixed seed for deterministic data

const INITIAL_DATA: DataRow[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `${NAMES[i % NAMES.length]}-${Math.floor(i / NAMES.length) + 1}`,
  status: STATUSES[i % 3],
  value: Math.floor(rng() * 500) + 10,
}))

const PAGE_SIZES = [10, 20, 50, 100]

type SortDirection = 'asc' | 'desc' | null
type SortColumn = 'name' | 'status' | 'value'

function DataTable() {
  const [data, setData] = useState<DataRow[]>(INITIAL_DATA)
  const [history, setHistory] = useState<DataRow[][]>([]) // for undo
  // Multi-select state:
  // - hoveredIndex: keyboard cursor position (moving end of current range)
  // - rangeAnchor: fixed end of current range
  // - pinnedIds: IDs from previous selections (preserved during shift+arrow)
  // - selectedIds: computed as pinnedIds ∪ current range
  const [hoveredIndex, setHoveredIndex] = useState<number>(0)
  const [rangeAnchor, setRangeAnchor] = useState<number>(0)
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(new Set())
  const [mouseHoverIndex, setMouseHoverIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pageSizeDropdownOpen, setPageSizeDropdownOpen] = useState(false)

  // Save current data to history before mutation
  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-19), data])
  }, [data])

  // Document-level click handler for deselection
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Don't deselect if clicking inside the table, pagination, modals, or omnibar
      if (
        tableRef.current?.contains(target) ||
        target.closest('.pagination-controls') ||
        target.closest('.kbd-modal') ||
        target.closest('.kbd-backdrop') ||
        target.closest('.kbd-omnibar')
      ) {
        return
      }
      setPinnedIds(new Set())
      setHoveredIndex(-1)
      setRangeAnchor(-1)
    }
    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

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

  // Compute selectedIds from pinnedIds + current range
  const selectedIds = useMemo(() => {
    const result = new Set(pinnedIds)
    if (hoveredIndex >= 0 && rangeAnchor >= 0) {
      const start = Math.min(hoveredIndex, rangeAnchor)
      const end = Math.max(hoveredIndex, rangeAnchor)
      for (let i = start; i <= end; i++) {
        if (paginatedData[i]) {
          result.add(paginatedData[i].id)
        }
      }
    }
    return result
  }, [pinnedIds, hoveredIndex, rangeAnchor, paginatedData])

  // Navigate to a specific row by ID
  const navigateToRow = useCallback((rowId: number) => {
    // Find the row in sortedData to get its position
    const rowIndex = sortedData.findIndex(r => r.id === rowId)
    if (rowIndex === -1) return

    // Calculate which page the row is on
    const targetPage = Math.floor(rowIndex / pageSize) + 1
    setCurrentPage(targetPage)

    // Calculate the index within the page
    const indexInPage = rowIndex % pageSize

    // Select the row
    setHoveredIndex(indexInPage)
    setRangeAnchor(indexInPage)
    setPinnedIds(new Set())
  }, [sortedData, pageSize])

  // Register omnibar endpoint for searching table rows
  useOmnibarEndpoint('table-rows', useMemo(() => ({
    fetch: async (query: string, _signal: AbortSignal): Promise<OmnibarEntry[]> => {
      // Simulate network latency (50-150ms)
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100))

      const lowerQuery = query.toLowerCase()
      const matches: Array<{ row: DataRow; score: number }> = []

      for (const row of data) {
        // Score based on name match
        const name = row.name.toLowerCase()
        let score = 0

        if (name === lowerQuery) {
          score = 100 // Exact match
        } else if (name.startsWith(lowerQuery)) {
          score = 80 // Prefix match
        } else if (name.includes(lowerQuery)) {
          score = 60 // Contains match
        } else if (row.status.includes(lowerQuery)) {
          score = 40 // Status match
        } else if (row.value.toString().includes(query)) {
          score = 30 // Value match
        }

        if (score > 0) {
          matches.push({ row, score })
        }
      }

      // Sort by score and limit
      matches.sort((a, b) => b.score - a.score)
      const topMatches = matches.slice(0, 10)

      // Convert to OmnibarEntry format with handlers
      return topMatches.map(({ row }) => ({
        id: `row-${row.id}`,
        label: row.name,
        description: `${row.status} • Value: ${row.value}`,
        group: 'Table Rows',
        keywords: [row.status, row.value.toString()],
        handler: () => navigateToRow(row.id),
      }))
    },
    group: 'Table Rows',
    priority: 50, // Lower than local actions
    minQueryLength: 1,
  }), [data, navigateToRow]))

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
  // Regular up/down: move cursor and single-select (clears pinned)
  // If no selection, initialize from mouse hover position
  useAction('nav:up', {
    label: 'Row up',
    group: 'Table: Row Navigation',
    defaultBindings: ['k', 'arrowup'],
    handler: useCallback(() => {
      // If no cursor, initialize from mouse hover
      if (hoveredIndex < 0 && mouseHoverIndex >= 0) {
        setHoveredIndex(mouseHoverIndex)
        setRangeAnchor(mouseHoverIndex)
        setPinnedIds(new Set())
        return
      }
      if (hoveredIndex > 0) {
        const newIndex = hoveredIndex - 1
        setHoveredIndex(newIndex)
        setRangeAnchor(newIndex)
        setPinnedIds(new Set())
      }
    }, [hoveredIndex, mouseHoverIndex]),
  })

  useAction('nav:down', {
    label: 'Row down',
    group: 'Table: Row Navigation',
    defaultBindings: ['j', 'arrowdown'],
    handler: useCallback(() => {
      // If no cursor, initialize from mouse hover
      if (hoveredIndex < 0 && mouseHoverIndex >= 0) {
        setHoveredIndex(mouseHoverIndex)
        setRangeAnchor(mouseHoverIndex)
        setPinnedIds(new Set())
        return
      }
      if (hoveredIndex < paginatedData.length - 1) {
        const newIndex = hoveredIndex + 1
        setHoveredIndex(newIndex)
        setRangeAnchor(newIndex)
        setPinnedIds(new Set())
      }
    }, [paginatedData, hoveredIndex, mouseHoverIndex]),
  })

  // Numeric navigation: move up/down by N rows
  // If no selection, initialize from mouse hover position
  useAction('nav:up-n', {
    label: 'Up N rows',
    group: 'Table: Row Navigation',
    defaultBindings: ['\\d+ k', '\\d+ arrowup'],
    handler: useCallback((_e, captures) => {
      const n = captures?.[0] ?? 1
      // If no cursor, initialize from mouse hover
      if (hoveredIndex < 0 && mouseHoverIndex >= 0) {
        setHoveredIndex(mouseHoverIndex)
        setRangeAnchor(mouseHoverIndex)
        setPinnedIds(new Set())
        return
      }
      const newIndex = Math.max(0, hoveredIndex - n)
      setHoveredIndex(newIndex)
      setRangeAnchor(newIndex)
      setPinnedIds(new Set())
    }, [hoveredIndex, mouseHoverIndex]),
  })

  useAction('nav:down-n', {
    label: 'Down N rows',
    group: 'Table: Row Navigation',
    defaultBindings: ['\\d+ j', '\\d+ arrowdown'],
    handler: useCallback((_e, captures) => {
      const n = captures?.[0] ?? 1
      // If no cursor, initialize from mouse hover
      if (hoveredIndex < 0 && mouseHoverIndex >= 0) {
        setHoveredIndex(mouseHoverIndex)
        setRangeAnchor(mouseHoverIndex)
        setPinnedIds(new Set())
        return
      }
      const newIndex = Math.min(paginatedData.length - 1, hoveredIndex + n)
      setHoveredIndex(newIndex)
      setRangeAnchor(newIndex)
      setPinnedIds(new Set())
    }, [paginatedData, hoveredIndex, mouseHoverIndex]),
  })

  // Shift+up/down: extend selection range from anchor (preserves pinned)
  // If no cursor established, use mouse hover position as anchor
  useAction('nav:extend-up', {
    label: 'Extend up',
    group: 'Table: Row Navigation',
    defaultBindings: ['shift+k', 'shift+arrowup'],
    handler: useCallback(() => {
      // If no cursor, initialize from mouse hover
      if (hoveredIndex < 0 && mouseHoverIndex >= 0) {
        const anchor = mouseHoverIndex
        const newIndex = Math.max(0, anchor - 1)
        setHoveredIndex(newIndex)
        setRangeAnchor(anchor)
        return
      }
      if (hoveredIndex > 0) {
        setHoveredIndex(hoveredIndex - 1)
      }
    }, [hoveredIndex, mouseHoverIndex]),
  })

  useAction('nav:extend-down', {
    label: 'Extend down',
    group: 'Table: Row Navigation',
    defaultBindings: ['shift+j', 'shift+arrowdown'],
    handler: useCallback(() => {
      // If no cursor, initialize from mouse hover
      if (hoveredIndex < 0 && mouseHoverIndex >= 0) {
        const anchor = mouseHoverIndex
        const newIndex = Math.min(paginatedData.length - 1, anchor + 1)
        setHoveredIndex(newIndex)
        setRangeAnchor(anchor)
        return
      }
      if (hoveredIndex < paginatedData.length - 1) {
        setHoveredIndex(hoveredIndex + 1)
      }
    }, [paginatedData, hoveredIndex, mouseHoverIndex]),
  })

  // Numeric extend selection: extend up/down by N rows
  useAction('nav:extend-up-n', {
    label: 'Extend up N rows',
    group: 'Table: Row Navigation',
    defaultBindings: ['\\d+ shift+k', '\\d+ shift+arrowup'],
    handler: useCallback((_e, captures) => {
      const n = captures?.[0] ?? 1
      // If no cursor, initialize from mouse hover
      if (hoveredIndex < 0 && mouseHoverIndex >= 0) {
        const anchor = mouseHoverIndex
        const newIndex = Math.max(0, anchor - n)
        setHoveredIndex(newIndex)
        setRangeAnchor(anchor)
        return
      }
      const newIndex = Math.max(0, hoveredIndex - n)
      setHoveredIndex(newIndex)
    }, [hoveredIndex, mouseHoverIndex]),
  })

  useAction('nav:extend-down-n', {
    label: 'Extend down N rows',
    group: 'Table: Row Navigation',
    defaultBindings: ['\\d+ shift+j', '\\d+ shift+arrowdown'],
    handler: useCallback((_e, captures) => {
      const n = captures?.[0] ?? 1
      // If no cursor, initialize from mouse hover
      if (hoveredIndex < 0 && mouseHoverIndex >= 0) {
        const anchor = mouseHoverIndex
        const newIndex = Math.min(paginatedData.length - 1, anchor + n)
        setHoveredIndex(newIndex)
        setRangeAnchor(anchor)
        return
      }
      const newIndex = Math.min(paginatedData.length - 1, hoveredIndex + n)
      setHoveredIndex(newIndex)
    }, [paginatedData, hoveredIndex, mouseHoverIndex]),
  })

  useAction('nav:first', {
    label: 'First row',
    group: 'Table: Row Navigation',
    defaultBindings: ['meta+arrowup'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        setHoveredIndex(0)
        setRangeAnchor(0)
        setPinnedIds(new Set())
      }
    }, [paginatedData]),
  })

  useAction('nav:last', {
    label: 'Last row',
    group: 'Table: Row Navigation',
    defaultBindings: ['meta+arrowdown'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        const lastIndex = paginatedData.length - 1
        setHoveredIndex(lastIndex)
        setRangeAnchor(lastIndex)
        setPinnedIds(new Set())
      }
    }, [paginatedData]),
  })

  // Meta+shift: extend current range to start/end (preserves pinned)
  useAction('nav:select-to-first', {
    label: 'Select to first',
    group: 'Table: Row Navigation',
    defaultBindings: ['meta+shift+arrowup'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        setHoveredIndex(0)
      }
    }, [paginatedData]),
  })

  useAction('nav:select-to-last', {
    label: 'Select to last',
    group: 'Table: Row Navigation',
    defaultBindings: ['meta+shift+arrowdown'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        setHoveredIndex(paginatedData.length - 1)
      }
    }, [paginatedData]),
  })

  useAction('nav:select-all', {
    label: 'Select all',
    group: 'Table: Selection',
    defaultBindings: ['ctrl+a'],
    handler: useCallback(() => {
      if (paginatedData.length > 0) {
        setPinnedIds(new Set(paginatedData.map(r => r.id)))
        setHoveredIndex(-1)
        setRangeAnchor(-1)
      }
    }, [paginatedData]),
  })

  useAction('nav:deselect', {
    label: 'Deselect all',
    group: 'Table: Selection',
    defaultBindings: ['escape'],
    handler: useCallback(() => {
      setPinnedIds(new Set())
      setHoveredIndex(-1)
      setRangeAnchor(-1)
    }, []),
  })

  // Page navigation actions
  useAction('page:prev', {
    label: 'Prev page',
    group: 'Table: Page Navigation',
    defaultBindings: ['arrowleft'],
    handler: useCallback(() => {
      if (currentPage > 1) {
        setCurrentPage(p => p - 1)
      }
    }, [currentPage]),
  })

  useAction('page:next', {
    label: 'Next page',
    group: 'Table: Page Navigation',
    defaultBindings: ['arrowright'],
    handler: useCallback(() => {
      if (currentPage < totalPages) {
        setCurrentPage(p => p + 1)
      }
    }, [currentPage, totalPages]),
  })

  useAction('page:first', {
    label: 'First page',
    group: 'Table: Page Navigation',
    defaultBindings: ['meta+arrowleft'],
    handler: useCallback(() => {
      setCurrentPage(1)
    }, []),
  })

  useAction('page:last', {
    label: 'Last page',
    group: 'Table: Page Navigation',
    defaultBindings: ['meta+arrowright'],
    handler: useCallback(() => {
      setCurrentPage(totalPages)
    }, [totalPages]),
  })

  // Page size actions (P prefix or digit then p)
  useAction('pagesize:1-10', {
    label: '10 rows',
    group: 'Table: Page Size',
    defaultBindings: ['P 1', '1 p'],
    handler: useCallback(() => {
      setPageSize(10)
      setCurrentPage(1)
    }, []),
  })

  useAction('pagesize:2-20', {
    label: '20 rows',
    group: 'Table: Page Size',
    defaultBindings: ['P 2', '2 p'],
    handler: useCallback(() => {
      setPageSize(20)
      setCurrentPage(1)
    }, []),
  })

  useAction('pagesize:3-50', {
    label: '50 rows',
    group: 'Table: Page Size',
    defaultBindings: ['P 5', '5 p'],
    handler: useCallback(() => {
      setPageSize(50)
      setCurrentPage(1)
    }, []),
  })

  useAction('pagesize:4-100', {
    label: '100 rows',
    group: 'Table: Page Size',
    defaultBindings: ['P 0', '0 p'],
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
    group: 'Table: Edit',
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
    group: 'Table: Status',
    defaultBindings: ['a'],
    handler: useCallback(() => setSelectedStatus('active'), [setSelectedStatus]),
  })

  useAction('status:pending', {
    label: 'Set pending',
    group: 'Table: Status',
    defaultBindings: ['p'],
    handler: useCallback(() => setSelectedStatus('pending'), [setSelectedStatus]),
  })

  useAction('status:inactive', {
    label: 'Set inactive',
    group: 'Table: Status',
    defaultBindings: ['i'],
    handler: useCallback(() => setSelectedStatus('inactive'), [setSelectedStatus]),
  })

  // Sort actions - paired asc/desc for each column (single keys for instant response)
  useAction('sort:name:asc', {
    label: 'Name ↑',
    group: 'Table: Sort',
    defaultBindings: ['n'],
    handler: sortNameAsc,
  })

  useAction('sort:name:desc', {
    label: 'Name ↓',
    group: 'Table: Sort',
    defaultBindings: ['shift+n'],
    handler: sortNameDesc,
  })

  useAction('sort:status:asc', {
    label: 'Status ↑',
    group: 'Table: Sort',
    defaultBindings: ['s'],
    handler: sortStatusAsc,
  })

  useAction('sort:status:desc', {
    label: 'Status ↓',
    group: 'Table: Sort',
    defaultBindings: ['shift+s'],
    handler: sortStatusDesc,
  })

  useAction('sort:value:asc', {
    label: 'Value ↑',
    group: 'Table: Sort',
    defaultBindings: ['v'],
    handler: sortValueAsc,
  })

  useAction('sort:value:desc', {
    label: 'Value ↓',
    group: 'Table: Sort',
    defaultBindings: ['shift+v'],
    handler: sortValueDesc,
  })

  useAction('sort:clear', {
    label: 'Clear',
    group: 'Table: Sort',
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
      { label: 'Move N', leftAction: 'nav:up-n', rightAction: 'nav:down-n' },
      { label: 'Extend', leftAction: 'nav:extend-up', rightAction: 'nav:extend-down' },
      { label: 'Extend N', leftAction: 'nav:extend-up-n', rightAction: 'nav:extend-down-n' },
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

  return (
    <div className="data-table-app" ref={containerRef}>
      <h1 id="demo">Data Table Demo</h1>
      <p className="hint">
        Press <KbdModal /> for shortcuts, or <KbdOmnibar /> to search rows.
        {selectedIds.size > 1 && <strong> ({selectedIds.size} selected)</strong>}
      </p>

      <table className="data-table" ref={tableRef}>
        <thead>
          <tr>
            <th>Name{getSortIndicator('name')}</th>
            <th>Status{getSortIndicator('status')}</th>
            <th>Value{getSortIndicator('value')}</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, index) => {
            const isCursor = index === hoveredIndex
            const isSelected = selectedIds.has(row.id)
            return (
              <tr
                key={row.id}
                className={`${isCursor ? 'cursor' : ''} ${isSelected ? 'selected' : ''}`}
                onMouseEnter={() => setMouseHoverIndex(index)}
                onMouseLeave={() => setMouseHoverIndex(-1)}
                onClick={(e) => {
                  if (e.shiftKey) {
                    // Shift-click: extend range from anchor to clicked (preserves pinned)
                    setHoveredIndex(index)
                  } else if (e.metaKey || e.ctrlKey) {
                    // Meta/Ctrl-click: toggle if selected, otherwise add to selection
                    if (selectedIds.has(row.id)) {
                      // Deselect: remove from pinned, clear range if it was the cursor
                      const newPinned = new Set(selectedIds)
                      newPinned.delete(row.id)
                      setPinnedIds(newPinned)
                      setHoveredIndex(-1)
                      setRangeAnchor(-1)
                    } else {
                      // Add: pin current selection, start new range at clicked
                      setPinnedIds(new Set(selectedIds))
                      setRangeAnchor(index)
                      setHoveredIndex(index)
                    }
                  } else {
                    // Normal click: single select (clears pinned)
                    setPinnedIds(new Set())
                    setRangeAnchor(index)
                    setHoveredIndex(index)
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
          'Table: Sort',
          'Table: Row Navigation',
          'Table: Page Navigation',
          'Table: Page Size',
          'Table: Selection',
          'Table: Status',
          'Table: Edit',
          'Global',
          'Navigation',
        ]}
        groupRenderers={{
          'Table: Sort': SortRenderer,
          'Table: Row Navigation': RowNavRenderer,
          'Table: Page Navigation': PageNavRenderer,
        }}
        TooltipComponent={MuiTooltip}
      />
    </div>
  )
}

export function TableDemo() {
  return <DataTable />
}
