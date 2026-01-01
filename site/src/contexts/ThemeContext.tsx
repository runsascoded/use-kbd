import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useUrlParam } from '@rdub/use-url-params'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'use-kbd-demo-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// URL param only supports light/dark for screenshots, not system
type UrlTheme = 'light' | 'dark' | undefined
const urlThemeParam = {
  encode: (v: UrlTheme) => v,
  decode: (s: string | undefined): UrlTheme => {
    if (s === 'light' || s === 'dark') return s
    return undefined
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // URL param can force theme (for screenshots)
  const [urlTheme] = useUrlParam('theme', urlThemeParam)

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    if (urlTheme === 'light' || urlTheme === 'dark') return urlTheme
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored || 'system'
  })

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    theme === 'system' ? getSystemTheme() : theme
  )

  // Update resolved theme when theme changes or system preference changes
  useEffect(() => {
    const updateResolved = () => {
      const resolved = theme === 'system' ? getSystemTheme() : theme
      setResolvedTheme(resolved)
      document.documentElement.setAttribute('data-theme', resolved)
    }

    updateResolved()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => updateResolved()
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
