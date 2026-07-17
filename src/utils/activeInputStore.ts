class ActiveInputStore {
  private listeners = new Set<(input: any) => void>();
  private activeInput: { exIdx: number; setIdx: number; fieldName: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps'; focusTime?: number } | null = null;

  subscribe(cb: (input: any) => void) {
    this.listeners.add(cb);
    cb(this.activeInput);
    return () => {
      this.listeners.delete(cb);
    };
  }

  setActiveInput(input: any) {
    this.activeInput = input;
    this.listeners.forEach(cb => cb(input));
  }

  getActiveInput() {
    return this.activeInput;
  }
}

export const activeInputStore = new ActiveInputStore();
