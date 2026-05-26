import { useState, useEffect } from 'react';

function formatDiff(ms) {
  if (ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 24) {
    const days = Math.floor(h / 24);
    return `${days}d ${pad(h % 24)}h`;
  }
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function CountdownTimer({ deadline }) {
  const [display, setDisplay] = useState(() => formatDiff(new Date(deadline) - Date.now()));

  useEffect(() => {
    const tick = () => setDisplay(formatDiff(new Date(deadline) - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!display) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-900/40 px-2 py-0.5 text-xs font-mono font-medium text-amber-400">
      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
      </svg>
      {display}
    </span>
  );
}
