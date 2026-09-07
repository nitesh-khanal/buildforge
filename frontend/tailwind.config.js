/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B0E14',
        surface: '#11151D',
        raised: '#161B25',
        border: '#232A38',
        'border-soft': '#1B212C',
        ink: '#E9E7E0',
        muted: '#8891A0',
        faint: '#5B6472',
        accent: {
          DEFAULT: '#D0273D',
          hover: '#E9384C',
          soft: '#3A1620',
        },
        stock: {
          in: '#4CAF7D',
          low: '#D9A441',
          out: '#8A5B64',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
      },
      maxWidth: {
        content: '1360px',
      },
    },
  },
  plugins: [],
};
