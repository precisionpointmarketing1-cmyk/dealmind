import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e0f8ff',
          100: '#b3eeff',
          200: '#7fe2ff',
          300: '#40d4ff',
          400: '#00c8ff',
          500: '#00aee8',
          600: '#0090cc',
          700: '#006fa8',
          800: '#004f80',
          900: '#003458',
        },
        navy: {
          900: '#0b0f1e',
          800: '#0f1628',
          700: '#131d35',
          600: '#182240',
          500: '#1e2a4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #00c8ff 0%, #0066cc 100%)',
        'brand-gradient-dark': 'linear-gradient(135deg, #0090cc 0%, #004f80 100%)',
      },
    },
  },
  plugins: [],
}

export default config
