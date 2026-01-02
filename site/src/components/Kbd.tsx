import Tooltip from '@mui/material/Tooltip'
import {
  Kbd as KbdBase,
  KbdModal as KbdModalBase,
  KbdOmnibar as KbdOmnibarBase,
  KbdLookup as KbdLookupBase,
} from 'use-kbd'
import type { KbdProps } from 'use-kbd'

const GH_BASE = 'https://github.com/runsascoded/use-kbd/blob/main/src'

type BuiltinKbdProps = Omit<KbdProps, 'action'>

const tooltipProps = {
  slotProps: {
    tooltip: { sx: { fontSize: '0.9rem' } },
  },
  placement: 'top' as const,
  arrow: true,
}

/**
 * Wrapper around Kbd that adds a tooltip explaining what it is.
 */
export function Kbd(props: KbdProps) {
  return (
    <Tooltip
      {...tooltipProps}
      title={
        <>
          <a href={`${GH_BASE}/Kbd.tsx`} target="_blank" rel="noopener noreferrer">
            <code>&lt;Kbd&gt;</code>
          </a>
          {' '}displays the current binding for an action
        </>
      }
    >
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
      {...tooltipProps}
      title={
        <>
          <a href={`${GH_BASE}/ShortcutsModal.tsx`} target="_blank" rel="noopener noreferrer">
            <code>&lt;ShortcutsModal&gt;</code>
          </a>
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
      {...tooltipProps}
      title={
        <>
          <a href={`${GH_BASE}/Omnibar.tsx`} target="_blank" rel="noopener noreferrer">
            <code>&lt;Omnibar&gt;</code>
          </a>
          {' '}searches all actions across pages
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
      {...tooltipProps}
      title={
        <>
          <a href={`${GH_BASE}/LookupModal.tsx`} target="_blank" rel="noopener noreferrer">
            <code>&lt;LookupModal&gt;</code>
          </a>
          {' '}finds action by pressing its shortcut
        </>
      }
    >
      <span>
        <KbdLookupBase {...props} />
      </span>
    </Tooltip>
  )
}
