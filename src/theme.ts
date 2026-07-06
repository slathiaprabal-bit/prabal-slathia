import type { RegimeState } from './types';

// ── Institutional ultra-dark palette ──────────────────────────────────────
// Matte-black surfaces, graphite panels, restrained semantic accents only.
// No blue-glass. Colour appears solely where information matters.
export const palette = {
  bg0: '#0a0a0b',
  bg1: '#101014',
  bg2: '#151519',
  bg3: '#191920',
  panel: '#111117',
  panelHi: '#1a1a21',
  border: 'rgba(255,255,255,0.075)',
  text: '#f2f3f7',
  dim: '#9ba0ad',
  faint: '#575c67',
  // Semantic accents — soft, non-neon (mirrors index.css tokens)
  pos: '#34d399',   // soft green — positive
  lime: '#86e08a',  // strong positive
  gold: '#a78bfa',  // brand/active — light violet (legacy token name)
  neg: '#f4657c',   // soft red — negative
  white: '#f2f3f7',
  grey: '#9ba0ad',
};

export interface RegimeTheme {
  label: string;
  accent: string;
  glow: string;
  bgPulse: string;
  roughness: number; // surface roughness driver (0 smooth .. 1 jagged)
}

// Regime accents are semantic and restrained — glow alphas kept low so data,
// not lighting, dominates the interface.
export const REGIME_THEME: Record<RegimeState, RegimeTheme> = {
  NORMAL: {
    label: 'NORMAL',
    accent: '#cfd3d8',
    glow: 'rgba(207,211,216,0.12)',
    bgPulse: 'rgba(255,255,255,0.0)',
    roughness: 0.12,
  },
  TRENDING_UP: {
    label: 'TRENDING UP',
    accent: '#27d17c',
    glow: 'rgba(39,209,124,0.16)',
    bgPulse: 'rgba(39,209,124,0.04)',
    roughness: 0.2,
  },
  TRENDING_DOWN: {
    label: 'TRENDING DOWN',
    accent: '#f04668',
    glow: 'rgba(240,70,104,0.16)',
    bgPulse: 'rgba(240,70,104,0.05)',
    roughness: 0.28,
  },
  VOLATILE: {
    label: 'VOLATILE',
    accent: '#f4b740',
    glow: 'rgba(244,183,64,0.18)',
    bgPulse: 'rgba(244,183,64,0.05)',
    roughness: 0.62,
  },
  EVENT_RISK: {
    label: 'EVENT RISK',
    accent: '#c79bff',
    glow: 'rgba(199,155,255,0.16)',
    bgPulse: 'rgba(199,155,255,0.05)',
    roughness: 0.5,
  },
  NO_GO: {
    label: 'NO-GO',
    accent: '#f04668',
    glow: 'rgba(240,70,104,0.2)',
    bgPulse: 'rgba(240,70,104,0.07)',
    roughness: 0.85,
  },
};

// Rainbow IV colour-scale (deep blue → cyan → green → yellow → orange → red).
// Retained as the hero surface gradient — the one place colour runs free.
export const IV_STOPS: [number, string][] = [
  [0.00, '#1a00d4'],   // deep indigo — lowest IV
  [0.15, '#0055ff'],   // blue
  [0.32, '#00c8ff'],   // cyan
  [0.50, '#00e890'],   // green
  [0.66, '#ffe000'],   // yellow
  [0.82, '#ff7000'],   // orange
  [1.00, '#ff0030'],   // red — highest IV
];
