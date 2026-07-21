import { Page } from '@playwright/test';
import { dragMouse, assertVisible, assertHidden } from '../core/helpers';

export class RestTimerSheetPage {
  private rulerSelector = '[data-testid="rest-timer-ruler"]';
  private timeDisplaySelector = '[data-testid="rest-timer-time-display"]';
  private backdropSelector = '[data-testid="timer-picker-backdrop"]';

  constructor(private page: Page) {}

  async expectOpen() {
    await assertVisible(this.page, this.rulerSelector, {
      label: 'rest timer ruler visible',
      diagId: 'sheet_closed_on_web_drag',
    });
  }

  async expectClosed() {
    await assertHidden(this.page, this.rulerSelector, {
      label: 'rest timer ruler hidden',
      diagId: 'backdrop_tap_not_closing_sheet',
    });
  }

  async tapBackdrop() {
    // Tap outside the sheet card
    await this.page.click(this.backdropSelector, { position: { x: 20, y: 20 } });
  }

  async getSecondsText(): Promise<string> {
    const display = this.page.locator(this.timeDisplaySelector);
    const text = await display.innerText();
    return text.trim();
  }

  async dragRuler(dx: number) {
    const ruler = this.page.locator(this.rulerSelector);
    const box = await ruler.boundingBox();
    if (!box) {
      throw new Error('[E2E RestTimerSheetPage] Could not get bounding box for RestTimerRuler');
    }

    const from = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    const to = {
      x: from.x + dx,
      y: from.y,
    };

    // Use our custom interpolated dragMouse helper to trigger react-native-web's PanResponder
    await dragMouse(this.page, { from, to, steps: 10, delayMs: 15 });
  }

  expectValueChanged(oldValue: string, newValue: string) {
    if (oldValue === newValue) {
      throw new Error(`[DiagnosticError] sheet_closed_on_web_drag: Ruler drag had no effect on time display value (remained ${oldValue})`);
    }
  }
}
