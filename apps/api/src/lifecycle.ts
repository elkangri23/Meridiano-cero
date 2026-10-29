export interface RuntimeState { draining: boolean }
export function createShutdown(options: {
  state: RuntimeState;
  close: () => Promise<void>;
  force: () => void;
  failed: () => void;
  timeoutMs?: number;
}): () => Promise<void> {
  let pending: Promise<void> | undefined;
  return () => {
    if (!pending) {
      options.state.draining = true;
      let forced = false;
      const force = () => { if (!forced) { forced = true; options.force(); } };
      const timer = setTimeout(force, options.timeoutMs ?? 10_000);
      pending = Promise.resolve().then(options.close).catch(() => { options.failed(); force(); })
        .finally(() => { clearTimeout(timer); });
    }
    return pending;
  };
}
