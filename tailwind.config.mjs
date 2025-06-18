import { GrafanaTheme2 } from '@grafana/data';
import { grafanaThemeToTailwind } from './src/utils/theme';

// Create a default theme instance to use for initial configuration
const defaultTheme = new GrafanaTheme2();

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: grafanaThemeToTailwind(defaultTheme),
  },
  plugins: [],
};
