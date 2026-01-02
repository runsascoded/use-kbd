import type { ReactElement, ReactNode } from 'react'
import { Children, isValidElement, useCallback, useEffect, useState } from 'react'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import { transformerNotationDiff, transformerMetaHighlight } from '@shikijs/transformers'
import { useTheme } from '../contexts/ThemeContext'

interface CodeBlockProps {
  code: string
  lang?: string
  /** Line numbers or ranges to highlight, e.g. "1-2,6-8" */
  highlightLines?: string
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5.5" y="5.5" width="8" height="9" rx="1" />
      <path d="M3.5 10.5v-8a1 1 0 0 1 1-1h6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8.5l3.5 3.5 6.5-7" />
    </svg>
  )
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <button
      className="code-copy-btn"
      onClick={handleCopy}
      title="Copy to clipboard"
      aria-label="Copy to clipboard"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

// Lazy-loaded highlighter singleton
let highlighterPromise: Promise<HighlighterCore> | null = null

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [
        import('shiki/themes/github-dark.mjs'),
        import('shiki/themes/github-light.mjs'),
      ],
      langs: [
        import('shiki/langs/tsx.mjs'),
        import('shiki/langs/bash.mjs'),
      ],
      engine: createOnigurumaEngine(import('shiki/wasm')),
    })
  }
  return highlighterPromise
}

export function CodeBlock({ code, lang = 'tsx', highlightLines }: CodeBlockProps) {
  const { resolvedTheme } = useTheme()
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    getHighlighter().then(highlighter => {
      const result = highlighter.codeToHtml(code.trim(), {
        lang,
        theme: resolvedTheme === 'dark' ? 'github-dark' : 'github-light',
        meta: highlightLines ? { __raw: `{${highlightLines}}` } : undefined,
        transformers: [transformerNotationDiff(), transformerMetaHighlight()],
      })
      setHtml(result)
    })
  }, [code, lang, resolvedTheme, highlightLines])

  const trimmedCode = code.trim()

  if (!html) {
    return (
      <div className="code-block-wrapper">
        <CopyButton code={trimmedCode} />
        <pre className="code-block-loading">
          <code>{trimmedCode}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="code-block-wrapper">
      <CopyButton code={trimmedCode} />
      <div
        className="code-block"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

interface CodeElementProps {
  className?: string
  children?: string
}

/**
 * Pre component for MDX - intercepts <pre><code className="language-xxx">
 * and renders with CodeBlock for syntax highlighting + copy button.
 */
export function Pre({ children }: { children?: ReactNode }) {
  if (!children) return <pre />

  // MDX renders: <pre><code className="language-xxx">content</code></pre>
  const codeElement = Children.toArray(children).find(
    (child): child is ReactElement<CodeElementProps> =>
      isValidElement(child) && child.type === 'code'
  )

  if (!codeElement) {
    // Fallback for non-code pre blocks
    return <pre>{children}</pre>
  }

  const className = codeElement.props.className || ''
  const lang = className.replace(/^language-/, '') || 'text'
  const code = codeElement.props.children || ''

  return <CodeBlock code={code} lang={lang} />
}

/** MDX component overrides for code blocks with copy button */
export const mdxComponents = {
  pre: Pre,
}
