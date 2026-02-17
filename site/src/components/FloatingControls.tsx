import { useLocation } from 'react-router-dom'
import { FaGithub } from 'react-icons/fa'
import { MdBrightnessAuto, MdLightMode, MdDarkMode } from 'react-icons/md'
import { SpeedDial } from 'use-kbd'
import type { SpeedDialAction } from 'use-kbd'
import { useTheme } from '../contexts/ThemeContext'

const GITHUB_BASE = 'https://github.com/runsascoded/use-kbd/tree/main/site/src/routes'

const ROUTE_FILES: Record<string, string> = {
  '/': 'Home.tsx',
  '/table': 'TableDemo.tsx',
  '/canvas': 'CanvasDemo.tsx',
  '/calendar': 'CalendarDemo.tsx',
}

function ThemeIcon({ theme }: { theme: string }) {
  switch (theme) {
    case 'light': return <MdLightMode />
    case 'dark': return <MdDarkMode />
    default: return <MdBrightnessAuto />
  }
}

export function FloatingControls() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const location = useLocation()

  const file = ROUTE_FILES[location.pathname] || 'Home.tsx'
  const githubUrl = `${GITHUB_BASE}/${file}`

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const themeLabel = theme === 'system' ? `System (${resolvedTheme})` : theme === 'light' ? 'Light' : 'Dark'

  const actions: SpeedDialAction[] = [
    {
      key: 'github',
      label: 'View source on GitHub',
      icon: <FaGithub />,
      href: githubUrl,
    },
    {
      key: 'theme',
      label: `Theme: ${themeLabel}`,
      icon: <ThemeIcon theme={theme} />,
      onClick: cycleTheme,
    },
  ]

  return <SpeedDial actions={actions} />
}
