import React, { createContext, useContext, useEffect, useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { grafanaThemeToTailwind } from '../utils/theme';

interface ThemeContextType {
  theme: GrafanaTheme2;
  tailwindTheme: ReturnType<typeof grafanaThemeToTailwind>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme2();
  const [tailwindTheme, setTailwindTheme] = useState(() => grafanaThemeToTailwind(theme));

  useEffect(() => {
    setTailwindTheme(grafanaThemeToTailwind(theme));
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, tailwindTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
