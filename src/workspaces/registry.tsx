import type { ComponentType } from 'react';
import {
  Layers, Cpu, ShieldAlert, Activity, Globe, PieChart, BookOpen, FlaskConical, Settings, CalendarClock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkspaceId } from '../types';

import { VolatilityTerminal } from './VolatilityTerminal';
import { MarketEvents } from './MarketEvents';
import { StrategyLab } from './StrategyLab';
import { PositionRisk } from './PositionRisk';
import { MarketBreadth } from './MarketBreadth';
import { MacroIntelligence } from './MacroIntelligence';
import { PortfolioAnalytics } from './PortfolioAnalytics';
import { TradeJournal } from './TradeJournal';
import { ResearchDashboard } from './ResearchDashboard';
import { SettingsWorkspace } from './SettingsWorkspace';

export interface WorkspaceDef {
  id: WorkspaceId;
  label: string;       // sidebar tooltip + header title
  subtitle: string;    // header descriptor
  icon: LucideIcon;
  accent: string;
  Component: ComponentType;
}

// Single source of truth — sidebar, top-bar and router all read from this.
export const WORKSPACES: WorkspaceDef[] = [
  {
    id: 'volatility',
    label: 'Volatility Terminal',
    subtitle: '3-D surface · smile · term structure · regime',
    icon: Layers,
    accent: '#f4b740',
    Component: VolatilityTerminal,
  },
  {
    id: 'strategy',
    label: 'Strategy Lab',
    subtitle: 'AI decision engine · ranked option structures',
    icon: Cpu,
    accent: '#27d17c',
    Component: StrategyLab,
  },
  {
    id: 'risk',
    label: 'Position Risk',
    subtitle: 'Portfolio Greeks · Monte-Carlo · risk of ruin',
    icon: ShieldAlert,
    accent: '#f04668',
    Component: PositionRisk,
  },
  {
    id: 'breadth',
    label: 'Market Breadth',
    subtitle: 'Positioning · PCR · support / resistance · GEX',
    icon: Activity,
    accent: '#f4b740',
    Component: MarketBreadth,
  },
  {
    id: 'macro',
    label: 'Macro Intelligence',
    subtitle: 'USDINR · US10Y · DXY · commodities · flows',
    icon: Globe,
    accent: '#c79bff',
    Component: MacroIntelligence,
  },
  {
    id: 'events',
    label: 'Market Events',
    subtitle: 'event risk · IV impact · trading-week score',
    icon: CalendarClock,
    accent: '#f04668',
    Component: MarketEvents,
  },
  {
    id: 'portfolio',
    label: 'Portfolio Analytics',
    subtitle: 'Capital · heat · margin · drawdown cone',
    icon: PieChart,
    accent: '#27d17c',
    Component: PortfolioAnalytics,
  },
  {
    id: 'journal',
    label: 'Trade Journal',
    subtitle: 'Live decision · structure · entry / exit rules',
    icon: BookOpen,
    accent: '#f4b740',
    Component: TradeJournal,
  },
  {
    id: 'research',
    label: 'Research Lab',
    subtitle: 'Validation · accuracy · calibration · model drift',
    icon: FlaskConical,
    accent: '#5aa9ff',
    Component: ResearchDashboard,
  },
  {
    id: 'settings',
    label: 'Settings',
    subtitle: 'Connection · data source · appearance',
    icon: Settings,
    accent: '#8a909a',
    Component: SettingsWorkspace,
  },
];

export const WORKSPACE_MAP: Record<WorkspaceId, WorkspaceDef> = Object.fromEntries(
  WORKSPACES.map((w) => [w.id, w]),
) as Record<WorkspaceId, WorkspaceDef>;
