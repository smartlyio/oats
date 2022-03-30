import type { Response } from './server';
import encodeUrl = require('encodeurl');
import escapeHtml = require('escape-html');

const REDIRECT_STATUSES = [300, 301, 302, 303, 305, 307, 308] as const;
const DEFAULT_REDIRECT_STATUS = 302;
const TEXT_HTML_CONTENT_TYPE = 'text/html';
const TEXT_PLAIN_CONTENT_TYPE = 'text/plain';

export type RedirectStatus = typeof REDIRECT_STATUSES[number];

export function redirect<
  Status extends RedirectStatus = typeof DEFAULT_REDIRECT_STATUS,
  ContentType extends string = typeof TEXT_HTML_CONTENT_TYPE,
  Value = string
>(
  url: string,
  options: {
    status?: Status;
    contentType?: ContentType;
    value?: Value;
  } = {}
): Response<Status, ContentType, Value, Record<string, any>> {
  const { status = DEFAULT_REDIRECT_STATUS as Status } = options;
  const encodedUrl = encodeUrl(url);

  if (!REDIRECT_STATUSES.includes(status)) {
    throw new Error(`Status "${status}" is not a redirect status.`);
  }

  const {
    contentType = TEXT_HTML_CONTENT_TYPE as ContentType,
    value = getDefaultRedirectValue({ encodedUrl, contentType }) as unknown as Value
  } = options;

  return {
    status,
    value: { contentType, value },
    headers: {
      Location: encodedUrl
    }
  };
}

function getDefaultRedirectValue({
  encodedUrl,
  contentType
}: {
  encodedUrl: string;
  contentType: string;
}) {
  // This is what Koa responds with. Maybe it is a good practice.
  if (isContentType({ contentType, base: TEXT_HTML_CONTENT_TYPE })) {
    const escapedUrl = escapeHtml(encodedUrl);
    return `Redirecting to <a href="${escapedUrl}">${escapedUrl}</a>.`;
  }
  if (isContentType({ contentType, base: TEXT_PLAIN_CONTENT_TYPE })) {
    return `Redirecting to ${encodedUrl}.`;
  }
  return null;
}

function isContentType({ contentType, base }: { contentType: string; base: string }) {
  return contentType === base || contentType.startsWith(base + ';');
}
