/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import PetSetupReadiness from '@/components/pet/PetSetupReadiness';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.rich = (key: string, values: { link?: (chunks: ReactNode) => ReactNode }) => (
      <>
        {key}
        {values.link?.('download')}
      </>
    );
    return t;
  },
}));

jest.mock('@ant-design/icons', () => ({
  ApiOutlined: () => <span data-testid="icon-api" />,
  CheckCircleOutlined: () => <span data-testid="icon-check" />,
  DownloadOutlined: () => <span data-testid="icon-download" />,
  KeyOutlined: () => <span data-testid="icon-key" />,
  PlayCircleOutlined: () => <span data-testid="icon-play" />,
  RobotOutlined: () => <span data-testid="icon-robot" />,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

describe('PetSetupReadiness', () => {
  it('renders the compact setup readiness gates with the download link', () => {
    render(<PetSetupReadiness current={4} onDismiss={jest.fn()} />, { wrapper: Wrapper });

    expect(screen.getByText('wizard.title')).toBeDefined();
    for (const title of [
      'wizard.step1Title',
      'wizard.step2Title',
      'wizard.step3Title',
      'wizard.step4Title',
      'wizard.step5Title',
      'wizard.step6Title',
    ]) {
      expect(screen.getByText(title)).toBeDefined();
    }

    const link = screen.getByRole('link', { name: 'download' });
    expect(link.getAttribute('href')).toBe('/downloads');
  });

  it('calls onDismiss from the skip action', () => {
    const onDismiss = jest.fn();
    render(<PetSetupReadiness current={2} onDismiss={onDismiss} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'wizard.skip' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss from the alert close action', () => {
    const onDismiss = jest.fn();
    render(<PetSetupReadiness current={2} onDismiss={onDismiss} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('passes className and style to the alert root', () => {
    const { container } = render(
      <PetSetupReadiness
        current={2}
        onDismiss={jest.fn()}
        className="pet-readiness-extra"
        style={{ marginTop: 12 }}
      />,
      { wrapper: Wrapper },
    );

    const alert = container.querySelector('.pet-readiness-extra');
    expect(alert).toBeDefined();
    expect((alert as HTMLElement).style.marginTop).toBe('12px');
  });
});
