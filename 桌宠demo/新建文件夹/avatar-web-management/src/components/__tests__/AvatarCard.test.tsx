/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import AvatarCard from '@/components/common/AvatarCard';
import { AVATAR_STATUS_MAP, AVATAR_STYLES } from '@/lib/constants';
import type { Avatar } from '@/types/avatar';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    const { fill, priority, unoptimized, placeholder, blurDataURL, quality, loader, sizes, onLoad, onError, ...rest } = props;
    void fill; void priority; void unoptimized; void placeholder; void blurDataURL; void quality; void loader; void sizes; void onLoad; void onError;
    return React.createElement('img', rest);
  },
}));

const mockAvatar: Avatar = {
  id: 'av1',
  name: 'TestAvatar',
  style: 'anime',
  status: 'draft',
  thumbnail_url: '/thumbs/av1.png',
  base_model: 'female',
  created_at: '2026-05-01',
  updated_at: '2026-05-29',
  creator_id: 'user1',
  workspace_id: 'ws1',
  current_version_id: null,
  is_template: false,
};

describe('AvatarCard', () => {
  it('renders avatar name', () => {
    render(<AvatarCard avatar={mockAvatar} />);
    expect(screen.getByText('TestAvatar')).toBeDefined();
  });

  it('renders draft status tag', () => {
    render(<AvatarCard avatar={mockAvatar} />);
    expect(screen.getByText(AVATAR_STATUS_MAP.draft.label)).toBeDefined();
  });

  it('renders published status tag', () => {
    render(<AvatarCard avatar={{ ...mockAvatar, status: 'published' }} />);
    expect(screen.getByText(AVATAR_STATUS_MAP.published.label)).toBeDefined();
  });

  it('renders archived status tag', () => {
    render(<AvatarCard avatar={{ ...mockAvatar, status: 'archived' }} />);
    expect(screen.getByText(AVATAR_STATUS_MAP.archived.label)).toBeDefined();
  });

  it('renders style label', () => {
    render(<AvatarCard avatar={mockAvatar} />);
    expect(screen.getByText(AVATAR_STYLES.find((item) => item.value === 'anime')!.label)).toBeDefined();
  });

  it('calls onClick with avatar id when clicked', () => {
    const onClick = jest.fn();
    render(<AvatarCard avatar={mockAvatar} onClick={onClick} />);
    fireEvent.click(screen.getByText('TestAvatar').closest('.ant-card')!);
    expect(onClick).toHaveBeenCalledWith('av1');
  });

  it('renders with no thumbnail', () => {
    render(<AvatarCard avatar={{ ...mockAvatar, thumbnail_url: null }} />);
    expect(screen.getByText('TestAvatar')).toBeDefined();
  });
});
