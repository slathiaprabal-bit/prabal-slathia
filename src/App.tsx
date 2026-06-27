import { useTerminal } from './store';
import { BackgroundFX } from './components/BackgroundFX';
import { TopBar } from './components/TopBar';
import { ErrorBanner } from './components/ErrorBanner';
import { Sidebar } from './components/Sidebar';
import { MarketNews } from './components/MarketNews';
import { Loading } from './components/ui/Loading';
import { WorkspaceRouter } from './workspaces/WorkspaceRouter';

export default function App() {
  const snap = useTerminal((s) => s.snap);

  return (
    <div className="grid-bg flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg0)' }}>
      <BackgroundFX />
      <TopBar />
      <ErrorBanner />

      {/* Body: sidebar + active workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-hidden">
          {snap ? <WorkspaceRouter /> : <Loading />}
        </main>
      </div>

      <MarketNews />
    </div>
  );
}
