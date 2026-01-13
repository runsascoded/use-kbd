import MuiTooltip, { type TooltipProps } from '@mui/material/Tooltip'

const tooltipProps = {
  slotProps: {
    tooltip: {
      sx: {
        fontSize: '0.9rem',
        // Use library's link CSS variables for consistent styling
        '& a': {
          color: 'var(--kbd-link)',
          textDecoration: 'none',
          transition: 'color var(--kbd-transition)',
          '&:hover': {
            color: 'var(--kbd-link-hover)',
            textDecoration: 'underline',
          },
        },
        '& a code': {
          color: 'inherit',
          background: 'var(--kbd-bg-secondary)',
          padding: '0.1em 0.3em',
          borderRadius: 'var(--kbd-radius-sm)',
        },
      },
    },
  },
  placement: 'top' as const,
  arrow: true,
}

export function Tooltip(props: TooltipProps) {
  return <MuiTooltip {...tooltipProps} {...props} />
}
