import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { App } from 'antd';

function TestWrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

export function renderWithApp(ui: ReactNode, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: TestWrapper, ...options });
}
