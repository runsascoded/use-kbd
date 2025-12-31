import type { ReactNode } from 'react'

export function SourceLink({ children }: { children: ReactNode }) {
  return <p className="source-link">{children}</p>
}
