'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PictureOutlined, UserOutlined, FileOutlined } from '@ant-design/icons';
import './style.scss';

interface Props {
  src?: string | null;
  alt: string;
  type?: 'avatar' | 'asset' | 'thumbnail';
  width?: number;
  height?: number;
}

const iconMap: Record<string, React.ReactNode> = {
  avatar: <UserOutlined />,
  asset: <FileOutlined />,
  thumbnail: <PictureOutlined />,
};

export default function PlaceholderImage({ src, alt, type = 'thumbnail', width = 160, height = 160 }: Props) {
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="placeholder-image"
        onError={() => setHasError(true)}
        unoptimized={src.startsWith('blob:') || src.startsWith('data:')}
      />
    );
  }

  const cls = ['placeholder-image', `placeholder-image--${type}`].join(' ');

  return (
    <div className={cls} style={{ width, height }}>
      <span className="placeholder-image__icon">
        {iconMap[type] || iconMap.thumbnail}
      </span>
    </div>
  );
}
