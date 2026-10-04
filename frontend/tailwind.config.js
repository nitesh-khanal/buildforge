/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#F5F4F0',
        surface: '#FFFFFF',
        raised: '#EBECE8',
        border: '#C7CECB',
        'border-soft': '#E0E5E1',
        ink: '#17252B',
        muted: '#4D5D63',
        faint: '#65747A',
        accent: {
          DEFAULT: '#AE2443',
          hover: '#8F1935',
          soft: '#F7E8EC',
        },
        stock: {
          in: '#176B4C',
          low: '#965B0B',
          out: '#AA2841',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
      },
      maxWidth: {
        content: '1360px',
      },
    },
  },
  plugins: [],
};
