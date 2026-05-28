// eslint-disable-next-line import/no-nodejs-modules -- needed for multipart file uploads
import * as fs from 'fs';
import * as runtime from '@smartlyio/oats-runtime';
import type { APIRequestContext, APIResponse } from 'playwright';
import { fail } from './src/assert';

type PlaywrightFetchOptions = NonNullable<Parameters<APIRequestContext['fetch']>[1]>;
type PlaywrightFetchBody = Pick<PlaywrightFetchOptions, 'data' | 'form' | 'multipart'>;
type PlaywrightMultipart = Exclude<
  PlaywrightFetchBody['multipart'] & Record<string, unknown>,
  FormData
>;

function formBinaryOptions(options: runtime.make.FormBinary['options']): {
  filename?: string;
  contentType?: string;
} {
  if (options == null) {
    return {};
  }
  if (typeof options === 'string') {
    return { filename: options };
  }
  return {
    filename: options.filename,
    contentType: options.contentType
  };
}

function toMultipartValue(
  binary: runtime.make.Binary,
  options: runtime.make.FormBinary['options']
): PlaywrightMultipart[keyof PlaywrightMultipart] {
  if (binary instanceof runtime.make.FormBinary) {
    return toMultipartValue(binary.binary, binary.options);
  }
  if (binary instanceof runtime.make.File) {
    return fs.createReadStream(binary.path);
  }
  if (Buffer.isBuffer(binary)) {
    const { filename, contentType } = formBinaryOptions(options);
    return {
      name: filename ?? 'file',
      mimeType: contentType ?? 'application/octet-stream',
      buffer: binary
    };
  }
  return fail('unknown binary type for playwright multipart body');
}

function toRequestBody(
  data: runtime.server.RequestBody<any> | undefined
): PlaywrightFetchBody | undefined {
  if (data == null) {
    return undefined;
  }
  if (data.contentType === 'text/plain') {
    return { data: data.value };
  }
  if (data.contentType === 'application/json') {
    return { data: JSON.stringify(data.value) };
  }
  if (data.contentType === 'application/x-www-form-urlencoded') {
    return { form: data.value };
  }
  if (data.contentType === 'multipart/form-data') {
    const multipart: PlaywrightMultipart = {};
    Object.keys(data.value).forEach(key => {
      const element = data.value[key];
      if (element instanceof runtime.make.FormBinary) {
        multipart[key] = toMultipartValue(element.binary, element.options);
      } else {
        multipart[key] = element;
      }
    });
    return { multipart };
  }
  fail('unknown content type for playwright client ' + data.contentType);
}

function getContentType(response: APIResponse) {
  const type = response.headers()['content-type'];
  if (!type || type === runtime.noContentContentType) {
    return runtime.noContentContentType;
  }
  if (response.status() === 204) {
    return 'text/plain';
  }
  return type.split(';')[0].trim();
}

async function getResponseData(contentType: string, response: APIResponse) {
  if (contentType === runtime.noContentContentType) {
    return null;
  }
  if (response.status() === 204) {
    return '';
  }
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function abortError() {
  const error = new Error('This operation was aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw abortError();
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) {
    return promise;
  }
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort);
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

export interface PlaywrightAdapterOptions {
  /**
   * Whether to throw when response status is not 2xx or 3xx.
   * @default false
   */
  failOnStatusCode?: boolean;
}

/**
 * @returns oats runtime client adapter backed by Playwright {@link APIRequestContext}.
 */
export function create(
  request: APIRequestContext,
  { failOnStatusCode = false }: PlaywrightAdapterOptions = {}
): runtime.client.ClientAdapter {
  return async arg => {
    if (arg.servers.length !== 1) {
      return fail('cannot decide which server to use from ' + arg.servers.join(', '));
    }
    const server = arg.servers[0];
    const requestBody = toRequestBody(arg.body);
    const url = new URL(server + arg.path);
    const requestContentType = arg.body?.contentType;

    Object.entries(arg.query ?? {})
      .filter(([, value]) => !!value)
      .forEach(([key, value]) =>
        Array.isArray(value)
          ? value.forEach(v => url.searchParams.append(key, `${v}`))
          : url.searchParams.append(key, `${value}`)
      );

    const response = await abortable(
      request.fetch(url.toString(), {
        method: arg.method.toUpperCase(),
        headers: {
          ...(requestContentType ? { 'content-type': requestContentType } : {}),
          ...arg.headers
        },
        failOnStatusCode,
        ...requestBody
      }),
      arg.signal
    );

    const contentType = getContentType(response);

    return {
      status: response.status(),
      value: {
        contentType,
        value: await getResponseData(contentType, response)
      },
      headers: response.headers()
    };
  };
}
