// TEMPORARY anomaly-triggered capture for the BankNifty/VIX value shift.
// When the WS handler sees an anomalous frame it arms a capture; TopBar and
// Sidebar write their render snapshot into it; a deferred flush prints ONE
// grouped block per anomaly. Remove once the faulty layer is found.
interface Capture {
  armed: boolean;
  id: number;
  ws_raw?: string;
  ws_parsed?: unknown;
  before?: unknown;
  after?: unknown;
  topbar?: unknown;
  sidebar?: unknown;
}

export const dbg: Capture = { armed: false, id: 0 };

export function armCapture(payload: { ws_raw: string; ws_parsed: unknown; before: unknown }) {
  dbg.id += 1;
  dbg.armed = true;
  dbg.ws_raw = payload.ws_raw;
  dbg.ws_parsed = payload.ws_parsed;
  dbg.before = payload.before;
  dbg.after = undefined;
  dbg.topbar = undefined;
  dbg.sidebar = undefined;
  // Flush after React has re-rendered TopBar + Sidebar from this snapshot.
  setTimeout(() => {
    console.group(`%c[VOLARA-DBG ANOMALY #${dbg.id}] banknifty shifted`, 'color:#f04668;font-weight:bold');
    console.log('1) WS raw json        :', dbg.ws_raw);
    console.log('2) WS parsed          :', dbg.ws_parsed);
    console.log('3) store BEFORE setSnap:', dbg.before);
    console.log('4) store AFTER  setSnap:', dbg.after);
    console.log('5) TopBar render      :', dbg.topbar ?? '(TopBar did not render)');
    console.log('6) Sidebar render     :', dbg.sidebar ?? '(Sidebar did not render)');
    console.groupEnd();
    dbg.armed = false;
  }, 80);
}
