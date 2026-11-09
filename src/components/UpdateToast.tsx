import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

// Registers the service worker and, when a new version is deployed, shows a
// small toast letting the user reload into it — instead of silently serving a
// stale cached app until they happen to refresh.
export function UpdateToast() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    updateRef.current = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => { setOfflineReady(true); window.setTimeout(() => setOfflineReady(false), 4000); },
    });
  }, []);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', left: 16, bottom: 16, zIndex: 200, maxWidth: 'calc(100vw - 32px)',
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)',
    }}>
      {needRefresh ? (
        <>
          <span style={{ fontSize: 14 }}>A new version is available.</span>
          <button className="btn btn-sm btn-primary" onClick={() => updateRef.current?.(true)}>Reload</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setNeedRefresh(false)}>Later</button>
        </>
      ) : (
        <span style={{ fontSize: 14 }}>Ready to work offline.</span>
      )}
    </div>
  );
}
