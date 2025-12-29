import { useCallback, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { HotkeysProvider, ShortcutsModal, useHotkeysContext, useAction } from 'use-kbd'
import 'use-kbd/styles.css'

function GlobalNav() {
  const location = useLocation()

  return (
    <nav className="sub-nav">
      <Link to="/routes" className={location.pathname === '/routes' ? 'active' : ''}>Home</Link>
      <Link to="/routes/inbox" className={location.pathname === '/routes/inbox' ? 'active' : ''}>Inbox</Link>
      <Link to="/routes/projects" className={location.pathname === '/routes/projects' ? 'active' : ''}>Projects</Link>
    </nav>
  )
}

function RoutesHome() {
  const ctx = useHotkeysContext()
  const navigate = useNavigate()

  useAction('help', {
    label: 'Show shortcuts',
    group: 'Global',
    defaultBindings: ['?'],
    handler: () => ctx.toggleModal(),
  })

  useAction('goto:home', {
    label: 'Go to Home',
    group: 'Navigation',
    defaultBindings: ['g h'],
    handler: () => {}, // Already here
  })

  useAction('goto:inbox', {
    label: 'Go to Inbox',
    group: 'Navigation',
    defaultBindings: ['g i'],
    handler: useCallback(() => navigate('/routes/inbox'), [navigate]),
  })

  useAction('goto:projects', {
    label: 'Go to Projects',
    group: 'Navigation',
    defaultBindings: ['g p'],
    handler: useCallback(() => navigate('/routes/projects'), [navigate]),
  })

  useAction('cancel', {
    label: 'Cancel / Close',
    group: 'Global',
    defaultBindings: ['Escape'],
    handler: () => ctx.closeModal(),
  })

  return (
    <div className="route-demo">
      <h2>Routes Demo - Home</h2>
      <p>This demonstrates route-specific hotkeys. Global hotkeys work everywhere:</p>
      <ul>
        <li><kbd>?</kbd> - Show shortcuts</li>
        <li><kbd>G H</kbd> - Go to Home</li>
        <li><kbd>G I</kbd> - Go to Inbox</li>
        <li><kbd>G P</kbd> - Go to Projects</li>
      </ul>
      <p>Navigate to Inbox or Projects to see route-specific hotkeys.</p>

      <ShortcutsModal editable />
    </div>
  )
}

function InboxRoute() {
  const ctx = useHotkeysContext()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    { id: 1, from: 'Alice', subject: 'Meeting tomorrow', read: false, archived: false },
    { id: 2, from: 'Bob', subject: 'Code review needed', read: true, archived: false },
    { id: 3, from: 'Carol', subject: 'Lunch plans?', read: false, archived: false },
  ])
  const [selectedId, setSelectedId] = useState(1)

  // Global actions
  useAction('help', {
    label: 'Show shortcuts',
    group: 'Global',
    defaultBindings: ['?'],
    handler: () => ctx.toggleModal(),
  })

  useAction('cancel', {
    label: 'Cancel / Close',
    group: 'Global',
    defaultBindings: ['Escape'],
    handler: () => ctx.closeModal(),
  })

  useAction('goto:home', {
    label: 'Go to Home',
    group: 'Navigation',
    defaultBindings: ['g h'],
    handler: useCallback(() => navigate('/routes'), [navigate]),
  })

  useAction('goto:inbox', {
    label: 'Go to Inbox',
    group: 'Navigation',
    defaultBindings: ['g i'],
    handler: () => {}, // Already here
  })

  useAction('goto:projects', {
    label: 'Go to Projects',
    group: 'Navigation',
    defaultBindings: ['g p'],
    handler: useCallback(() => navigate('/routes/projects'), [navigate]),
  })

  // Inbox-specific actions
  useAction('inbox:archive', {
    label: 'Archive',
    group: 'Inbox',
    defaultBindings: ['a'],
    handler: useCallback(() => {
      setMessages(prev => prev.map(m =>
        m.id === selectedId ? { ...m, archived: true } : m
      ))
    }, [selectedId]),
  })

  useAction('inbox:snooze', {
    label: 'Snooze',
    group: 'Inbox',
    defaultBindings: ['s'],
    handler: useCallback(() => {
      console.log('Snoozed message', selectedId)
    }, [selectedId]),
  })

  useAction('inbox:reply', {
    label: 'Reply',
    group: 'Inbox',
    defaultBindings: ['r'],
    handler: useCallback(() => {
      console.log('Replying to message', selectedId)
    }, [selectedId]),
  })

  useAction('inbox:mark-read', {
    label: 'Toggle read',
    group: 'Inbox',
    defaultBindings: ['m'],
    handler: useCallback(() => {
      setMessages(prev => prev.map(m =>
        m.id === selectedId ? { ...m, read: !m.read } : m
      ))
    }, [selectedId]),
  })

  const visibleMessages = messages.filter(m => !m.archived)

  return (
    <div className="route-demo">
      <h2>Routes Demo - Inbox</h2>
      <p className="hint">Inbox-specific hotkeys: <kbd>A</kbd>rchive, <kbd>S</kbd>nooze, <kbd>R</kbd>eply, <kbd>M</kbd>ark read</p>

      <ul className="message-list">
        {visibleMessages.map(msg => (
          <li
            key={msg.id}
            className={`message-item ${msg.id === selectedId ? 'selected' : ''} ${msg.read ? 'read' : 'unread'}`}
            onClick={() => setSelectedId(msg.id)}
          >
            <span className="from">{msg.from}</span>
            <span className="subject">{msg.subject}</span>
            {!msg.read && <span className="unread-badge">●</span>}
          </li>
        ))}
      </ul>

      <ShortcutsModal editable />
    </div>
  )
}

