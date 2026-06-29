/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import PetPreviewCard from '@/components/pet/PetPreviewCard';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string, values?: Record<string, string>) => {
      if (namespace === 'pet' && key === 'preview.label' && values?.name) {
        return `preview.label:${values.name}`;
      }

      return key;
    };

    return t;
  },
}));

jest.mock('@ant-design/icons', () => ({
  LinkOutlined: () => <span data-testid="icon-link" />,
  PictureOutlined: () => <span data-testid="icon-picture" />,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

describe('PetPreviewCard', () => {
  it('renders the existing pet preview details with bound avatar state', () => {
    render(
      <PetPreviewCard
        config={{
          id: 'cfg_1',
          pet_name: 'Nova',
          animation_model: 'live2d',
          avatar_id: 'avatar_1',
          idle_timeout: 300,
          wander_interval: 30,
        }}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('preview.webPreview')).toBeInTheDocument();
    const panel = screen.getByText('preview.webPreview').closest('.ant-card') as HTMLElement;
    expect(panel).toHaveStyle({ maxWidth: '100%' });
    expect(screen.getByTestId('icon-picture')).toBeInTheDocument();
    expect(screen.getByText('preview.label:Nova')).toBeInTheDocument();
    expect(screen.getByText('preview.tip')).toBeInTheDocument();
    expect(screen.getByText('preview.bound')).toBeInTheDocument();
    expect(screen.getByText('LIVE2D')).toBeInTheDocument();
    expect(screen.getByText('300s')).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
  });
});
