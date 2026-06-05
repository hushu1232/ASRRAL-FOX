import type { Meta, StoryObj } from '@storybook/nextjs';
import KpiCards from './KpiCards';

const meta: Meta<typeof KpiCards> = {
  title: 'Dashboard/KpiCards',
  component: KpiCards,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof KpiCards>;

export const Default: Story = {
  args: {
    totalAvatars: 42,
    createdThisMonth: 12,
    pendingReviews: 5,
    totalStorage: 450 * 1024 * 1024,
  },
};

export const Empty: Story = {
  args: {
    totalAvatars: 0,
    createdThisMonth: 0,
    pendingReviews: 0,
    totalStorage: 0,
  },
};

export const HighNumbers: Story = {
  args: {
    totalAvatars: 9999,
    createdThisMonth: 1234,
    pendingReviews: 89,
    totalStorage: 8 * 1024 * 1024 * 1024,
  },
};
