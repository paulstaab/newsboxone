interface ReadBatcherOptions {
  debounceMs?: number;
  onFlush: (ids: number[]) => void;
}

interface ReadBatcher {
  add: (id: number) => void;
  flush: () => void;
  clear: () => void;
}

export function createReadBatcher({ debounceMs = 100, onFlush }: ReadBatcherOptions): ReadBatcher {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pending = new Set<number>();

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    const ids = Array.from(pending);
    pending.clear();
    onFlush(ids);
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      flush();
    }, debounceMs);
  };

  return {
    add: (id) => {
      pending.add(id);
      schedule();
    },
    flush,
    clear: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending.clear();
    },
  };
}
