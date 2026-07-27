// utils/toast.ts

export interface ToastConfig {
  id?: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

type ToastListener = (config: ToastConfig) => void;

class ToastManager {
  private listener: ToastListener | null = null;

  setListener(listener: ToastListener | null) {
    this.listener = listener;
  }

  show(message: string, type: ToastConfig['type'] = 'success', duration: number = 2500) {
    if (this.listener) {
      this.listener({ id: Date.now().toString(), message, type, duration });
    }
  }
}

export const toastManager = new ToastManager();

export function showToast(message: string, type: ToastConfig['type'] = 'success', duration: number = 2500) {
  toastManager.show(message, type, duration);
}
