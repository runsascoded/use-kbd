import { CodeBlock } from '../components/CodeBlock'

const quickStartCode = `import { HotkeysProvider, ShortcutsModal, Omnibar, LookupModal, SequenceModal, useAction } from 'use-kbd'
import 'use-kbd/styles.css'

function App() {
  return (
    <HotkeysProvider>
      <Dashboard />
      <ShortcutsModal />  {/* "?" modal: view/edit key-bindings */}
      <Omnibar />         {/* "⌘K" omnibar: search for and execute actions */}
      <LookupModal />     {/* "⌘⇧K": lookup actions by key-bindings */}
      <SequenceModal />   {/* Inline display for key-sequences in progress */}
    </HotkeysProvider>
  )
}

function Dashboard() {
  const { save } = useDocument()  // Function to expose via hotkeys / omnibar

  // Wrap function as "action", with keybinding(s) and omnibar keywords
  useAction('doc:save', {
    label: 'Save document',
    group: 'Document',
    defaultBindings: ['meta+s'],
    handler: save,
  })

  return <Editor />
}`

const highlightLines = '1-2,6,8-12,18-25'

export function QuickStartCode() {
  return <CodeBlock code={quickStartCode} highlightLines={highlightLines} />
}
