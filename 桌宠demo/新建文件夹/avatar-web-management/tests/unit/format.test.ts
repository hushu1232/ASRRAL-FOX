import { formatDate, formatDateTime, formatRelativeTime, truncate, formatFileSize } from '@/lib/format';

describe('formatDate', () => {
  it('formats a Date object', () => {
    const result = formatDate(new Date('2025-01-15T00:00:00Z'));
    expect(result).toMatch(/2025/);
  });

  it('formats an ISO string', () => {
    const result = formatDate('2025-06-01T12:00:00Z');
    expect(result).toMatch(/2025/);
  });

  it('formats a timestamp number', () => {
    const result = formatDate(1719705600000);
    expect(result).toBeTruthy();
    expect(result).not.toBe('Invalid Date');
  });

  it('returns "Invalid Date" for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('Invalid Date');
  });

  it('returns "Invalid Date" for NaN timestamp', () => {
    expect(formatDate(NaN)).toBe('Invalid Date');
  });
});

describe('formatDateTime', () => {
  it('includes time portion', () => {
    const result = formatDateTime(new Date('2025-03-20T14:30:00'));
    expect(result).toMatch(/2025/);
    // Should contain time characters (hour:minute separator or AM/PM)
    expect(result.length).toBeGreaterThan(8);
  });

  it('handles string input', () => {
    const result = formatDateTime('2025-01-01T08:00:00');
    expect(result).toBeTruthy();
  });

  it('returns "Invalid Date" for bad input', () => {
    expect(formatDateTime('invalid')).toBe('Invalid Date');
  });
});

describe('formatRelativeTime', () => {
  it('accepts string date input', () => {
    const result = formatRelativeTime(new Date(Date.now() - 30_000).toISOString());
    expect(result).toBeDefined();
    expect(result).not.toBe('Invalid Date');
  });

  it('accepts number timestamp input', () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const result = formatRelativeTime(fiveMinAgo);
    expect(result).toMatch(/分钟前/);
  });

  it('returns "刚刚" for very recent dates', () => {
    const now = new Date();
    const result = formatRelativeTime(now);
    expect(result).toBe('刚刚');
  });

  it('returns minutes ago format', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = formatRelativeTime(fiveMinAgo);
    expect(result).toMatch(/分钟前/);
  });

  it('returns hours ago format', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const result = formatRelativeTime(threeHoursAgo);
    expect(result).toMatch(/小时前/);
  });

  it('returns days ago format', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(twoDaysAgo);
    expect(result).toMatch(/天前/);
  });

  it('falls back to date format for old dates', () => {
    const longAgo = new Date('2020-01-01');
    const result = formatRelativeTime(longAgo);
    expect(result).toMatch(/2020/);
  });

  it('returns "Invalid Date" for invalid input', () => {
    expect(formatRelativeTime('not-a-date')).toBe('Invalid Date');
  });

  it('returns "Invalid Date" for NaN timestamp', () => {
    expect(formatRelativeTime(NaN)).toBe('Invalid Date');
  });
});

describe('truncate', () => {
  it('returns original string when within limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings with default suffix', () => {
    expect(truncate('hello world this is long', 10)).toBe('hello w...');
  });

  it('truncates with custom suffix', () => {
    expect(truncate('hello world this is long', 10, '…')).toBe('hello wor…');
  });

  it('handles exact length string', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });

  it('handles negative values', () => {
    expect(formatFileSize(-100)).toBe('0 B');
  });
});
