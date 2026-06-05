const cdnBase = process.env.NEXT_PUBLIC_CDN_URL?.replace(/\/$/, '') || '';

export function cdnUrl(path: string): string {
  if (!cdnBase || !path) return path;
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  return `${cdnBase}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function getCdnBase(): string {
  return cdnBase;
}

export function isCdnEnabled(): boolean {
  return cdnBase.length > 0;
}
