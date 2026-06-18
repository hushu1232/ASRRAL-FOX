/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import PlaceholderImage from '@/components/common/PlaceholderImage';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    return React.createElement('img', {
      src: props.src,
      alt: props.alt,
      width: props.width,
      height: props.height,
      onError: props.onError,
      ...Object.fromEntries(Object.entries(props).filter(([k]) => !['fill', 'priority', 'unoptimized', 'placeholder', 'blurDataURL', 'quality', 'loader', 'sizes'].includes(k))),
    });
  },
}));

describe('PlaceholderImage', () => {
  it('renders image with valid src', () => {
    render(<PlaceholderImage src="/test.png" alt="Test image" width={100} height={100} />);
    const img = screen.getByAltText('Test image');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('/test.png');
  });

  it('renders avatar fallback when src is null', () => {
    const { container } = render(<PlaceholderImage src={null} alt="Fallback" type="avatar" width={100} height={100} />);
    expect(container.querySelector('.placeholder-image--avatar')).not.toBeNull();
  });

  it('renders thumbnail fallback when src is undefined', () => {
    const { container } = render(<PlaceholderImage src={undefined} alt="Fallback" type="thumbnail" width={100} height={100} />);
    expect(container.querySelector('.placeholder-image--thumbnail')).not.toBeNull();
  });

  it('switches to fallback on image load error', () => {
    const { container } = render(<PlaceholderImage src="/broken.png" alt="Broken" type="asset" width={100} height={100} />);
    fireEvent.error(screen.getByAltText('Broken'));
    expect(container.querySelector('.placeholder-image--asset')).not.toBeNull();
  });

  it('uses different fallback classes per type', () => {
    const first = render(<PlaceholderImage src={null} alt="T1" type="avatar" width={100} height={100} />);
    expect(first.container.querySelector('.placeholder-image--avatar')).not.toBeNull();
    first.unmount();

    const second = render(<PlaceholderImage src={null} alt="T2" type="asset" width={100} height={100} />);
    expect(second.container.querySelector('.placeholder-image--asset')).not.toBeNull();
  });
});
