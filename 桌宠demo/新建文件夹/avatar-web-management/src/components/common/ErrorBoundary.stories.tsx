import type { Meta, StoryObj } from '@storybook/nextjs';
import ErrorBoundary from './ErrorBoundary';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Common/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

const ThrowError = ({ message }: { message?: string }) => {
  throw new Error(message || 'Test error message');
};

export const Normal: Story = {
  args: {
    children: <div className="text-white p-8">Normal content rendered successfully</div>,
  },
};

export const WithError: Story = {
  args: {
    children: <ThrowError message="Something went wrong loading the 3D model" />,
  },
};

export const CustomFallback: Story = {
  args: {
    children: <ThrowError />,
    fallback: (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-white">
        Custom fallback UI
      </div>
    ),
  },
};
