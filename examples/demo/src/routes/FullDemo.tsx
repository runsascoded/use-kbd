import { useCallback, useState } from 'react'
import {
  HotkeysProvider,
  ShortcutsModal,
  useAction,
  useHotkeysContext,
} from 'use-kbd'
import 'use-kbd/styles.css'

interface Todo {
  id: number
  text: string
  done: boolean
  dueDate?: Date
}

function TodoList() {
  const ctx = useHotkeysContext()

  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: 'Learn use-kbd', done: false },
    { id: 2, text: 'Build something cool', done: false },
    { id: 3, text: 'Share with the world', done: false },
  ])
  const [selectedId, setSelectedId] = useState<number | null>(1)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [nextId, setNextId] = useState(4)

  const selectedIndex = todos.findIndex(t => t.id === selectedId)

  // Register actions
  useAction('new', {
    label: 'New todo',
    group: 'Todo',
    defaultBindings: ['n'],
    handler: useCallback(() => {
      const newTodo = { id: nextId, text: 'New todo', done: false }
      setTodos(prev => [...prev, newTodo])
      setSelectedId(nextId)
      setNextId(prev => prev + 1)
      setIsEditing(true)
      setEditText('New todo')
    }, [nextId]),
  })

  useAction('edit', {
    label: 'Edit',
    group: 'Todo',
    defaultBindings: ['e'],
    handler: useCallback(() => {
      const todo = todos.find(t => t.id === selectedId)
      if (todo) {
        setIsEditing(true)
        setEditText(todo.text)
      }
    }, [todos, selectedId]),
  })

  useAction('delete', {
    label: 'Delete',
    group: 'Todo',
    defaultBindings: ['d'],
    handler: useCallback(() => {
      if (selectedId) {
        setTodos(prev => prev.filter(t => t.id !== selectedId))
        const newTodos = todos.filter(t => t.id !== selectedId)
        setSelectedId(newTodos[selectedIndex]?.id ?? newTodos[selectedIndex - 1]?.id ?? null)
      }
    }, [selectedId, todos, selectedIndex]),
  })

  useAction('toggle', {
    label: 'Toggle done',
    group: 'Todo',
    defaultBindings: ['Enter'],
    handler: useCallback(() => {
      if (selectedId) {
        setTodos(prev => prev.map(t =>
          t.id === selectedId ? { ...t, done: !t.done } : t
        ))
      }
    }, [selectedId]),
  })

  useAction('next', {
    label: 'Next',
    group: 'Navigation',
    defaultBindings: ['j'],
    handler: useCallback(() => {
      if (selectedIndex < todos.length - 1) {
        setSelectedId(todos[selectedIndex + 1].id)
      }
    }, [todos, selectedIndex]),
  })

  useAction('prev', {
    label: 'Previous',
    group: 'Navigation',
    defaultBindings: ['k'],
    handler: useCallback(() => {
      if (selectedIndex > 0) {
        setSelectedId(todos[selectedIndex - 1].id)
      }
    }, [todos, selectedIndex]),
  })

  useAction('help', {
    label: 'Show shortcuts',
    group: 'General',
    defaultBindings: ['?'],
    handler: () => ctx.toggleModal(),
  })

  // Due date sequences
  useAction('due:1d', {
    label: 'Due in 1 day',
    group: 'Due Date',
    defaultBindings: ['1 d'],
    handler: useCallback(() => {
      if (selectedId) {
        const date = new Date()
        date.setDate(date.getDate() + 1)
        setTodos(prev => prev.map(t =>
          t.id === selectedId ? { ...t, dueDate: date } : t
        ))
      }
    }, [selectedId]),
  })

  useAction('due:1w', {
    label: 'Due in 1 week',
    group: 'Due Date',
    defaultBindings: ['1 w'],
    handler: useCallback(() => {
      if (selectedId) {
        const date = new Date()
        date.setDate(date.getDate() + 7)
        setTodos(prev => prev.map(t =>
          t.id === selectedId ? { ...t, dueDate: date } : t
        ))
      }
    }, [selectedId]),
  })

  useAction('due:2w', {
    label: 'Due in 2 weeks',
    group: 'Due Date',
    defaultBindings: ['2 w'],
    handler: useCallback(() => {
      if (selectedId) {
        const date = new Date()
        date.setDate(date.getDate() + 14)
        setTodos(prev => prev.map(t =>
          t.id === selectedId ? { ...t, dueDate: date } : t
        ))
      }
    }, [selectedId]),
  })

  useAction('due:1m', {
    label: 'Due in 1 month',
    group: 'Due Date',
    defaultBindings: ['1 m'],
    handler: useCallback(() => {
      if (selectedId) {
        const date = new Date()
        date.setMonth(date.getMonth() + 1)
        setTodos(prev => prev.map(t =>
          t.id === selectedId ? { ...t, dueDate: date } : t
        ))
      }
    }, [selectedId]),
  })

  const handleEditSubmit = () => {
    if (selectedId && editText.trim()) {
      setTodos(prev => prev.map(t =>
        t.id === selectedId ? { ...t, text: editText.trim() } : t
      ))
    }
    setIsEditing(false)
    setEditText('')
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const handleToggle = useCallback(() => {
    if (selectedId) {
      setTodos(prev => prev.map(t =>
        t.id === selectedId ? { ...t, done: !t.done } : t
      ))
    }
  }, [selectedId])

  return (
    <div className="todo-app">
      <h1>Full Demo - Todo List with Sequences</h1>
      <p className="hint">Press <kbd>?</kbd> to see keyboard shortcuts. Try sequences like <kbd>2 W</kbd> for due dates!</p>

      <ul className="todo-list">
        {todos.map(todo => (
          <li
            key={todo.id}
            className={`todo-item ${todo.id === selectedId ? 'selected' : ''} ${todo.done ? 'done' : ''}`}
            onClick={() => setSelectedId(todo.id)}
          >
            <span className="checkbox" onClick={(e) => { e.stopPropagation(); handleToggle() }}>
              {todo.done ? '✓' : '○'}
            </span>
            {isEditing && todo.id === selectedId ? (
              <input
                type="text"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={handleEditSubmit}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleEditSubmit()
                  if (e.key === 'Escape') { setIsEditing(false); setEditText('') }
                }}
                autoFocus
              />
            ) : (
              <span className="text">{todo.text}</span>
            )}
            {todo.dueDate && (
              <span className="due-date">Due: {formatDate(todo.dueDate)}</span>
            )}
          </li>
        ))}
      </ul>

      <ShortcutsModal editable />
    </div>
  )
}

export function FullDemo() {
  return (
    <HotkeysProvider
      config={{
        storageKey: 'use-kbd-demo-full',
        sequenceTimeout: 1000,
      }}
    >
      <TodoList />
    </HotkeysProvider>
  )
}
