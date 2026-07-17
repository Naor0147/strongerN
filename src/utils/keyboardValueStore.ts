class KeyboardValueStore {
  private listeners = new Set<(val: string) => void>();
  private value: string = '';

  subscribe(cb: (val: string) => void) {
    this.listeners.add(cb);
    cb(this.value);
    return () => {
      this.listeners.delete(cb);
    };
  }

  setValue(val: string) {
    try {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark('keystroke-start');
      }
    } catch (_) {}
    this.value = val;
    this.listeners.forEach(cb => cb(val));
  }

  getValue() {
    return this.value;
  }
}

export const keyboardValueStore = new KeyboardValueStore();
