import { create } from 'zustand';
import type { Snapshot, ConnState } from './types';
import { mockSnapshot } from './mock';

const WS_URL =
  (import.meta as any).env?.VITE_WS_URL ||
  `ws://${location.hostname}:8000/ws/stream`;

interface TerminalState {
  snap: Snapshot | null;
  prev: Snapshot | null;
  conn: ConnState;
  setSnap: (s: Snapshot) => void;
  setConn: (c: ConnState) => void;
}

export const useTerminal = create<TerminalState>((set, get) => ({
  snap: null,
  prev: null,
  conn: 'connecting',
  setSnap: (s) => set({ snap: s, prev: get().snap }),
  setConn: (c) => set({ conn: c }),
}));

// Connect to the live backend; fall back to the in-browser mock so the
// terminal is never empty. Auto-reconnects; once a real frame arrives we stop
// the mock loop.
export function startFeed() {
  const { setSnap, setConn } = useTerminal.getState();
  let mockTimer: number | null = null;
  let gotLive = false;

  const startMock = () => {
    if (mockTimer !== null) return;
    setConn((useTerminal.getState().conn === 'live' ? 'live' : 'mock'));
    const loop = () => {
      if (!gotLive) setSnap(mockSnapshot());
      mockTimer = window.setTimeout(loop, 1000);
    };
    loop();
  };

  const connect = () => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      startMock();
      return;
    }

    const giveUp = window.setTimeout(() => {
      if (!gotLive) startMock();
    }, 2500);

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data && data.regime) {
          gotLive = true;
          window.clearTimeout(giveUp);
          if (mockTimer !== null) {
            window.clearTimeout(mockTimer);
            mockTimer = null;
          }
          setConn('live');
          setSnap(data as Snapshot);
        }
      } catch {
        /* ignore malformed frame */
      }
    };

    ws.onerror = () => {
      if (!gotLive) startMock();
    };
    ws.onclose = () => {
      if (!gotLive) startMock();
      // try to re-establish a live link periodically
      window.setTimeout(connect, 4000);
    };
  };

  connect();
}
