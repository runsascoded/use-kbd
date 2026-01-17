import { useCallback, useMemo, useState } from 'react'
import { KbdModal, ShortcutsModal, useAction } from 'use-kbd'
import 'use-kbd/styles.css'

type ViewMode = 'month' | 'week' | 'day'

interface CalendarEvent {
  id: number
  title: string
  date: Date
  hour?: number  // 0-23, undefined for all-day events
  duration?: number  // hours
  color: string
  recurring?: 'weekly'
}

const EVENT_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#a855f7']

// Generate sample events
function generateSampleEvents(): CalendarEvent[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const events: CalendarEvent[] = []
  let id = 1

  // Weekly recurring events
  const weeklyEvents = [
    { title: 'Team Standup', hour: 9, duration: 0.5, color: '#3b82f6', dayOfWeek: 1 },  // Monday
    { title: 'Team Standup', hour: 9, duration: 0.5, color: '#3b82f6', dayOfWeek: 3 },  // Wednesday
    { title: 'Team Standup', hour: 9, duration: 0.5, color: '#3b82f6', dayOfWeek: 5 },  // Friday
    { title: 'Sprint Planning', hour: 10, duration: 1, color: '#22c55e', dayOfWeek: 1 },  // Monday
    { title: '1:1 with Manager', hour: 14, duration: 0.5, color: '#a855f7', dayOfWeek: 2 },  // Tuesday
    { title: 'Lunch Run', hour: 12, duration: 1, color: '#f97316', dayOfWeek: 4 },  // Thursday
  ]

  // Add recurring events for current month and next month
  for (let m = month; m <= month + 1; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, m, d)
      const dayOfWeek = date.getDay()
      for (const we of weeklyEvents) {
        if (we.dayOfWeek === dayOfWeek) {
          events.push({
            id: id++,
            title: we.title,
            date: new Date(year, m, d),
            hour: we.hour,
            duration: we.duration,
            color: we.color,
            recurring: 'weekly',
          })
        }
      }
    }
  }

  // Specific one-time events this week
  events.push(
    { id: id++, title: 'Project Review', date: new Date(year, month, today + 2), hour: 15, duration: 1, color: '#22c55e' },
    { id: id++, title: 'Launch Day!', date: new Date(year, month, today + 7), hour: 10, duration: 2, color: '#ef4444' },
    { id: id++, title: 'Doctor Appointment', date: new Date(year, month, today + 3), hour: 11, duration: 1, color: '#f97316' },
    { id: id++, title: 'Dinner with Friends', date: new Date(year, month, today + 1), hour: 19, duration: 2, color: '#a855f7' },
  )

  // Birthdays scattered around (all-day events)
  const birthdays = [
    { name: 'Alice', day: 5 },
    { name: 'Bob', day: 12 },
    { name: 'Carol', day: 18 },
    { name: 'David', day: 23 },
    { name: 'Eve', day: 28 },
  ]
  for (const b of birthdays) {
    events.push({
      id: id++,
      title: `🎂 ${b.name}'s Birthday`,
      date: new Date(year, month, b.day),
      color: '#ec4899',
    })
    // Also add next month
    events.push({
      id: id++,
      title: `🎂 ${b.name}'s Birthday`,
      date: new Date(year, month + 1, b.day),
      color: '#ec4899',
    })
  }

  return events
}

