import createDebug from 'debug'

export const dbg = {
  hotkeys:   createDebug('use-kbd:hotkeys'),
  recording: createDebug('use-kbd:recording'),
  registry:  createDebug('use-kbd:registry'),
  modes:     createDebug('use-kbd:modes'),
}
