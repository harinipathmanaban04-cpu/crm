export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Primary teal — matches "FRIENDLY" and circuit in logo
        brand: {
          50:  '#EDFAFA',
          100: '#D0F4F4',
          200: '#A0E8E8',
          300: '#60D5D5',
          400: '#38CACF',
          500: '#23AAA7',
          600: '#1DA4AC',
          700: '#1096AB',
          800: '#085555',
          900: '#053838',
        },
        // Coral — matches "ECO" and E emblem in logo
        coral: {
          50:  '#FFF3F0',
          100: '#FFE1DA',
          200: '#FFC2B4',
          300: '#FF9A87',
          400: '#F47960',
          500: '#FD7B69',
          600: '#FB725D',
          700: '#E66354',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

