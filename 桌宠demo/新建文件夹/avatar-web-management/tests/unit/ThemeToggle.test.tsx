/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useUIStore } from '@/stores/uiStore';

describe('ThemeToggle', () => {
  beforeEach(() => {
    useUIStore.setState({ themeMode: 'light' });
  });

  it('renders a button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('cycles theme on click: light -> dark', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(useUIStore.getState().themeMode).toBe('dark');
  });

  it('cycles theme on click: dark -> system', () => {
    useUIStore.setState({ themeMode: 'dark' });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(useUIStore.getState().themeMode).toBe('system');
  });
});
