import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FaGithub } from 'react-icons/fa'

const GITHUB_BASE = 'https://github.com/runsascoded/use-kbd/blob/main/examples/demo/src/routes'

interface DemoTitleProps {
  to: string
  source: string
  children: ReactNode
}

export function DemoTitle({ to, source, children }: DemoTitleProps) {
  return (
    <h3 className="demo-title">
      <Link to={to}>{children}</Link>
      <a
        href={`${GITHUB_BASE}/${source}`}
        target="_blank"
        rel="noopener noreferrer"
        className="demo-github-link"
        title="View source on GitHub"
      >
        <FaGithub />
      </a>
    </h3>
  )
}
