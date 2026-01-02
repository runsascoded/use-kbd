import MuiTooltip, { type TooltipProps } from '@mui/material/Tooltip'

export const tooltipProps = {
  slotProps: {
    tooltip: { sx: { fontSize: '0.9rem' } },
  },
  placement: 'top' as const,
  arrow: true,
}

export function Tooltip(props: TooltipProps) {
  return <MuiTooltip {...tooltipProps} {...props} />
}
