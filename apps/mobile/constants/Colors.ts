import { Lighthouse } from '@/theme/lighthouse';

/** Fallback for Themed helpers — Paper theme is the source of truth for product UI. */
const tintColorLight = Lighthouse.sea;
const tintColorDark = Lighthouse.beacon;

export default {
  light: {
    text: '#142021',
    background: '#F3F7F7',
    tint: tintColorLight,
    tabIconDefault: '#8A9291',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: Lighthouse.foam,
    background: Lighthouse.night,
    tint: tintColorDark,
    tabIconDefault: '#6B7473',
    tabIconSelected: tintColorDark,
  },
};
