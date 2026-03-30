function makeDebug(namespace: string) {
  return (...args: unknown[]) => {
    try {
      const pattern = localStorage.getItem('debug') || ''
      if (!pattern) return
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      if (regex.test(namespace)) {
        console.log(`%c${namespace}`, 'color: #888', ...args)
      }
    } catch { /* ignore in non-browser environments */ }
  }
}

export const dbg = {
  hotkeys:   makeDebug('use-kbd:hotkeys'),
  recording: makeDebug('use-kbd:recording'),
  registry:  makeDebug('use-kbd:registry'),
  modes:     makeDebug('use-kbd:modes'),
}
