/**
 * Brand tokens (Joliguet / Portclos).
 *
 * Visual evolution should land here first, then flow into Paper via
 * `theme/paper.tsx`. Screens import tokens only for brand chrome
 * (accent rails, splash, marks) — not for ad-hoc one-off hex values.
 */
export const Lighthouse = {
  beacon: '#F2C94C',
  beaconDeep: '#D4A017',
  beaconSoft: '#FFF1C2',
  beaconDim: '#4A3A12',
  sea: '#0E7C7B',
  seaDeep: '#0A5556',
  seaMist: '#D5EDED',
  seaInk: '#063B3B',
  seaFoam: '#7DD3D1',
  night: '#020B12',
  nightMid: '#042A32',
  nightLift1: '#062C34',
  nightLift2: '#0A3A42',
  nightLift3: '#0E464E',
  nightVariant: '#0D3A40',
  rock: '#8B4A32',
  rockSoft: '#E8D2C4',
  foam: '#F4F7F6',
  mistBg: '#F3F7F7',
  mistSurface: '#FBFEFE',
  mistInk: '#142021',
  mistVariant: '#E0ECEC',
  mistMuted: '#3F5252',
  mistOutline: '#6F8282',
  mistOutlineVariant: '#C5D4D4',
  blackBand: '#141414',
  nightMuted: '#B7CDCD',
  nightOutline: '#5A7272',
  nightOutlineVariant: '#2A4548',
  beaconInk: '#1A1400',
  beaconOnContainer: '#3D2E00',
} as const;

export type LighthouseToken = keyof typeof Lighthouse;

/** Material You seed — keep teal (sea), not purple. */
export const PORTCLOS_SOURCE = Lighthouse.sea;

/** Suggested blog labels — product vocabulary, not API-enforced. */
export const BLOG_SUGGESTED_TAGS = [
  'infos',
  'photos',
  'jardin',
  'travaux',
  'fete',
  'urgent',
] as const;
