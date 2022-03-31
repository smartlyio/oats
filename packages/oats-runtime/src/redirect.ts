import type { Response } from './server';
import escapeHtml = require('escape-html');

const REDIRECT_STATUSES = [300, 301, 302, 303, 305, 307, 308] as const;
const DEFAULT_REDIRECT_STATUS = 302;
const TEXT_HTML_CONTENT_TYPE = 'text/html';
const TEXT_PLAIN_CONTENT_TYPE = 'text/plain';

export type RedirectStatus = typeof REDIRECT_STATUSES[number];

type DefaultValue<ContentType extends string> = ContentType extends
  | typeof TEXT_HTML_CONTENT_TYPE
  | typeof TEXT_PLAIN_CONTENT_TYPE
  | `${typeof TEXT_HTML_CONTENT_TYPE};${string}`
  | `${typeof TEXT_PLAIN_CONTENT_TYPE};${string}`
  ? string
  : null;

/**
 * This hack is needed to use the provided generic types defaults rather than their inferred values.
 * For example, this should result in error because the default status is 302:
 * ```typescript
 * const response: Response<308, 'text/html', string, { Location: string }> = redirect('/');
 * ```
 * But it will pass if type inference is not prevented.
 */
type PreventGenericDefaultValueOverride<T> = [T][T extends unknown ? 0 : never];

export function redirect<
  Status extends RedirectStatus = typeof DEFAULT_REDIRECT_STATUS,
  ContentType extends string = typeof TEXT_HTML_CONTENT_TYPE,
  Value = DefaultValue<ContentType>
>(
  url: string,
  options: {
    status?: Status;
    contentType?: ContentType;
    value?: Value;
  } = {}
): Response<
  PreventGenericDefaultValueOverride<Status>,
  PreventGenericDefaultValueOverride<ContentType>,
  PreventGenericDefaultValueOverride<Value>,
  { Location: string }
> {
  const { status = DEFAULT_REDIRECT_STATUS as Status } = options;
  const encodedUrl = encodeURI(url);

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
  if (isContentType({ contentType, base: TEXT_HTML_CONTENT_TYPE })) {
    // In case automatic redirects are turned off, respond with a redirect link for the user to proceed.
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
