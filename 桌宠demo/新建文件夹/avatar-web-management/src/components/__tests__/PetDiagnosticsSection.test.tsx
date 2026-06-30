/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import PetDiagnosticsSection from '@/components/pet/sync/PetDiagnosticsSection';

jest.mock('@ant-design/icons', () => ({
  BugOutlined: () => <span data-testid="icon-bug" />,
  DownOutlined: () => <span data-testid="icon-down" />,
  UpOutlined: () => <span data-testid="icon-up" />,
}));

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      'pet.diagnostics': {
        title: 'Diagnostics and package simulation',
        description:
          'Simulation tools are hidden by default so live Alife .NET status stays first.',
        show: 'Show diagnostics',
        hide: 'Hide diagnostics',
      },
    };

    return (key: string) => messages[namespace]?.[key] ?? key;
  },
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

describe('PetDiagnosticsSection', () => {
  it('keeps diagnostics collapsed until the user expands them', () => {
    render(
      <PetDiagnosticsSection>
        <div>WebBridge package simulation</div>
      </PetDiagnosticsSection>,
      { wrapper: Wrapper },
    );

    const section = screen.getByTestId('pet-diagnostics-section');
    expect(section).toHaveAccessibleName('Diagnostics and package simulation');
    expect(screen.getByLabelText('Diagnostics and package simulation')).toBe(section);
    expect(screen.getByText('Diagnostics and package simulation')).toBeVisible();
    expect(
      screen.getByText(
        'Simulation tools are hidden by default so live Alife .NET status stays first.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('WebBridge package simulation')).not.toBeInTheDocument();

    const showButton = screen.getByRole('button', { name: /show diagnostics/i });
    expect(showButton).toHaveAttribute('aria-expanded', 'false');
    expect(showButton).toHaveAttribute('aria-controls', 'pet-diagnostics-content');

    fireEvent.click(showButton);

    const hideButton = screen.getByRole('button', { name: /hide diagnostics/i });
    expect(hideButton).toHaveAttribute('aria-expanded', 'true');
    expect(hideButton).toHaveAttribute('aria-controls', 'pet-diagnostics-content');
    expect(screen.getByText('WebBridge package simulation')).toBeVisible();
  });
});
