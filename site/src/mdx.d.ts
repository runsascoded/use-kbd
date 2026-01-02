declare module '*.mdx' {
  import type { ComponentType, ReactNode } from 'react'

  interface MDXComponents {
    [key: string]: ComponentType<{ children?: ReactNode }>
  }

  interface MDXProps {
    components?: MDXComponents
  }

  const MDXComponent: ComponentType<MDXProps>
  export default MDXComponent
}
