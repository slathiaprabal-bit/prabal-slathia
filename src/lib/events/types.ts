// Market Event Intelligence — frontend type contract. Mirrors the backend
// /api/events payload (raw events + provenance) and adds the deterministic,
// frontend-computed decision layer (impact ratings, recommended action, risk).

export type EventCategory = 'INDIA_MACRO' | 'GLOBAL_MACRO' | 'MARKET_STRUCTURE' | 'CORPORATE';
export type EventImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ExpectedVol = 'EXPANSION' | 'CONTRACTION' | 'NEUTRAL';
export type EventStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED';
export type IVDirection = 'EXPANSION' | 'CRUSH' | 'NEUTRAL';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type RiskBand = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

// The deterministic Trading Impact Ratings.
export type ImpactRating =
  | 'Expected IV Expansion'
  | 'Expected IV Crush'
  | 'Expected Gamma Risk'
  | 'Expected Gap Risk'
  | 'Expected Trend Continuation'
  | 'Expected Mean Reversion';

// The deterministic Recommended Actions.
export type RecommendedAction =
  | 'Safe to Sell Premium'
  | 'Reduce Position Size'
  | 'Avoid New Trades'
  | 'Avoid Overnight Positions'
  | 'Normal Trading Conditions'
  | 'Wait Until Event Passes'
  | 'High Volatility Expected';

// Raw event as served by /api/events (snake_case preserved from backend).
export interface RawEvent {
  id: string;
  type: string;
  name: string;
  category: EventCategory;
  country: string;
  datetime: string;            // ISO8601 with tz
  importance: EventImportance;
  expected_vol: ExpectedVol;
  vol_magnitude: number;
  markets: string[];
  sectors: string[];
  description: string;
  source: string;
  source_url: string | null;
  last_updated: string | null;
  last_checked: string | null;
  status: EventStatus;         // computed by backend at serve time
  secondsUntil: number | null;
}

export interface TradingImpact {
  ratings: ImpactRating[];
  ivDirection: IVDirection;
  riskLevel: RiskLevel;
  riskScore: number;           // 0..100 for this single event
  action: RecommendedAction;
  note: string;                // deterministic one-liner
}

// Decorated event consumed by the UI (countdown recomputed live).
export interface MarketEvent extends RawEvent {
  impact: TradingImpact;
  msUntil: number | null;
  countdown: string;           // "2d 4h" / "5h 12m" / "now"
  isToday: boolean;
}

export interface DayRisk {
  date: string;                // IST YYYY-MM-DD
  label: string;               // "Mon" / "Today"
  score: number;               // 0..100
  band: RiskBand;
  events: number;
  topEvent: string | null;
}

export interface WeekRisk {
  days: DayRisk[];
  overall: number;             // 0..100 Next-7-Days meter
  band: RiskBand;
}

export interface SectorTilt {
  sector: string;
  score: number;               // summed event-risk exposure
  events: number;
}
