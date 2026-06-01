import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from '@storybook/test';
import { App } from 'antd';
import RegisterForm from './RegisterForm';

const meta: Meta<typeof RegisterForm> = {
  title: 'Auth/RegisterForm',
  component: RegisterForm,
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
type Story = StoryObj<typeof RegisterForm>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('Create Your Account');
    canvas.getByPlaceholderText('Email address');
    canvas.getByPlaceholderText('Username');
    canvas.getByPlaceholderText('Password');
    canvas.getByPlaceholderText('Re-enter your password');
    canvas.getByText('Register');
    canvas.getByText(/Already have an account/);
  },
};
