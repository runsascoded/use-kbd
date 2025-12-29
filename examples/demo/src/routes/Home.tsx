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
          <h2><Link to="/simple">Simple Demo</Link></h2>
          <p>
            Simplified mode with single-key shortcuts (no sequences).
            Uses <code>sequenceTimeout: 0</code> for instant response.
          </p>
          <ul>
            <li>One key per action</li>
            <li>Immediate execution on keypress</li>
            <li>No timeout waiting</li>
          </ul>
        </section>

        <section>
          <h2><Link to="/routes">Route-based Demo</Link></h2>
          <p>
            Demonstrates different hotkeys on different routes.
            Navigation with sub-routes, each with their own action set.
          </p>
          <ul>
            <li>Route-specific actions</li>
            <li>Shared global actions</li>
            <li>Dynamic action registration</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
