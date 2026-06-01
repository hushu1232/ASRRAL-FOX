/**
 * @jest-environment jsdom
 */

import { trapFocus, getFocusableElements } from '@/lib/focus-manager';

describe('trapFocus', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <button id="first">First</button>
      <input id="middle" />
      <a href="#" id="last">Last</a>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('focuses the first focusable element on trap', () => {
    const cleanup = trapFocus(container);
    expect(document.activeElement).toBe(container.querySelector('#first'));
    cleanup();
  });

  it('traps Tab at the last element back to first', () => {
    const cleanup = trapFocus(container);
    const last = container.querySelector('#last') as HTMLElement;
    last.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    container.dispatchEvent(event);

    // After Tab on last, focus should move to first
    expect(document.activeElement).toBe(container.querySelector('#first'));
    cleanup();
  });

  it('returns cleanup that restores previous focus', () => {
    const previousButton = document.createElement('button');
    document.body.appendChild(previousButton);
    previousButton.focus();

    const cleanup = trapFocus(container);
    cleanup();

    expect(document.activeElement).toBe(previousButton);
    document.body.removeChild(previousButton);
  });
});

describe('getFocusableElements', () => {
  it('returns all focusable elements', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button>A</button><a href="#">B</a><input />';
    const elements = getFocusableElements(container);
    expect(elements).toHaveLength(3);
  });

  it('excludes disabled elements', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button>A</button><button disabled>B</button>';
    const elements = getFocusableElements(container);
    expect(elements).toHaveLength(1);
  });
});
