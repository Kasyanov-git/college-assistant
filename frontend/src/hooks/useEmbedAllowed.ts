import { useEffect, useState } from 'react';
import type { EmbedDisplayMode } from '../config/kiosk';
import { withApiBase } from '../config/runtime';

interface EmbedCheckResult {
  loading: boolean;
  allowed: boolean;
  reason: string | null;
  useExternal: boolean;
}

export function useEmbedAllowed(
  url: string,
  mode: EmbedDisplayMode,
): EmbedCheckResult {
  const [state, setState] = useState<EmbedCheckResult>({
    loading: mode === 'auto',
    allowed: mode === 'iframe',
    reason: null,
    useExternal: mode === 'external',
  });

  useEffect(() => {
    const trimmed = url?.trim();
    if (!trimmed) {
      setState({ loading: false, allowed: false, reason: null, useExternal: false });
      return;
    }

    if (mode === 'external') {
      setState({ loading: false, allowed: false, reason: null, useExternal: true });
      return;
    }

    if (mode === 'iframe') {
      setState({ loading: false, allowed: true, reason: null, useExternal: false });
      return;
    }

    let cancelled = false;
    setState(s => ({ ...s, loading: true }));

    fetch(withApiBase(`/api/embed/can-frame?url=${encodeURIComponent(trimmed)}`))
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const allowed = Boolean(data?.allowed);
        setState({
          loading: false,
          allowed,
          reason: data?.reason ?? null,
          useExternal: !allowed,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          loading: false,
          allowed: false,
          reason: 'Не удалось проверить возможность встраивания',
          useExternal: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [url, mode]);

  return state;
}
