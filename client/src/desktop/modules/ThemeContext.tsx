/**
 * ThemeContext — контекст темы для модулей рабочего стола
 * 
 * Предоставляет унифицированный доступ к цветам, шрифтам и отступам
 */

import { createContext, useContext, type ReactNode } from 'react';

// ============================================================================
// Типы темы
// ============================================================================

export type DesktopTheme = {
  colors: {
    primary: string;
    primaryHover: string;
    secondary: string;
    background: string;
    surface: string;
    surfaceHover: string;
    surfaceActive: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    borderHover: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      xxl: number;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    inner: string;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
  zIndex: {
    desktop: number;
    window: number;
    taskbar: number;
    startMenu: number;
    modal: number;
    notification: number;
    tooltip: number;
  };
};

// ============================================================================
// Тема по умолчанию (Zero Day Cyberpunk Theme)
// ============================================================================

export const defaultTheme: DesktopTheme = {
  colors: {
    primary: '#22d3ee',        // cyan-400
    primaryHover: '#06b6d4',   // cyan-500
    secondary: '#6366f1',      // indigo-500
    background: '#0a0a0f',     // very dark
    surface: '#1a1a24',        // dark surface
    surfaceHover: '#252532',
    surfaceActive: '#2d2d3d',
    text: '#f8fafc',          // slate-50
    textSecondary: '#94a3b8',  // slate-400
    textMuted: '#64748b',      // slate-500
    border: '#27272a',         // zinc-800
    borderHover: '#3f3f46',    // zinc-700
    error: '#ef4444',          // red-500
    warning: '#f59e0b',        // amber-500
    success: '#22c55e',        // green-500
    info: '#3b82f6',           // blue-500
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", system-ui, -apple-system, sans-serif',
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 24,
      xxl: 32,
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 4px 6px rgba(0, 0, 0, 0.5)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.6)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.7)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
  transitions: {
    fast: '100ms ease',
    normal: '200ms ease',
    slow: '300ms ease',
  },
  zIndex: {
    desktop: 0,
    window: 100,
    taskbar: 500,
    startMenu: 600,
    modal: 700,
    notification: 800,
    tooltip: 900,
  },
};

// ============================================================================
// Context
// ============================================================================

type ThemeContextValue = {
  theme: DesktopTheme;
  // Helper функции
  getSpacing: (key: keyof DesktopTheme['spacing']) => number;
  getColor: (key: keyof DesktopTheme['colors']) => string;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  getSpacing: (key) => defaultTheme.spacing[key],
  getColor: (key) => defaultTheme.colors[key],
});

// ============================================================================
// Provider
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode;
  theme?: DesktopTheme;
}

export function ThemeProvider({ children, theme = defaultTheme }: ThemeProviderProps) {
  const value: ThemeContextValue = {
    theme,
    getSpacing: (key) => theme.spacing[key],
    getColor: (key) => theme.colors[key],
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Использование темы в компоненте
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Использование только цветов темы
 */
export function useThemeColors() {
  const { theme } = useTheme();
  return theme.colors;
}

/**
 * Использование только отступов темы
 */
export function useThemeSpacing() {
  const { theme } = useTheme();
  return theme.spacing;
}

/**
 * Получение CSS-переменных из темы
 */
export function useThemeCSSVariables(): Record<string, string> {
  const { theme } = useTheme();
  
  return {
    '--color-primary': theme.colors.primary,
    '--color-secondary': theme.colors.secondary,
    '--color-background': theme.colors.background,
    '--color-surface': theme.colors.surface,
    '--color-text': theme.colors.text,
    '--color-text-secondary': theme.colors.textSecondary,
    '--spacing-xs': `${theme.spacing.xs}px`,
    '--spacing-sm': `${theme.spacing.sm}px`,
    '--spacing-md': `${theme.spacing.md}px`,
    '--spacing-lg': `${theme.spacing.lg}px`,
    '--spacing-xl': `${theme.spacing.xl}px`,
    '--radius-sm': `${theme.borderRadius.sm}px`,
    '--radius-md': `${theme.borderRadius.md}px`,
    '--radius-lg': `${theme.borderRadius.lg}px`,
  };
}
