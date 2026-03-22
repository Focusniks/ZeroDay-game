import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Основная палитра киберпанк
        cyber: {
          black: '#0a0a0f',
          dark: '#0d1117',
          darker: '#161b22',
          card: '#1c2333',
          border: '#30363d',
          text: '#c9d1d9',
          muted: '#8b949e',
        },
        neon: {
          green: '#00ff41',
          cyan: '#00d4ff',
          purple: '#bd00ff',
          pink: '#ff006e',
          blue: '#0066ff',
          yellow: '#ffd700',
        },
        accent: {
          primary: '#00d4ff',
          secondary: '#bd00ff',
          success: '#00ff41',
          warning: '#ffd700',
          danger: '#ff006e',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'Space Grotesk', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'matrix-rain': 'matrix-rain 20s linear infinite',
        'glitch': 'glitch 0.3s ease-in-out',
        'typing': 'typing 3.5s steps(40, end)',
        'blink-caret': 'blink-caret 0.75s step-end infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'fade-in-up': 'fade-in-up 0.6s ease-out',
        'slide-in-left': 'slide-in-left 0.5s ease-out',
        'slide-in-right': 'slide-in-right 0.5s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'scan-line': 'scan-line 8s linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'glitch': {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' },
        },
        'typing': {
          from: { width: '0' },
          to: { width: '100%' },
        },
        'blink-caret': {
          'from, to': { borderColor: 'transparent' },
          '50%': { borderColor: '#00d4ff' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-50px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(50px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)',
        'cyber-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #161b22 100%)',
      },
      backgroundSize: {
        'grid': '50px 50px',
      },
      boxShadow: {
        'neon-cyan': '0 0 5px rgba(0, 212, 255, 0.3), 0 0 20px rgba(0, 212, 255, 0.1)',
        'neon-green': '0 0 5px rgba(0, 255, 65, 0.3), 0 0 20px rgba(0, 255, 65, 0.1)',
        'neon-purple': '0 0 5px rgba(189, 0, 255, 0.3), 0 0 20px rgba(189, 0, 255, 0.1)',
        'card-glow': '0 0 30px rgba(0, 212, 255, 0.05), 0 4px 20px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
