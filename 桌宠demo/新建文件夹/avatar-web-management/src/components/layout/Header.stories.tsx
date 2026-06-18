import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { App } from 'antd';
import { useEffect } from 'react';
import Header from './Header';
import { useAuthStore } from '@/stores/authStore';

function SetupStore({ username = 'testuser', email = 'test@example.com' }: { username?: string; email?: string }) {
  useEffect(() => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        email,
        username,
        role: 'user',
        avatar_url: null,
        level: 1,
        exp: 0,
        activeTitle: null,
        unlockedTitles: [],
      },
    });
  }, [username, email]);
  return null;
}

const meta: Meta<typeof Header> = {
  title: 'Layout/Header',
  component: Header,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <App>
        <SetupStore />
        <div style={{ background: '#09090F' }}>
          <Story />
        </div>
      </App>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('testuser');
    canvas.getByPlaceholderText(/Ctrl\+K/i);
  },
};

export const WithEmailFallback: Story = {
  render: () => (
    <App>
      <SetupStore username="" email="user@example.com" />
      <div style={{ background: '#09090F' }}>
        <Header />
      </div>
    </App>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('user@example.com');
  },
};
