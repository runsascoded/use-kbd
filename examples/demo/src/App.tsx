import { Link, Route, Routes } from 'react-router-dom'
import { Home } from './routes/Home'
import { FullDemo } from './routes/FullDemo'
import { SimpleDemo } from './routes/SimpleDemo'
import { RoutesDemo } from './routes/RoutesDemo'

export default function App() {
  return (
    <div className="app">
      <nav className="nav">
        <Link to="/">Home</Link>
        <Link to="/full">Full (Sequences)</Link>
        <Link to="/simple">Simple (Single Key)</Link>
        <Link to="/routes">Route-based</Link>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/full" element={<FullDemo />} />
          <Route path="/simple" element={<SimpleDemo />} />
          <Route path="/routes/*" element={<RoutesDemo />} />
        </Routes>
      </main>
    </div>
  )
}
