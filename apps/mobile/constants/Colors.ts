/** Fallback for Themed helpers — Paper theme is the source of truth for product UI. */
const tintColorLight = '#0E7C7B';
const tintColorDark = '#7DD3D1';

export default {
  light: {
    text: '#1B1B1F',
    background: '#F7F9F9',
    tint: tintColorLight,
    tabIconDefault: '#8A9291',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#E4E8E8',
    background: '#101414',
    tint: tintColorDark,
    tabIconDefault: '#6B7473',
    tabIconSelected: tintColorDark,
  },
};
