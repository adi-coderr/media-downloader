/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#EDE8F5',
        primary: {
          DEFAULT: '#7091E6',
          hover: '#8697C4',
          dark: '#3D52A0',
        },
        surface: '#ADBBDA',
        accent: '#3D52A0',
        success: '#7091E6',
        danger: '#3D52A0',
        warning: '#ADBBDA',
        glass: 'rgba(173, 187, 212, 0.14)',
        'glass-border': 'rgba(173, 187, 212, 0.24)',
      },
      backdropBlur: {
        glass: '20px',
      },
      borderRadius: {
        glass: '24px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(112, 145, 230, 0.35)',
        'glow-success': '0 0 30px rgba(112, 145, 230, 0.35)',
        'glow-danger': '0 0 30px rgba(61, 82, 160, 0.35)',
        card: '0 8px 32px rgba(61, 82, 160, 0.24)',
      },
      animation: {
        'gradient-shift': 'gradient-shift 15s ease infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
};
