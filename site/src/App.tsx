import { Route, Routes, useLocation } from 'react-router-dom'
import {
  HotkeysProvider,
  LookupModal,
  Omnibar,
  SequenceModal,
  useAction,
} from 'use-kbd'
import 'use-kbd/styles.css'
import { ActionLink } from './components/ActionLink'
import { FloatingControls } from './components/FloatingControls'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { Home } from './routes/Home'
import { TableDemo } from './routes/TableDemo'
import { CanvasDemo } from './routes/CanvasDemo'
import { CalendarDemo } from './routes/CalendarDemo'

function AppNav() {
  const location = useLocation()

  return (
    <nav className="nav">
      <ActionLink
        to="/"
        className={location.pathname === '/' ? 'active' : ''}
        label="Home"
        group="Navigation"
        defaultBinding="g h"
      >
        Home
      </ActionLink>
      <span className="nav-separator">Demos:</span>
      <ActionLink
        to="/table"
        className={location.pathname === '/table' ? 'active' : ''}
        label="Data Table"
        group="Navigation"
        keywords={['grid', 'rows', 'sort']}
        defaultBinding="g t"
      >
        Table
      </ActionLink>
      <ActionLink
        to="/canvas"
        className={location.pathname === '/canvas' ? 'active' : ''}
        label="Canvas"
        group="Navigation"
        keywords={['draw', 'paint', 'sketch']}
        defaultBinding="g c"
      >
        Canvas
      </ActionLink>
      <ActionLink
        to="/calendar"
        className={location.pathname === '/calendar' ? 'active' : ''}
        label="Calendar"
        group="Navigation"
        keywords={['events', 'schedule', 'dates']}
        defaultBinding="g a"
      >
        Calendar
      </ActionLink>
    </nav>
  )
}

function GlobalActions() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  // Note: Show shortcuts, Command palette, and Key lookup are now
  // registered by their respective components (ShortcutsModal, Omnibar, LookupModal)
  useAction('global:theme', {
    label: 'Cycle theme',
    group: 'Global',
    defaultBindings: ['T'],
    handler: cycleTheme,
  })

  return null
}

function AppContent() {
  const location = useLocation()
  // Extract route name for route-specific CSS scoping (e.g., "app route-calendar")
  const routeName = location.pathname === '/' ? 'home' : location.pathname.slice(1)

  return (
    <div className={`app route-${routeName}`}>
      <AppNav />
      <GlobalActions />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/table" element={<TableDemo />} />
          <Route path="/canvas" element={<CanvasDemo />} />
          <Route path="/calendar" element={<CalendarDemo />} />
        </Routes>
      </main>
      <Omnibar />
      <SequenceModal />
      <LookupModal />
      <FloatingControls />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <HotkeysProvider
        config={{
          storageKey: 'use-kbd-demo',
          sequenceTimeout: Infinity,
        }}
      >
        <AppContent />
      </HotkeysProvider>
    </ThemeProvider>
  )
}
