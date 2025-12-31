import Tooltip from '@mui/material/Tooltip'
import {
  Command as CommandIcon,
  Ctrl as CtrlIcon,
  Option as OptionIcon,
  Shift as ShiftIcon,
  type ModifierIconProps,
} from 'use-kbd'

export function Command(props: ModifierIconProps) {
  return <Tooltip title="command" placement="top" arrow><CommandIcon {...props} /></Tooltip>
}

export function Ctrl(props: ModifierIconProps) {
  return <Tooltip title="ctrl" placement="top" arrow><CtrlIcon {...props} /></Tooltip>
}

export function Option(props: ModifierIconProps) {
  return <Tooltip title="option" placement="top" arrow><OptionIcon {...props} /></Tooltip>
}

export function Shift(props: ModifierIconProps) {
  return <Tooltip title="shift" placement="top" arrow><ShiftIcon {...props} /></Tooltip>
}