function ProjectsRoute() {
  const ctx = useHotkeysContext()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([
    { id: 1, name: 'use-kbd', status: 'active' },
    { id: 2, name: 'Other project', status: 'active' },
    { id: 3, name: 'Archived project', status: 'archived' },
  ])
  const [selectedId, setSelectedId] = useState<number | null>(1)
  const [nextId, setNextId] = useState(4)

  // Global actions
  useAction('help', {
    label: 'Show shortcuts',
    group: 'Global',
    defaultBindings: ['?'],
    handler: () => ctx.toggleModal(),
  })

  useAction('cancel', {
    label: 'Cancel / Close',
    group: 'Global',
    defaultBindings: ['Escape'],
    handler: () => ctx.closeModal(),
  })

  useAction('goto:home', {
    label: 'Go to Home',
    group: 'Navigation',
    defaultBindings: ['g h'],
    handler: useCallback(() => navigate('/routes'), [navigate]),
  })

  useAction('goto:inbox', {
    label: 'Go to Inbox',
    group: 'Navigation',
    defaultBindings: ['g i'],
    handler: useCallback(() => navigate('/routes/inbox'), [navigate]),
  })

  useAction('goto:projects', {
    label: 'Go to Projects',
    group: 'Navigation',
    defaultBindings: ['g p'],
    handler: () => {}, // Already here
  })

  // Projects-specific actions
  useAction('project:new', {
    label: 'New project',
    group: 'Projects',
    defaultBindings: ['n'],
    handler: useCallback(() => {
      const newProject = { id: nextId, name: `Project ${nextId}`, status: 'active' as const }
      setProjects(prev => [...prev, newProject])
      setSelectedId(nextId)
      setNextId(prev => prev + 1)
    }, [nextId]),
  })

  useAction('project:edit', {
    label: 'Edit project',
    group: 'Projects',
    defaultBindings: ['e'],
    handler: useCallback(() => {
      console.log('Editing project', selectedId)
    }, [selectedId]),
  })

  useAction('project:delete', {
    label: 'Delete project',
    group: 'Projects',
    defaultBindings: ['d'],
    handler: useCallback(() => {
      setProjects(prev => prev.filter(p => p.id !== selectedId))
      const remaining = projects.filter(p => p.id !== selectedId)
      setSelectedId(remaining[0]?.id ?? null)
    }, [selectedId, projects]),
  })

  useAction('project:view', {
    label: 'View project',
    group: 'Projects',
    defaultBindings: ['v'],
    handler: useCallback(() => {
      console.log('Viewing project', selectedId)
    }, [selectedId]),
  })

  return (
    <div className="route-demo">
      <h2>Routes Demo - Projects</h2>
      <p className="hint">Project-specific hotkeys: <kbd>N</kbd>ew, <kbd>E</kbd>dit, <kbd>D</kbd>elete, <kbd>V</kbd>iew</p>

      <ul className="project-list">
        {projects.map(project => (
          <li
            key={project.id}
            className={`project-item ${project.id === selectedId ? 'selected' : ''} ${project.status}`}
            onClick={() => setSelectedId(project.id)}
          >
            <span className="name">{project.name}</span>
            <span className="status">{project.status}</span>
          </li>
        ))}
      </ul>

      <ShortcutsModal editable />
    </div>
  )
}

function RoutesContent() {
  return (
    <div className="routes-demo">
      <GlobalNav />
      <Routes>
        <Route path="/" element={<RoutesHome />} />
        <Route path="/inbox" element={<InboxRoute />} />
        <Route path="/projects" element={<ProjectsRoute />} />
      </Routes>
    </div>
  )
}

export function RoutesDemo() {
  return (
    <HotkeysProvider
      config={{
        storageKey: 'use-kbd-demo-routes',
        sequenceTimeout: 1000,
      }}
    >
      <RoutesContent />
    </HotkeysProvider>
  )
}
