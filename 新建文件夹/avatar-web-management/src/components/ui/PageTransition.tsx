'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { pageEnter } from '@/lib/motion';

/**
 * Wraps page content with a smooth fade+scale entrance.
 * Place at the top of each page: <PageTransition><YourPage /></PageTransition>
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) pageEnter(ref.current);
  }, []);

  return <div ref={ref}>{children}</div>;
}
