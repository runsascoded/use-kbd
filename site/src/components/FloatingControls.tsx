import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { FaGithub, FaKeyboard, FaSearch } from 'react-icons/fa'
import { MdBrightnessAuto, MdLightMode, MdDarkMode } from 'react-icons/md'
import Tooltip from '@mui/material/Tooltip'
import { useHotkeysContext } from 'use-kbd'
import { useTheme } from '../contexts/ThemeContext'

const GITHUB_BASE = 'https://github.com/runsascoded/use-kbd/tree/main/site/src/routes'

const ROUTE_FILES: Record<string, string> = {
  '/': 'Home.tsx',
  '/table': 'TableDemo.tsx',
  '/canvas': 'CanvasDemo.tsx',
  '/calendar': 'CalendarDemo.tsx',
}

export function FloatingControls() {
  const ctx = useHotkeysContext()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const location = useLocation()
  const [isVisible, setIsVisible] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [themeChangeKey, setThemeChangeKey] = useState(0)
  const lastScrollY = useRef(0)
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevTheme = useRef(theme)
  const themeAnimTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect touch-only devices (no hover capability)
  // Use both media query AND screen width as fallback since DevTools doesn't always simulate (hover: hover) correctly
  const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth <= 768
  const isTouchDevice = !canHover || isSmallScreen

  // Detect theme changes and show controls with animation
  useEffect(() => {
    if (theme !== prevTheme.current) {
      prevTheme.current = theme
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show controls on theme change
      setIsVisible(true)
      // Increment key to force animation restart even if already visible
      setThemeChangeKey(k => k + 1)

      // Clear any existing timeouts
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current)
      }
      if (themeAnimTimeout.current) {
        clearTimeout(themeAnimTimeout.current)
      }

      // Hide after delay
      hideTimeout.current = setTimeout(() => {
        setIsVisible(false)
      }, 1500)

      // Reset animation key after animation completes
      themeAnimTimeout.current = setTimeout(() => {
        setThemeChangeKey(0)
      }, 500)
    }
  }, [theme])

  useEffect(() => {
    // On touch devices, always show unless explicitly hidden
    if (isTouchDevice) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: ensure visibility on touch
      setIsVisible(true)
      return
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollingDown = currentScrollY > lastScrollY.current
      const nearBottom = (window.innerHeight + currentScrollY) >= (document.body.scrollHeight - 100)

      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current)
        hideTimeout.current = null
      }

      if ((scrollingDown && currentScrollY > 30) || nearBottom) {
        setIsVisible(true)
        hideTimeout.current = setTimeout(() => setIsVisible(false), 2500)
      } else if (!scrollingDown) {
        setIsVisible(false)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (hideTimeout.current) clearTimeout(hideTimeout.current)
    }
  }, [isTouchDevice])

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <MdLightMode />
      case 'dark': return <MdDarkMode />
      case 'system': return <MdBrightnessAuto />
    }
  }

  const getThemeLabel = () => {
    switch (theme) {
      case 'light': return 'Light'
      case 'dark': return 'Dark'
      case 'system': return `System (${resolvedTheme})`
    }
  }

  // On touch devices, always show
  // On desktop, show on hover or after scroll
  const showControls = isTouchDevice || isVisible || isHovering
  const file = ROUTE_FILES[location.pathname] || 'Home.tsx'
  const githubUrl = `${GITHUB_BASE}/${file}`

  return (
    <div
      className="floating-controls-container"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className={`floating-controls ${showControls ? 'visible' : ''}`}>
        <Tooltip title="View source on GitHub" arrow placement="top">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="floating-btn github-link"
            aria-label="View source on GitHub"
          >
            <FaGithub />
          </a>
        </Tooltip>
        {canHover ? (
          <Tooltip title="Keyboard shortcuts (?)" arrow placement="top">
            <button
              className="floating-btn shortcuts-btn"
              onClick={() => ctx.openModal()}
              aria-label="Show keyboard shortcuts"
            >
              <FaKeyboard />
            </button>
          </Tooltip>
        ) : (
          <Tooltip title="Search commands" arrow placement="top">
            <button
              className="floating-btn search-btn"
              onClick={() => ctx.openOmnibar()}
              aria-label="Open command palette"
            >
              <FaSearch />
            </button>
          </Tooltip>
        )}
        <Tooltip title={`Theme: ${getThemeLabel()}`} arrow placement="top">
          <button
            key={themeChangeKey}
            className={`floating-btn theme-btn ${themeChangeKey > 0 ? 'theme-changed' : ''}`}
            onClick={cycleTheme}
            aria-label={`Current theme: ${getThemeLabel()}. Click to cycle themes.`}
          >
            {getThemeIcon()}
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
