import type { RegimeState } from './types';

// Institutional dark palette: deep navy base, neon-blue / violet accents.
export const palette = {
  bg0: '#05060d',
  bg1: '#0a0e1c',
  bg2: '#0e1430',
  glass: 'rgba(14,20,48,0.55)',
  glassBorder: 'rgba(96,150,220,0.16)',
  neon: '#3fd6f5',
  violet: '#8b5cf6',
  cyan: '#22e0ff',
  text: '#cfe3f5',
  dim: '#5d7794',
  good: '#16f5b0',
  warn: '#ffb020',
  bad: '#ff2d6e',
};

export interface RegimeTheme {
  label: string;
  accent: string;
  glow: string;
  bgPulse: string;
  roughness: number; // surface roughness driver (0 smooth .. 1 jagged)
}

export const REGIME_THEME: Record<RegimeState, RegimeTheme> = {
  NORMAL: {
    label: 'NORMAL',
    accent: '#3fd6f5',
    glow: 'rgba(63,214,245,0.55)',
    bgPulse: 'rgba(20,60,90,0.0)',
    roughness: 0.12,
  },
  TRENDING_UP: {
    label: 'TRENDING UP',
    accent: '#16f5b0',
    glow: 'rgba(22,245,176,0.55)',
    bgPulse: 'rgba(16,120,90,0.10)',
    roughness: 0.2,
  },
  TRENDING_DOWN: {
    label: 'TRENDING DOWN',
    accent: '#ff7a59',
    glow: 'rgba(255,122,89,0.5)',
    bgPulse: 'rgba(120,50,30,0.12)',
    roughness: 0.28,
  },
  VOLATILE: {
    label: 'VOLATILE',
    accent: '#ffb020',
    glow: 'rgba(255,176,32,0.55)',
    bgPulse: 'rgba(140,90,10,0.16)',
    roughness: 0.62,
  },
  EVENT_RISK: {
    label: 'EVENT RISK',
    accent: '#c084fc',
    glow: 'rgba(192,132,252,0.55)',
    bgPulse: 'rgba(90,40,150,0.16)',
    roughness: 0.5,
  },
  NO_GO: {
    label: 'NO-GO',
    accent: '#ff2d6e',
    glow: 'rgba(255,45,110,0.6)',
    bgPulse: 'rgba(150,20,50,0.22)',
    roughness: 0.85,
  },
};

// Rainbow vol colourscale (deep blue → cyan → green → yellow → orange → red).
// Matches the SPX institutional vol-surface aesthetic.
export const IV_STOPS: [number, string][] = [
  [0.00, '#1a00d4'],   // deep indigo — lowest IV
  [0.15, '#0055ff'],   // blue
  [0.32, '#00c8ff'],   // cyan
  [0.50, '#00e890'],   // green
  [0.66, '#ffe000'],   // yellow
  [0.82, '#ff7000'],   // orange
  [1.00, '#ff0030'],   // red — highest IV
];
