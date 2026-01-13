import type { ScreenshotsMap } from 'scrns'

const demos = ['table', 'canvas', 'calendar'] as const
const themes = ['light', 'dark'] as const

const screens: ScreenshotsMap = {}

// Generate light + dark screenshots for each demo
// scrollTo: '#demo' scrolls to the h1 title, scrollOffset: 16 adds padding above
for (const demo of demos) {
  for (const theme of themes) {
    const name = `${demo}-${theme}`
    screens[name] = {
      path: `public/screenshots/${name}.png`,
      query: `${demo}?theme=${theme}`,
      width: 800,
      height: 500,
      selector: '#demo',
      scrollTo: '#demo',
      scrollOffset: 16,
      preScreenshotSleep: 500,
    }
  }
}

export default screens
