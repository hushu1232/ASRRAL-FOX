import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from '@storybook/test';
import { App } from 'antd';
import LoginForm from './LoginForm';

const meta: Meta<typeof LoginForm> = {
  title: 'Auth/LoginForm',
  component: LoginForm,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <App>
        <div style={{ background: '#09090F', minHeight: '100vh' }}>
          <Story />
        </div>
      </App>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LoginForm>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('Welcome Back');
    canvas.getByPlaceholderText('Email address');
    canvas.getByPlaceholderText('Password');
    canvas.getByText('Login');
    canvas.getByText(/Don't have an account/);
  },
};
