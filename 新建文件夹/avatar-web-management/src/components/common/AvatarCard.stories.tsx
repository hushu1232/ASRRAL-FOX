import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from '@storybook/test';
import AvatarCard from './AvatarCard';
import type { Avatar } from '@/types/avatar';

const baseAvatar: Avatar = {
  id: 'avatar-001',
  workspace_id: 'ws-1',
  creator_id: 'user-1',
  name: '测试形象 01',
  style: 'anime',
  base_model: 'female',
  thumbnail_url: null,
  status: 'draft',
  current_version_id: null,
  is_template: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
};

const meta: Meta<typeof AvatarCard> = {
  title: 'Common/AvatarCard',
  component: AvatarCard,
  tags: ['autodocs'],
  argTypes: {
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof AvatarCard>;

export const Draft: Story = {
  args: {
    avatar: { ...baseAvatar, status: 'draft' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('草稿');
  },
};

export const Published: Story = {
  args: {
    avatar: { ...baseAvatar, status: 'published', name: '已发布形象' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('已发布');
  },
};

export const PendingReview: Story = {
  args: {
    avatar: {
      ...baseAvatar,
      status: 'pending_review' as Avatar['status'],
      name: '待审核形象',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('审核中');
  },
};

export const Clickable: Story = {
  args: {
    avatar: { ...baseAvatar, status: 'published' },
    onClick: (id) => {
      console.log('Clicked avatar:', id);
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByText('测试形象 01');
    await userEvent.click(card);
  },
};

export const MaleModel: Story = {
  args: {
    avatar: { ...baseAvatar, base_model: 'male', name: '男性形象' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByText('男');
  },
};
