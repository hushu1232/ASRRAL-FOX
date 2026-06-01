/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';
import PerformanceMonitor from '@/components/monitoring/PerformanceMonitor';

const mockOnCls = jest.fn();
const mockOnFcp = jest.fn();
const mockOnInp = jest.fn();
const mockOnLcp = jest.fn();
const mockOnTtfb = jest.fn();

jest.mock('web-vitals', () => ({
  onCLS: (cb: unknown) => { mockOnCls(cb); },
  onFCP: (cb: unknown) => { mockOnFcp(cb); },
  onINP: (cb: unknown) => { mockOnInp(cb); },
  onLCP: (cb: unknown) => { mockOnLcp(cb); },
  onTTFB: (cb: unknown) => { mockOnTtfb(cb); },
}));

describe('PerformanceMonitor', () => {
  it('renders nothing to the DOM', () => {
    const { container } = render(<PerformanceMonitor />);
    expect(container.firstChild).toBeNull();
  });

  it('registers web-vitals callbacks on mount', () => {
    render(<PerformanceMonitor />);
    // Each vitals hook is called at least once (React 18 strict mode may double-invoke)
    expect(mockOnCls).toHaveBeenCalled();
    expect(mockOnFcp).toHaveBeenCalled();
    expect(mockOnInp).toHaveBeenCalled();
    expect(mockOnLcp).toHaveBeenCalled();
    expect(mockOnTtfb).toHaveBeenCalled();
    // All callbacks receive a function
    expect(typeof mockOnCls.mock.calls[0][0]).toBe('function');
  });

  it('does not register additional callbacks on re-render', () => {
    const { rerender } = render(<PerformanceMonitor />);
    const countAfterFirst = mockOnCls.mock.calls.length;
    rerender(<PerformanceMonitor />);
    rerender(<PerformanceMonitor />);
    expect(mockOnCls).toHaveBeenCalledTimes(countAfterFirst);
  });
});
