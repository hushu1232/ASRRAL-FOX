/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import AvatarCard from '@/components/common/AvatarCard';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    const { fill, priority, unoptimized, placeholder, blurDataURL, quality, loader, sizes, onLoad, onError, ...rest } = props;
    void fill; void priority; void unoptimized; void placeholder; void blurDataURL; void quality; void loader; void sizes; void onLoad; void onError;
    return React.createElement('img', rest);
  },
}));

const mockAvatar = {
  id: 'av1',
  name: 'TestAvatar',
  style: 'anime',
  status: 'draft' as const,
  thumbnail_url: '/thumbs/av1.png',
  base_model: 'female' as const,
  created_at: '2026-05-01',
  updated_at: '2026-05-29',
  owner_id: 'user1',
  workspace_id: 'ws1',
};

describe('AvatarCard', () => {
  it('renders avatar name', () => {
    render(<AvatarCard avatar={mockAvatar} />);
    expect(screen.getByText('TestAvatar')).toBeDefined();
  });

  it('renders status tag', () => {
    render(<AvatarCard avatar={mockAvatar} />);
    expect(screen.getByText('草稿')).toBeDefined();
  });

  it('renders published status tag', () => {
    render(<AvatarCard avatar={{ ...mockAvatar, status: 'published' }} />);
    expect(screen.getByText('已发布')).toBeDefined();
  });

  it('renders pending_review status tag', () => {
    render(<AvatarCard avatar={{ ...mockAvatar, status: 'pending_review' }} />);
    expect(screen.getByText('审核中')).toBeDefined();
  });

  it('renders gender label', () => {
    render(<AvatarCard avatar={mockAvatar} />);
    expect(screen.getByText('gender.female')).toBeDefined();
  });

  it('renders male gender label', () => {
    render(<AvatarCard avatar={{ ...mockAvatar, base_model: 'male' as const }} />);
    expect(screen.getByText('gender.male')).toBeDefined();
  });

  it('calls onClick with avatar id when clicked', () => {
    const onClick = jest.fn();
    render(<AvatarCard avatar={mockAvatar} onClick={onClick} />);
    fireEvent.click(screen.getByText('TestAvatar').closest('.ant-card')!);
    expect(onClick).toHaveBeenCalledWith('av1');
  });

  it('renders with no thumbnail (fallback)', () => {
    render(<AvatarCard avatar={{ ...mockAvatar, thumbnail_url: null }} />);
    expect(screen.getByText('TestAvatar')).toBeDefined();
  });
});
