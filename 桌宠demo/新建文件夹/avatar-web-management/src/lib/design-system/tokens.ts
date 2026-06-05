/**
 * Design token types and default theme definitions.
 * Single source of truth for colors, spacing, typography, and radii.
 */

// ─── Color Tokens ───────────────────────────────────────────
export interface ColorTokens {
  bg: {
    deep: string;
    card: string;
    cardHover: string;
    elevated: string;
  };
  accent: {
    primary: string;
    glow: string;
    hover: string;
  };
  border: {
    subtle: string;
    default: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  semantic: {
    danger: string;
    success: string;
    warning: string;
    info: string;
  };
}

// ─── Spacing Tokens ─────────────────────────────────────────
export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

// ─── Typography Tokens ──────────────────────────────────────
export interface TypographyTokens {
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  fontWeight: {
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
  };
}

// ─── Radius Tokens ──────────────────────────────────────────
export interface RadiusTokens {
  sm: string;
  md: string;
  lg: string;
  full: string;
}

// ─── Aggregate Token Set ────────────────────────────────────
export interface DesignTokens {
  colors: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  radii: RadiusTokens;
}

// ─── Default Dark Theme ─────────────────────────────────────
export const darkTokens: DesignTokens = {
  colors: {
    bg: {
      deep: '#09090F',
      card: '#12122A',
      cardHover: '#1a1a3e',
      elevated: '#1a1a3e',
    },
    accent: {
      primary: '#6d5df0',
      glow: 'rgba(109, 93, 240, 0.25)',
      hover: '#7e6ff3',
    },
    border: {
      subtle: 'rgba(139, 92, 246, 0.15)',
      default: 'rgba(139, 92, 246, 0.25)',
    },
    text: {
      primary: '#e8e8f0',
      secondary: '#9494a8',
      muted: '#5e5e7a',
    },
    semantic: {
      danger: '#e0556a',
      success: '#4ade80',
      warning: '#f59e0b',
      info: '#60a5fa',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },
  typography: {
    fontFamily: "'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
  radii: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
};

// ─── Default Light Theme ────────────────────────────────────
export const lightTokens: DesignTokens = {
  colors: {
    bg: {
      deep: '#f5f5fa',
      card: '#ffffff',
      cardHover: '#f0f0f8',
      elevated: '#ffffff',
    },
    accent: {
      primary: '#5a4bd1',
      glow: 'rgba(90, 75, 209, 0.15)',
      hover: '#6d5df0',
    },
    border: {
      subtle: 'rgba(90, 75, 209, 0.12)',
      default: 'rgba(90, 75, 209, 0.2)',
    },
    text: {
      primary: '#1a1a2e',
      secondary: '#5a5a7a',
      muted: '#9494a8',
    },
    semantic: {
      danger: '#d94052',
      success: '#22c55e',
      warning: '#e5a307',
      info: '#3b82f6',
    },
  },
  spacing: darkTokens.spacing,
  typography: darkTokens.typography,
  radii: darkTokens.radii,
};

// ─── Warm Amber Light Theme (Primary) ────────────────────────
export const warmAmberTokens: DesignTokens = {
  colors: {
    bg: {
      deep: '#faf7f2',
      card: '#ffffff',
      cardHover: '#f5f0e8',
      elevated: '#ffffff',
    },
    accent: {
      primary: '#d97706',
      glow: 'rgba(217, 119, 6, 0.15)',
      hover: '#f59e0b',
    },
    border: {
      subtle: 'rgba(0, 0, 0, 0.06)',
      default: 'rgba(0, 0, 0, 0.10)',
    },
    text: {
      primary: '#1c1917',
      secondary: '#78716c',
      muted: '#a8a29e',
    },
    semantic: {
      danger: '#dc2626',
      success: '#16a34a',
      warning: '#d97706',
      info: '#2563eb',
    },
  },
  spacing: darkTokens.spacing,
  typography: darkTokens.typography,
  radii: darkTokens.radii,
};

// ─── Utility: Flatten nested tokens to dotted keys ──────────
export function flattenTokens(
  tokens: Record<string, unknown>,
  prefix = '',
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    const fullKey = prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value as Record<string, unknown>, fullKey));
    } else if (typeof value === 'string') {
      result[fullKey] = value;
    }
  }
  return result;
}
