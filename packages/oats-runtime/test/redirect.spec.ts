import { describe, it, expect } from '@jest/globals';
import type { RedirectStatus, Response } from '../src/server';
import { redirect } from '../src/redirect';

describe('redirect()', () => {
  it('does not accept non-redirect status', () => {
    expect(() => redirect('/', { status: 200 as RedirectStatus })).toThrow(
      'Status "200" is not a redirect status.'
    );
    expect(() => redirect('/', { status: 310 as RedirectStatus })).toThrow(
      'Status "310" is not a redirect status.'
    );
  });

  it('returns default redirect response when no options is provided', () => {
    const response = redirect('/');

    expect(response).toEqual({
      status: 302,
      value: { contentType: 'text/html', value: 'Redirecting to <a href="/">/</a>.' },
      headers: { Location: '/' }
    });
  });

  it('overrides default status and value', () => {
    const response = redirect('/', { status: 308, value: '' });

    expect(response).toEqual({
      status: 308,
      value: { contentType: 'text/html', value: '' },
      headers: { Location: '/' }
    });
  });

  it('does not override generic type default value', () => {
    const response1: Response<302, 'text/html', string, { Location: string }> = redirect('/');
    // @ts-expect-error
    const response2: Response<308, 'text/html', string, { Location: string }> = redirect('/');

    expect(response1).toBeTruthy();
    expect(response2).toBeTruthy();
  });

  it('overrides default "text/html" content type', () => {
    const response = redirect('/', { contentType: 'text/html; charset=utf-8' });

    expect(response).toEqual({
      status: 302,
      value: {
        contentType: 'text/html; charset=utf-8',
        value: 'Redirecting to <a href="/">/</a>.'
      },
      headers: { Location: '/' }
    });
  });

  it('changes the default response value when content type is not "text/html"', () => {
    const response = redirect('/', { contentType: 'text/plain' });

    expect(response).toEqual({
      status: 302,
      value: {
        contentType: 'text/plain',
        value: 'Redirecting to /.'
      },
      headers: { Location: '/' }
    });
  });

  it('sets default value as null in case of non-text content tyoe', () => {
    const response = redirect('/', { contentType: 'application/json' });

    expect(response).toEqual({
      status: 302,
      value: { contentType: 'application/json', value: null },
      headers: { Location: '/' }
    });
  });

  it('encodes url in the location header', () => {
    // Make sure it does not encode already encoded params.
    const alreadyEncodedParam = encodeURIComponent('&');
    const toEncode = ' \u0439';
    const response = redirect(
      `https://www.example.com/?param=,;=${toEncode}&alreadyEncodedParam=${alreadyEncodedParam}`,
      {
        contentType: 'text/plain'
      }
    );
    const encodedUrl = `https://www.example.com/?param=,;=${encodeURIComponent(
      toEncode
    )}&alreadyEncodedParam=${alreadyEncodedParam}`;

    expect(response).toEqual({
      status: 302,
      value: {
        contentType: 'text/plain',
        value: `Redirecting to ${encodedUrl}.`
      },
      headers: { Location: encodedUrl }
    });
  });

  it('escapes url in html response', () => {
    const response = redirect('https://www.example.com/?a= &b');
    const encodedUrl = 'https://www.example.com/?a=%20&b';
    const escapedUrl = 'https://www.example.com/?a=%20&amp;b';

    expect(response).toEqual({
      status: 302,
      value: {
        contentType: 'text/html',
        value: `Redirecting to <a href="${escapedUrl}">${escapedUrl}</a>.`
      },
      headers: { Location: encodedUrl }
    });
  });
});
