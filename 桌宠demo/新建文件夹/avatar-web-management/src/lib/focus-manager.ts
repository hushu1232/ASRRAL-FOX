/**
 * Focus management utilities for modals, drawers, and dialogs.
 * Implements focus trapping and restoration following WCAG 2.1.
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function trapFocus(container: HTMLElement): () => void {
  const previousFocus = document.activeElement as HTMLElement | null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  firstFocusable?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    previousFocus?.focus();
  };
}

export function restoreFocus(element: HTMLElement | null): void {
  element?.focus();
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}
