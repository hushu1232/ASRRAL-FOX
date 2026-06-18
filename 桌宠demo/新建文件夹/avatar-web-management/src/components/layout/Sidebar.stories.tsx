import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { App } from 'antd';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

function SetupStore({ collapsed = false, role = 'user' }: { collapsed?: boolean; role?: string }) {
  useEffect(() => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        role,
        avatar_url: null,
        level: 1,
        exp: 0,
        activeTitle: null,
        unlockedTitles: [],
      },
    });
    useUIStore.setState({ sidebarCollapsed: collapsed });
  }, [collapsed, role]);
  return null;
}

const meta: Meta<typeof Sidebar> = {
  title: 'Layout/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', background: '#0d0d24' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {
  render: () => (
    <App>
      <SetupStore />
      <Sidebar />
    </App>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('Dashboard');
    canvas.getByText('Avatars');
    canvas.getByText('Assets');
  },
};

export const Collapsed: Story = {
  render: () => (
    <App>
      <SetupStore collapsed />
      <Sidebar />
    </App>
  ),
};

export const AdminUser: Story = {
  render: () => (
    <App>
      <SetupStore role="super_admin" />
      <Sidebar />
    </App>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('Admin');
  },
};

export const RegularUser: Story = {
  render: () => (
    <App>
      <SetupStore role="user" />
      <Sidebar />
    </App>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const adminLink = canvas.queryByText('Admin');
    if (adminLink) throw new Error('Admin link should not be visible for regular users');
  },
};
