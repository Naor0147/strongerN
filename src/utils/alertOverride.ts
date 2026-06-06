import { Alert, AlertButton, AlertOptions } from 'react-native';

export interface CustomAlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

type AlertListener = (config: CustomAlertConfig) => void;

let activeListener: AlertListener | null = null;
const pendingAlerts: CustomAlertConfig[] = [];

/**
 * Registers the active listener to receive Alert.alert calls.
 * If there are any pending alerts, it will flush the latest one immediately.
 */
export function setAlertListener(listener: AlertListener | null) {
  activeListener = listener;
  if (listener && pendingAlerts.length > 0) {
    const next = pendingAlerts.shift();
    if (next) {
      listener(next);
    }
  }
}

// Override standard React Native Alert.alert
Alert.alert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) => {
  const config: CustomAlertConfig = { title, message, buttons, options };
  if (activeListener) {
    activeListener(config);
  } else {
    // Queue if alert is triggered before the root component finishes mounting/registering the listener
    pendingAlerts.push(config);
  }
};

