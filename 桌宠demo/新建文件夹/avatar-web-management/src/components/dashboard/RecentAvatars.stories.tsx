import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { App } from 'antd';
import RecentAvatars from './RecentAvatars';

const mockData = [
  { id: 'av-001', name: 'Anime Hero', style: 'anime', status: 'published', updated_at: '2025-06-15' },
  { id: 'av-002', name: 'Realistic Model', style: 'realistic', status: 'draft', updated_at: '2025-06-14' },
  { id: 'av-003', name: 'Chibi Character', style: 'chibi', status: 'pending_review', updated_at: '2025-06-13' },
];

const meta: Meta<typeof RecentAvatars> = {
  title: 'Dashboard/RecentAvatars',
  component: RecentAvatars,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <App>
        <div style={{ padding: 24, background: '#09090F' }}>
          <Story />
        </div>
      </App>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RecentAvatars>;

export const WithData: Story = {
  args: { data: mockData },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('Anime Hero');
    canvas.getByText('Realistic Model');
  },
};

export const Empty: Story = {
  args: { data: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText(/No avatars yet/);
  },
};

export const SingleItem: Story = {
  args: { data: [mockData[0]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('Anime Hero');
  },
};
