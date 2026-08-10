/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import OfflinePage from '@/app/offline/page';

describe('OfflinePage', () => {
  it('follows browser online and offline events', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    render(<OfflinePage />);
    expect(screen.getByText('连接已恢复')).toBeInTheDocument();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    fireEvent(window, new Event('offline'));
    expect(screen.getByText('网络连接断开')).toBeInTheDocument();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));
    expect(screen.getByText('连接已恢复')).toBeInTheDocument();
  });
});
