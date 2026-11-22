import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './safeReturnPath';
import { facebookFailureMessage } from '../posts/facebookConnectedMessage';

describe('safeReturnPath', () => {
  it('returns the page the user was on', () => {
    expect(safeReturnPath({ from: '/posts?status=FAILED' })).toBe('/posts?status=FAILED');
    expect(safeReturnPath({ from: '/analytics/posts/123_456' })).toBe('/analytics/posts/123_456');
  });

  it.each([
    [undefined], [null], [{}], [{ from: 42 }], [{ from: 'https://evil.example/' }], [{ from: '//evil.example' }],
    [{ from: '/\\evil.example' }], [{ from: 'posts' }], [{ from: '/login' }], [{ from: '/login?next=/x' }],
    [{ from: '/reset-password?token=abc' }],
  ])('falls back to the dashboard for %j', state => {
    expect(safeReturnPath(state)).toBe('/');
  });
});

describe('facebookFailureMessage', () => {
  it('maps the backend reason code to fixed text', () => {
    expect(facebookFailureMessage(new URLSearchParams('facebook=failed&reason=no_page')))
      .toMatch(/^No Facebook Page connected/);
    expect(facebookFailureMessage(new URLSearchParams('facebook=failed&reason=cancelled')))
      .toBe('Facebook connection was cancelled.');
  });

  it('ignores free text in the URL (a crafted link cannot put its own words on screen)', () => {
    const params = new URLSearchParams('facebook=failed&message=Your account is suspended, call 555-0100');
    expect(facebookFailureMessage(params)).toBe('Facebook connection failed. Please try again.');
    expect(facebookFailureMessage(new URLSearchParams('facebook=failed&reason=<script>'))).toBe(
      'Facebook connection failed. Please try again.',
    );
  });
});
