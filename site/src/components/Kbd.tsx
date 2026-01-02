import type { ReactNode } from 'react'
import {
  Kbd as KbdBase,
  KbdModal as KbdModalBase,
  KbdOmnibar as KbdOmnibarBase,
  KbdLookup as KbdLookupBase,
} from 'use-kbd'
import type { KbdProps } from 'use-kbd'
import { A } from './A'
import { Tooltip } from './Tooltip'

const GH_BASE = 'https://github.com/runsascoded/use-kbd/blob/main/src'

type BuiltinKbdProps = Omit<KbdProps, 'action'>

interface SiteKbdProps extends KbdProps {
  tooltip?: ReactNode
}

/**
 * Wrapper around Kbd that adds a tooltip.
 * Pass `tooltip` prop for custom content, otherwise shows default explanation.
 */
export function Kbd({ tooltip, ...props }: SiteKbdProps) {
  if (!tooltip) return <KbdBase {...props} />
  return (
    <Tooltip title={tooltip}>
      <span>
        <KbdBase {...props} />
      </span>
    </Tooltip>
  )
}

/**
 * Wrapper around KbdModal with tooltip.
 */
export function KbdModal(props: BuiltinKbdProps) {
  return (
    <Tooltip
      title={
        <>
          <A href={`${GH_BASE}/ShortcutsModal.tsx`}><code>&lt;ShortcutsModal&gt;</code></A>
          {' '}shows all shortcuts, allows rebinding
        </>
      }
    >
      <span>
        <KbdModalBase {...props} />
      </span>
    </Tooltip>
  )
}

/**
 * Wrapper around KbdOmnibar with tooltip.
 */
export function KbdOmnibar(props: BuiltinKbdProps) {
  return (
    <Tooltip
      title={
        <>
          <A href={`${GH_BASE}/Omnibar.tsx`}><code>&lt;Omnibar&gt;</code></A>
          {' '}searches available actions
        </>
      }
    >
      <span>
        <KbdOmnibarBase {...props} />
      </span>
    </Tooltip>
  )
}

/**
 * Wrapper around KbdLookup with tooltip.
 */
export function KbdLookup(props: BuiltinKbdProps) {
  return (
    <Tooltip
      title={
        <>
          <A href={`${GH_BASE}/LookupModal.tsx`}><code>&lt;LookupModal&gt;</code></A>
          {' '}find actions by key-bindings
        </>
      }
    >
      <span>
        <KbdLookupBase {...props} />
      </span>
    </Tooltip>
  )
}
