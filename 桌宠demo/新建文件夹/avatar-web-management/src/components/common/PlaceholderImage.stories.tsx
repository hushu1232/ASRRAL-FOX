import type { Meta, StoryObj } from '@storybook/nextjs';
import PlaceholderImage from './PlaceholderImage';

const meta: Meta<typeof PlaceholderImage> = {
  title: 'Common/PlaceholderImage',
  component: PlaceholderImage,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PlaceholderImage>;

export const WithSrc: Story = {
  args: {
    src: 'https://picsum.photos/seed/avatar/200/200',
    alt: 'Test avatar',
    type: 'avatar',
    width: 200,
    height: 200,
  },
};

export const NoSource: Story = {
  args: {
    src: null,
    alt: 'Placeholder avatar',
    type: 'avatar',
    width: 200,
    height: 200,
  },
};

export const WithFallback: Story = {
  args: {
    src: 'https://invalid.example/nonexistent.jpg',
    alt: 'Broken image',
    type: 'model',
    width: 200,
    height: 200,
  },
};

export const Asset: Story = {
  args: {
    src: null,
    alt: 'Asset placeholder',
    type: 'asset',
    width: 200,
    height: 200,
  },
};

export const Template: Story = {
  args: {
    src: null,
    alt: 'Template placeholder',
    type: 'template',
    width: 200,
    height: 200,
  },
};
