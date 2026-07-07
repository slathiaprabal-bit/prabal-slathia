import { useTerminal } from './store';
import { BackgroundFX } from './components/BackgroundFX';
import { TopBar } from './components/TopBar';
import { ErrorBanner } from './components/ErrorBanner';
import { Sidebar } from './components/Sidebar';
import { MarketNews } from './components/MarketNews';
import { Loading } from './components/ui/Loading';
import { WorkspaceRouter } from './workspaces/WorkspaceRouter';
import { useResearchRecorder } from './lib/research/useRecorder';

export default function App() {
  const snap = useTerminal((s) => s.snap);
  useResearchRecorder(); // continuous research-DB capture (lib/research)

  return (
    <div className="grid-bg h-screen overflow-hidden" style={{ background: 'var(--bg0)' }}>
      <BackgroundFX />
      <ErrorBanner />

      {/* Floating workspace: outer margins let the whole app breathe above the
          background, with the top rail, nav rail and content as floating glass. */}
      <div className="app-shell relative z-10 flex h-full min-h-0 flex-col">
        <TopBar />

        <div className="flex min-h-0 flex-1 gap-[inherit]">
          <Sidebar />
          <main className="min-h-0 flex-1 overflow-hidden">
            {snap ? <WorkspaceRouter /> : <Loading />}
          </main>
        </div>

        <MarketNews />
      </div>
    </div>
  );
}
