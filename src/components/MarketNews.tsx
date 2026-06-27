// Bottom market-news / flows ticker — institutional desk chrome.
const ITEMS: { label?: string; text: string; tone?: 'pos' | 'neg' | 'dim' }[] = [
  { label: 'FII FLOWS', text: '+₹1,246 Cr (Cash)', tone: 'pos' },
  { label: 'DII FLOWS', text: '+₹2,135 Cr (Cash)', tone: 'pos' },
  { text: 'RBI keeps repo rate unchanged at 6.50%', tone: 'dim' },
  { text: 'US CPI data in line with expectations', tone: 'dim' },
  { text: 'Crude prices fall on demand concerns', tone: 'neg' },
  { text: 'NIFTY holds above 24,000 support into expiry', tone: 'dim' },
  { text: 'Dollar index steady ahead of FOMC minutes', tone: 'dim' },
];

const tone = (t?: string) => (t === 'pos' ? 'var(--pos)' : t === 'neg' ? 'var(--neg)' : 'var(--dim)');

export function MarketNews() {
  const seq = [...ITEMS, ...ITEMS]; // duplicate for seamless loop
  return (
    <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-[color:var(--line)] bg-[color:var(--bg1)] pl-3">
      <span className="shrink-0 rounded-[4px] bg-[color:var(--gold)]/12 px-2 py-0.5 text-[9px] font-bold tracking-widest text-[color:var(--gold)]">
        MARKET NEWS
      </span>
      <div className="ticker-mask relative min-w-0 flex-1 overflow-hidden">
        <div className="ticker-track">
          {seq.map((it, i) => (
            <span key={i} className="mx-5 inline-flex items-center gap-2 text-[11px]">
              {it.label && <span className="eyebrow text-[8px]">{it.label}:</span>}
              <span style={{ color: tone(it.tone) }}>{it.text}</span>
              <span className="text-[color:var(--faint)]">•</span>
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
