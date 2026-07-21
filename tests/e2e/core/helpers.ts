import { Page, expect } from '@playwright/test';
import { DiagnosisId } from './diagnoses';

interface Point {
  x: number;
  y: number;
}

/**
 * Simulates a mouse drag gesture by dispatching mousedown, moving in interpolated steps, and mouseup.
 * Essential for triggering react-native-web's PanResponder and replicating DOM events.
 */
export async function dragMouse(
  page: Page,
  options: { from: Point; to: Point; steps?: number; delayMs?: number }
): Promise<void> {
  const { from, to, steps = 10, delayMs = 15 } = options;

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(delayMs);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const currentX = from.x + (to.x - from.x) * t;
    const currentY = from.y + (to.y - from.y) * t;
    await page.mouse.move(currentX, currentY);
    await page.waitForTimeout(delayMs);
  }

  await page.mouse.up();
  await page.waitForTimeout(delayMs);
}

/**
 * Diagnostic assertion that throws a formatted DiagnosticError upon failure.
 */
export async function assertVisible(
  page: Page,
  selector: string,
  options: { label: string; diagId: DiagnosisId; timeout?: number }
): Promise<void> {
  const locator = page.locator(selector);
  try {
    await expect(locator).toBeVisible({ timeout: options.timeout ?? 5000 });
  } catch (error: any) {
    throw new Error(`[DiagnosticError] ${options.diagId}: Assertion '${options.label}' failed. Selector '${selector}' was not visible.`);
  }
}

/**
 * Diagnostic assertion that throws a formatted DiagnosticError upon failure.
 */
export async function assertHidden(
  page: Page,
  selector: string,
  options: { label: string; diagId: DiagnosisId; timeout?: number }
): Promise<void> {
  const locator = page.locator(selector);
  try {
    await expect(locator).toBeHidden({ timeout: options.timeout ?? 5000 });
  } catch (error: any) {
    throw new Error(`[DiagnosticError] ${options.diagId}: Assertion '${options.label}' failed. Selector '${selector}' was not hidden.`);
  }
}

