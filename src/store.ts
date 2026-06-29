import { create } from 'zustand';
import type { Snapshot, ConnState, BackendError, WorkspaceId } from './types';
import { mockSnapshot } from './mock';
import { dbg, armCapture } from './debug';

const WS_URL =
  (import.meta as any).env?.VITE_WS_URL ||
  `ws://${location.hostname}:8000/ws/stream`;

interface TerminalState {
  snap: Snapshot | null;
  prev: Snapshot | null;
  conn: ConnState;
  error: BackendError | null;
  workspace: WorkspaceId;
  setSnap: (s: Snapshot) => void;
  setConn: (c: ConnState) => void;
  setError: (e: BackendError | null) => void;
  setWorkspace: (w: WorkspaceId) => void;
}

export const useTerminal = create<TerminalState>((set, get) => ({
  snap: null,
  prev: null,
  conn: 'connecting',
  error: null,
  // Navigation lives in the store so switching workspaces never tears down
  // the single live WebSocket connection (data + feed are global).
  workspace: 'volatility',
  setSnap: (s) => set({ snap: s, prev: get().snap }),
  setConn: (c) => set({ conn: c }),
  setError: (e) => set({ error: e }),
  setWorkspace: (w) => set({ workspace: w }),
}));

// Strategy: populate with demo data IMMEDIATELY so the terminal is never blank,
// then upgrade to the live WebSocket feed the moment a valid frame arrives. If
// the backend streams an error payload (our instrumented traceback), surface it
// in the UI instead of silently staying on demo data.
export function startFeed() {
  const { setSnap, setConn, setError } = useTerminal.getState();
  let gotLive = false;
  let anomalyLatched = false; // VOLARA-DBG: capture once per anomaly episode

  // Instant demo fill + keep ticking until/unless live takes over.
  setSnap(mockSnapshot());
  setConn('mock');
  window.setInterval(() => {
    if (!gotLive) setSnap(mockSnapshot());
  }, 1000);

  const connect = () => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      window.setTimeout(connect, 4000);
      return;
    }

    ws.onmessage = (ev) => {
      let data: any;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (data && data.regime) {
        // Valid live snapshot.
        gotLive = true;
        setError(null);
        setConn('live');

        // ---- VOLARA-DBG: anomaly-triggered capture (one group per episode) ----
        const _vix = data.vol?.vix;
        const _bnf = data.secondary?.banknifty?.value;
        const isAnomaly = _bnf != null && (_bnf < 1000 || _bnf === _vix);
        if (isAnomaly && !anomalyLatched) {
          anomalyLatched = true;
          const secIdx = ev.data.indexOf('"secondary"');
          const vixIdx = ev.data.indexOf('"vix"');
          armCapture({                       // arm BEFORE setSnap so renders populate
            ws_raw: `vix=${vixIdx >= 0 ? ev.data.slice(vixIdx, vixIdx + 26) : 'n/a'}  ||  secondary=${secIdx >= 0 ? ev.data.slice(secIdx, secIdx + 180) : 'n/a'}`,
            ws_parsed: {
              vix: _vix, banknifty: data.secondary?.banknifty,
              finnifty: data.secondary?.finnifty, sensex: data.secondary?.sensex,
              banknifty_value_equals_vix: _bnf === _vix,
            },
            before: { banknifty: useTerminal.getState().snap?.secondary?.banknifty, vix: useTerminal.getState().snap?.vol?.vix },
          });
          setSnap(data as Snapshot);
          dbg.after = { banknifty: useTerminal.getState().snap?.secondary?.banknifty, vix: useTerminal.getState().snap?.vol?.vix };
        } else {
          if (!isAnomaly) anomalyLatched = false; // re-arm once a clean frame passes
          setSnap(data as Snapshot);
        }
      } else if (data && (data.error || data.traceback)) {
        // Instrumented backend error — surface it, but KEEP the last good live
        // snapshot on screen. Do NOT clear gotLive: once a live frame has
        // arrived we never resume the mock cold-start feed, so the snapshot
        // source stays single (the live socket). This prevents live frames from
        // interleaving with independent mock frames mid-stream, which is what
        // made the top bar briefly show mixed-frame / wrong values.
        setError(data as BackendError);
        setConn('error');
      }
    };

    ws.onclose = () => {
      if (!gotLive) setConn(useTerminal.getState().error ? 'error' : 'mock');
      window.setTimeout(connect, 4000); // keep trying to (re)establish live
    };
    ws.onerror = () => {
      /* onclose will handle retry */
    };
  };

  connect();
}
