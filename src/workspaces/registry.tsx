import type { ComponentType } from 'react';
import {
  Layers, Cpu, ShieldAlert, Activity, Globe, PieChart, BookOpen, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkspaceId } from '../types';

import { VolatilityTerminal } from './VolatilityTerminal';
import { StrategyLab } from './StrategyLab';
import { PositionRisk } from './PositionRisk';
import { MarketBreadth } from './MarketBreadth';
import { MacroIntelligence } from './MacroIntelligence';
import { PortfolioAnalytics } from './PortfolioAnalytics';
import { TradeJournal } from './TradeJournal';
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
    accent: '#3fd6f5',
    Component: VolatilityTerminal,
  },
  {
    id: 'strategy',
    label: 'Strategy Lab',
    subtitle: 'AI decision engine · ranked option structures',
    icon: Cpu,
    accent: '#16f5b0',
    Component: StrategyLab,
  },
  {
    id: 'risk',
    label: 'Position Risk',
    subtitle: 'Portfolio Greeks · Monte-Carlo · risk of ruin',
    icon: ShieldAlert,
    accent: '#ff2d6e',
    Component: PositionRisk,
  },
  {
    id: 'breadth',
    label: 'Market Breadth',
    subtitle: 'Positioning · PCR · support / resistance · GEX',
    icon: Activity,
    accent: '#ffb020',
    Component: MarketBreadth,
  },
  {
    id: 'macro',
    label: 'Macro Intelligence',
    subtitle: 'USDINR · US10Y · DXY · commodities · flows',
    icon: Globe,
    accent: '#c084fc',
    Component: MacroIntelligence,
  },
  {
    id: 'portfolio',
    label: 'Portfolio Analytics',
    subtitle: 'Capital · heat · margin · drawdown cone',
    icon: PieChart,
    accent: '#2f7bff',
    Component: PortfolioAnalytics,
  },
  {
    id: 'journal',
    label: 'Trade Journal',
    subtitle: 'Live decision · structure · entry / exit rules',
    icon: BookOpen,
    accent: '#ff8a3d',
    Component: TradeJournal,
  },
  {
    id: 'settings',
    label: 'Settings',
    subtitle: 'Connection · data source · appearance',
    icon: Settings,
    accent: '#5d7794',
    Component: SettingsWorkspace,
  },
];

export const WORKSPACE_MAP: Record<WorkspaceId, WorkspaceDef> = Object.fromEntries(
  WORKSPACES.map((w) => [w.id, w]),
) as Record<WorkspaceId, WorkspaceDef>;
