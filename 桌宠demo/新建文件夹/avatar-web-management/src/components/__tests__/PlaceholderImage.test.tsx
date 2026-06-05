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

  it('renders fallback when src is null', () => {
    render(<PlaceholderImage src={null} alt="Fallback" type="avatar" width={100} height={100} />);
    const img = screen.getByAltText('Fallback');
    expect(img.getAttribute('src')).toBe('/images/placeholder-avatar.svg');
  });

  it('renders fallback when src is undefined', () => {
    render(<PlaceholderImage src={undefined} alt="Fallback" type="model" width={100} height={100} />);
    const img = screen.getByAltText('Fallback');
    expect(img.getAttribute('src')).toBe('/images/placeholder-model.svg');
  });

  it('switches to fallback on image load error', () => {
    render(<PlaceholderImage src="/broken.png" alt="Broken" type="asset" width={100} height={100} />);
    const img = screen.getByAltText('Broken');
    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe('/images/placeholder-asset.svg');
  });

  it('uses different fallback per type', () => {
    const { unmount } = render(<PlaceholderImage src={null} alt="T1" type="template" width={100} height={100} />);
    expect(screen.getByAltText('T1').getAttribute('src')).toBe('/images/placeholder-template.svg');
    unmount();

    render(<PlaceholderImage src={null} alt="T2" type="asset" width={100} height={100} />);
    expect(screen.getByAltText('T2').getAttribute('src')).toBe('/images/placeholder-asset.svg');
  });

  it('uses custom fallbackSrc when provided', () => {
    render(<PlaceholderImage src={null} alt="Custom" fallbackSrc="/custom.svg" width={100} height={100} />);
    expect(screen.getByAltText('Custom').getAttribute('src')).toBe('/custom.svg');
  });
});
