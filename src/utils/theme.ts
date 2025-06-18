import { GrafanaTheme2 } from '@grafana/data';

export function grafanaThemeToTailwind(theme: GrafanaTheme2) {
  return {
    colors: {
      primary: theme.colors.primary.main,
      secondary: theme.colors.secondary.main,
      success: theme.colors.success.main,
      warning: theme.colors.warning.main,
      error: theme.colors.error.main,
      info: theme.colors.info.main,
      background: {
        primary: theme.colors.background.primary,
        secondary: theme.colors.background.secondary,
        canvas: theme.colors.background.canvas,
      },
      text: {
        primary: theme.colors.text.primary,
        secondary: theme.colors.text.secondary,
        disabled: theme.colors.text.disabled,
      },
      border: {
        weak: theme.colors.border.weak,
        medium: theme.colors.border.medium,
        strong: theme.colors.border.strong,
      },
    },
    spacing: {
      // Convert Grafana spacing to Tailwind spacing
      // Grafana uses a base unit of 8px
      px: '1px',
      0: '0',
      0.5: theme.spacing(0.5), // 4px
      1: theme.spacing(1), // 8px
      1.5: theme.spacing(1.5), // 12px
      2: theme.spacing(2), // 16px
      2.5: theme.spacing(2.5), // 20px
      3: theme.spacing(3), // 24px
      3.5: theme.spacing(3.5), // 28px
      4: theme.spacing(4), // 32px
      5: theme.spacing(5), // 40px
      6: theme.spacing(6), // 48px
      7: theme.spacing(7), // 56px
      8: theme.spacing(8), // 64px
      9: theme.spacing(9), // 72px
      10: theme.spacing(10), // 80px
      11: theme.spacing(11), // 88px
      12: theme.spacing(12), // 96px
    },
    borderRadius: {
      none: '0',
      sm: theme.shape.borderRadius(1),
      DEFAULT: theme.shape.radius.default,
      md: theme.shape.borderRadius(3),
      lg: theme.shape.borderRadius(4),
      xl: theme.shape.borderRadius(5),
      '2xl': theme.shape.borderRadius(6),
      '3xl': theme.shape.borderRadius(7),
      full: '9999px',
    },
    fontSize: {
      xs: theme.typography.size.xs,
      sm: theme.typography.size.sm,
      base: theme.typography.size.base,
      lg: theme.typography.size.lg,
    },
    fontWeight: {
      light: theme.typography.fontWeightLight,
      normal: theme.typography.fontWeightRegular,
      medium: theme.typography.fontWeightMedium,
      bold: theme.typography.fontWeightBold,
    },
    boxShadow: {
      sm: theme.shadows.z1,
      DEFAULT: theme.shadows.z2,
      md: theme.shadows.z3,
      none: 'none',
    },
  };
}
