import { Link } from 'react-router-dom'

export function Home() {
  return (
    <div className="home">
      <h1>use-kbd Demo</h1>
      <p>Keyboard-first UX for React: action registration, shortcuts modal, omnibar, and sequences.</p>

      <div className="demos">
        <section>
          <h2><Link to="/full">Full Demo</Link></h2>
          <p>
            Full-featured todo list with key sequences (e.g., "2 w" for "2 weeks"),
            customizable timeout, multiple keys per action, and editable shortcuts modal.
          </p>
          <ul>
            <li>Press <kbd>?</kbd> to open shortcuts modal</li>
            <li>Press <kbd>Meta+K</kbd> to open omnibar</li>
            <li>Supports key sequences like <kbd>2 W</kbd></li>
          </ul>
        </section>

        <section>
          <h2><Link to="/simple">Data Table Demo</Link></h2>
          <p>
            Data table with sortable columns and keyboard navigation.
            Uses <code>sequenceTimeout: 0</code> and two-column shortcut rendering.
          </p>
          <ul>
            <li>Instant response (no sequences)</li>
            <li>Two-column table layout for shortcuts</li>
            <li>Paired actions (sort asc/desc, nav up/down)</li>
            <li>Modifier key rendering (<kbd>⌘↑</kbd> <kbd>⌥↓</kbd>)</li>
          </ul>
        </section>

        <section>
          <h2><Link to="/routes">Route-based Demo</Link></h2>
          <p>
            Demonstrates different hotkeys on different routes.
            Uses <code>sequenceTimeout: Infinity</code> (no auto-submit).
          </p>
          <ul>
            <li>Route-specific actions</li>
            <li>Shared global actions</li>
            <li>Manual sequence commit (Enter/Tab)</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
