import { useCallback, useRef, useState, KeyboardEvent } from 'react'

export interface PendingAction {
  id: string
  label: string
}

export interface UseParamEntryOptions {
  /** Called when parameter is submitted */
  onSubmit: (actionId: string, captures: number[]) => void
  /** Called when parameter entry is cancelled */
  onCancel?: () => void
}

export interface UseParamEntryReturn {
  /** Currently pending action awaiting parameter, or null */
  pendingAction: PendingAction | null
  /** Current parameter value */
  paramValue: string
  /** Set the parameter value */
  setParamValue: (value: string) => void
  /** Ref for the parameter input element */
  paramInputRef: React.RefObject<HTMLInputElement>
  /** Start parameter entry for an action */
  startParamEntry: (action: PendingAction) => void
  /** Submit the current parameter value */
  submitParam: () => void
  /** Cancel parameter entry */
  cancelParam: () => void
  /** Keyboard handler for the parameter input */
  handleParamKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  /** Whether currently in parameter entry mode */
  isEnteringParam: boolean
}

/**
 * Hook for managing parameter entry state for actions with digit placeholders.
 *
 * @example
 * ```tsx
 * const paramEntry = useParamEntry({
 *   onSubmit: (actionId, captures) => executeAction(actionId, captures),
 *   onCancel: () => inputRef.current?.focus(),
 * })
 *
 * // Start param entry when selecting an action with digit placeholder
 * if (hasDigitPlaceholder(keySeq)) {
 *   paramEntry.startParamEntry({ id: 'nav:down-n', label: 'Down N rows' })
 * }
 *
 * // Render param input
 * {paramEntry.isEnteringParam && (
 *   <input
 *     ref={paramEntry.paramInputRef}
 *     value={paramEntry.paramValue}
 *     onChange={e => paramEntry.setParamValue(e.target.value)}
 *     onKeyDown={paramEntry.handleParamKeyDown}
 *   />
 * )}
 * ```
 */
export function useParamEntry({
  onSubmit,
  onCancel,
}: UseParamEntryOptions): UseParamEntryReturn {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [paramValue, setParamValue] = useState('')
  const paramInputRef = useRef<HTMLInputElement>(null)

  const startParamEntry = useCallback((action: PendingAction) => {
    setPendingAction(action)
    setParamValue('')
    // Focus param input after state update
    requestAnimationFrame(() => {
      paramInputRef.current?.focus()
    })
  }, [])

  const submitParam = useCallback(() => {
    if (!pendingAction || !paramValue) return
    const num = parseInt(paramValue, 10)
    if (isNaN(num)) return

    onSubmit(pendingAction.id, [num])
    setPendingAction(null)
    setParamValue('')
  }, [pendingAction, paramValue, onSubmit])

  const cancelParam = useCallback(() => {
    setPendingAction(null)
    setParamValue('')
    onCancel?.()
  }, [onCancel])

  const handleParamKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (paramValue) {
        submitParam()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelParam()
    }
  }, [paramValue, submitParam, cancelParam])

  return {
    pendingAction,
    paramValue,
    setParamValue,
    paramInputRef,
    startParamEntry,
    submitParam,
    cancelParam,
    handleParamKeyDown,
    isEnteringParam: pendingAction !== null,
  }
}