function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [events, setEvents] = useState<CalendarEvent[]>(generateSampleEvents)
  const [nextEventId, setNextEventId] = useState(100)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get calendar grid data
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days: (Date | null)[] = []

    // Previous month padding
    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }, [year, month])

  // Get events for a specific date
  const getEventsForDate = useCallback((date: Date) => {
    return events.filter(e =>
      e.date.getFullYear() === date.getFullYear() &&
      e.date.getMonth() === date.getMonth() &&
      e.date.getDate() === date.getDate()
    )
  }, [events])

  // Navigation
  const goToToday = useCallback(() => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }, [])

  const prevPeriod = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    } else if (viewMode === 'week') {
      setCurrentDate(d => new Date(d.getTime() - 7 * 86400000))
    } else {
      setCurrentDate(d => new Date(d.getTime() - 86400000))
    }
  }, [viewMode])

  const nextPeriod = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    } else if (viewMode === 'week') {
      setCurrentDate(d => new Date(d.getTime() + 7 * 86400000))
    } else {
      setCurrentDate(d => new Date(d.getTime() + 86400000))
    }
  }, [viewMode])

  // Day navigation within month view
  const moveDayLeft = useCallback(() => {
    setSelectedDate(d => new Date(d.getTime() - 86400000))
  }, [])

  const moveDayRight = useCallback(() => {
    setSelectedDate(d => new Date(d.getTime() + 86400000))
  }, [])

  const moveDayUp = useCallback(() => {
    setSelectedDate(d => new Date(d.getTime() - 7 * 86400000))
  }, [])

  const moveDayDown = useCallback(() => {
    setSelectedDate(d => new Date(d.getTime() + 7 * 86400000))
  }, [])

  // Event management
  const createEvent = useCallback(() => {
    const title = prompt('Event title:')
    if (title) {
      const color = EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)]
      setEvents(e => [...e, { id: nextEventId, title, date: selectedDate, color }])
      setNextEventId(id => id + 1)
    }
  }, [selectedDate, nextEventId])

  const deleteSelectedEvents = useCallback(() => {
    setEvents(e => e.filter(ev =>
      ev.date.getFullYear() !== selectedDate.getFullYear() ||
      ev.date.getMonth() !== selectedDate.getMonth() ||
      ev.date.getDate() !== selectedDate.getDate()
    ))
  }, [selectedDate])

  // Navigation actions
  useAction('nav:today', {
    label: 'Go to today',
    group: 'Calendar: Navigation',
    defaultBindings: ['t'],
    handler: goToToday,
  })

  useAction('nav:prev', {
    label: 'Previous',
    group: 'Calendar: Navigation',
    defaultBindings: ['h', 'left'],  // 'left' alias for 'arrowleft'
    handler: moveDayLeft,
  })

  useAction('nav:next', {
    label: 'Next',
    group: 'Calendar: Navigation',
    defaultBindings: ['l', 'right'],  // 'right' alias for 'arrowright'
    handler: moveDayRight,
  })

  useAction('nav:up', {
    label: 'Week up',
    group: 'Calendar: Navigation',
    defaultBindings: ['k', 'up'],  // 'up' alias for 'arrowup'
    handler: moveDayUp,
  })

  useAction('nav:down', {
    label: 'Week down',
    group: 'Calendar: Navigation',
    defaultBindings: ['j', 'down'],  // 'down' alias for 'arrowdown'
    handler: moveDayDown,
  })

  useAction('nav:prev-period', {
    label: 'Prev month',
    group: 'Calendar: Navigation',
    defaultBindings: ['['],
    handler: prevPeriod,
  })

  useAction('nav:next-period', {
    label: 'Next month',
    group: 'Calendar: Navigation',
    defaultBindings: [']'],
    handler: nextPeriod,
  })

  // View mode actions
  useAction('view:month', {
    label: 'Month view',
    group: 'Calendar: View',
    defaultBindings: ['m', 'g m'],
    handler: useCallback(() => setViewMode('month'), []),
  })

  useAction('view:week', {
    label: 'Week view',
    group: 'Calendar: View',
    defaultBindings: ['w', 'g w'],
    handler: useCallback(() => setViewMode('week'), []),
  })

  useAction('view:day', {
    label: 'Day view',
    group: 'Calendar: View',
    defaultBindings: ['d', 'g d'],
    handler: useCallback(() => setViewMode('day'), []),
  })

  // Event actions
  useAction('event:create', {
    label: 'New event',
    group: 'Calendar: Events',
    defaultBindings: ['n'],
    handler: createEvent,
  })

  useAction('event:delete', {
    label: 'Delete events',
    group: 'Calendar: Events',
    defaultBindings: ['backspace'],
    handler: deleteSelectedEvents,
  })


  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const isToday = (date: Date | null) => {
    if (!date) return false
    const today = new Date()
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
  }

  const isSelected = (date: Date | null) => {
    if (!date) return false
    return date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
  }

  const selectedDateEvents = getEventsForDate(selectedDate)

  // Get week dates starting from Sunday
  const getWeekDates = useCallback((date: Date) => {
    const day = date.getDay()
    const sunday = new Date(date.getTime() - day * 86400000)
    return Array.from({ length: 7 }, (_, i) => new Date(sunday.getTime() + i * 86400000))
  }, [])

  const weekDates = getWeekDates(currentDate)

  // Hours for timeline view (6am to 10pm)
  const timelineHours = Array.from({ length: 17 }, (_, i) => i + 6)

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM'
    if (hour === 12) return '12 PM'
    if (hour < 12) return `${hour} AM`
    return `${hour - 12} PM`
  }

  return (
    <div className="calendar-app">
      <h1 id="demo">Calendar Demo</h1>
      <p className="hint">
        Press <KbdModal /> for shortcuts.
      </p>

      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={prevPeriod} title="Previous ([)">&lt;</button>
          <button onClick={goToToday} title="Today (T)">Today</button>
          <button onClick={nextPeriod} title="Next (])">&gt;</button>
        </div>
        <h2 className="calendar-title">{monthNames[month]} {year}</h2>
        <div className="view-toggle">
          {(['month', 'week', 'day'] as ViewMode[]).map(v => (
            <button
              key={v}
              className={viewMode === v ? 'active' : ''}
              onClick={() => setViewMode(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'month' && (
        <div className="calendar-grid">
          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="weekday">{d}</div>
            ))}
          </div>
          <div className="calendar-days">
            {calendarDays.map((date, i) => {
              const dayEvents = date ? getEventsForDate(date) : []
              const moreCount = dayEvents.length > 2 ? dayEvents.length - 2 : 0
              return (
                <div
                  key={i}
                  className={`calendar-day ${date ? '' : 'empty'} ${isToday(date) ? 'today' : ''} ${isSelected(date) ? 'selected' : ''}`}
                  onClick={() => date && setSelectedDate(date)}
                >
                  {date && (
                    <>
                      <span className="day-number">{date.getDate()}</span>
                      <div className="day-events">
                        {dayEvents.slice(0, 2).map(ev => (
                          <div
                            key={ev.id}
                            className="event-chip"
                            style={{ backgroundColor: ev.color }}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {moreCount > 0 && (
                          <div className="event-more">+{moreCount} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <div className="week-view timeline">
          <div className="timeline-header">
            <div className="timeline-gutter" />
            {weekDates.map((date, i) => (
              <div
                key={i}
                className={`timeline-day-header ${isToday(date) ? 'today' : ''} ${isSelected(date) ? 'selected' : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                <span className="day-name">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}</span>
                <span className="day-num">{date.getDate()}</span>
              </div>
            ))}
          </div>
          <div className="timeline-body">
            {timelineHours.map(hour => (
              <div key={hour} className="timeline-row">
                <div className="timeline-gutter">{formatHour(hour)}</div>
                {weekDates.map((date, i) => {
                  const dayEvents = getEventsForDate(date).filter(ev => ev.hour === hour)
                  return (
                    <div
                      key={i}
                      className={`timeline-cell ${isToday(date) ? 'today' : ''}`}
                    >
                      {dayEvents.map(ev => (
                        <div
                          key={ev.id}
                          className="timeline-event"
                          style={{
                            backgroundColor: ev.color,
                            height: ev.duration ? `${ev.duration * 100}%` : '100%',
                          }}
                        >
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'day' && (
        <div className="day-view timeline">
          <div className="timeline-header single-day">
            <div className="timeline-gutter" />
            <div className="timeline-day-header selected">
              <span className="day-name">{selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</span>
              <span className="day-num">{selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
          <div className="timeline-body single-day">
            {timelineHours.map(hour => {
              const hourEvents = getEventsForDate(selectedDate).filter(ev => ev.hour === hour)
              return (
                <div key={hour} className="timeline-row">
                  <div className="timeline-gutter">{formatHour(hour)}</div>
                  <div className="timeline-cell">
                    {hourEvents.map(ev => (
                      <div
                        key={ev.id}
                        className="timeline-event"
                        style={{
                          backgroundColor: ev.color,
                          height: ev.duration ? `${ev.duration * 100}%` : '100%',
                        }}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="selected-date-panel">
        <h3>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
        {selectedDateEvents.length === 0 ? (
          <p className="no-events">No events. Press <kbd>N</kbd> to create one.</p>
        ) : (
          <ul className="event-list">
            {selectedDateEvents.map(ev => (
              <li key={ev.id} className="event-item">
                <span className="event-color" style={{ backgroundColor: ev.color }} />
                <span className="event-title">{ev.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ShortcutsModal
        editable
        groupOrder={['Calendar: Navigation', 'Calendar: View', 'Calendar: Events', 'Global', 'Navigation']}
      />
    </div>
  )
}

export function CalendarDemo() {
  return <Calendar />
}
