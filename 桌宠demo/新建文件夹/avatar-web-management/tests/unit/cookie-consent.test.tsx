/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CookieConsent from '@/components/common/CookieConsent';

describe('CookieConsent', () => {
  beforeEach(() => localStorage.clear());

  it('shows the banner and persists accepting or rejecting optional cookies', async () => {
    const { unmount } = render(<CookieConsent />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    expect(localStorage.getItem('astralfox_cookie_consent')).toBe('accepted');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull());
    unmount();

    localStorage.clear();
    render(<CookieConsent />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject Optional' }));
    expect(localStorage.getItem('astralfox_cookie_consent')).toBe('rejected');
  });

  it('does not render after a stored choice exists', async () => {
    localStorage.setItem('astralfox_cookie_consent', 'accepted');
    render(<CookieConsent />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull());
  });
});
