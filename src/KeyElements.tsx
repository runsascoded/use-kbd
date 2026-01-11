import type { ReactElement } from 'react'
import { getKeyIcon } from './KeyIcons'
import { ModifierIcon } from './ModifierIcons'
import type { KeySeq, Modifiers, SeqElem } from './types'
import { formatKeyForDisplay } from './utils'

/**
 * Render modifier icons (meta, ctrl, alt, shift) for a key combination.
 * Used consistently across all key rendering components.
 */
export function renderModifierIcons(modifiers: Modifiers, className = 'kbd-modifier-icon'): ReactElement[] {
  const icons: ReactElement[] = []
  if (modifiers.meta) {
    icons.push(<ModifierIcon key="meta" modifier="meta" className={className} />)
  }
  if (modifiers.ctrl) {
    icons.push(<ModifierIcon key="ctrl" modifier="ctrl" className={className} />)
  }
  if (modifiers.alt) {
    icons.push(<ModifierIcon key="alt" modifier="alt" className={className} />)
  }
  if (modifiers.shift) {
    icons.push(<ModifierIcon key="shift" modifier="shift" className={className} />)
  }
  return icons
}

/**
 * Render a single key with its icon or display text.
 * Returns the icon component if available, otherwise formatted text.
 */
export function renderKeyContent(key: string, iconClassName = 'kbd-key-icon'): ReactElement {
  const Icon = getKeyIcon(key)
  const displayKey = formatKeyForDisplay(key)
  return Icon ? <Icon className={iconClassName} /> : <>{displayKey}</>
}

/**
 * Render a complete SeqElem (key with modifiers, or digit placeholder).
 * Handles all element types: 'key', 'digit', 'digits'.
 */
export function renderSeqElem(elem: SeqElem, index: number, kbdClassName = 'kbd-kbd'): ReactElement {
  if (elem.type === 'digit') {
    return <kbd key={index} className={kbdClassName}>⟨#⟩</kbd>
  }
  if (elem.type === 'digits') {
    return <kbd key={index} className={kbdClassName}>⟨##⟩</kbd>
  }
  // It's a key with modifiers
  return (
    <kbd key={index} className={kbdClassName}>
      {renderModifierIcons(elem.modifiers)}
      {renderKeyContent(elem.key)}
    </kbd>
  )
}

/**
 * Render a complete KeySeq (array of sequence elements).
 * Used for displaying key sequences in SequenceModal, LookupModal, etc.
 */
export function renderKeySeq(keySeq: KeySeq, kbdClassName = 'kbd-kbd'): ReactElement[] {
  return keySeq.map((elem, i) => renderSeqElem(elem, i, kbdClassName))
}
