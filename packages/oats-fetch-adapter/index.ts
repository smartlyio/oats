import * as runtime from '@smartlyio/oats-runtime';
import { fail } from './src/assert';
import * as FormData from 'form-data';

function toRequestData(data: runtime.server.RequestBody<any> | undefined) {
  if (data == null) {
    return data;
  }
  if (data.contentType === 'text/plain') {
    return data.value;
  }
  if (data.contentType === 'application/json') {
    return JSON.stringify(data.value);
  }
  if (['application/x-www-form-urlencoded', 'multipart/form-data'].indexOf(data.contentType) >= 0) {
    const form = new FormData();
    Object.keys(data.value).forEach(key => {
      const element = data.value[key];
      if (element instanceof runtime.make.FormBinary) {
        form.append(key, element.binary, element.options);
      } else {
        form.append(key, element);
      }
    });
    return form;
  }
  fail('unknown content type for client ' + data.contentType);
}

function getContentType(response: Response) {
  const type = response.headers.get('content-type');
  if (!type || type === runtime.noContentContentType) {
    return runtime.noContentContentType;
  }
  if (response.status === 204) {
    return 'text/plain';
  }
  return type.split(';')[0].trim();
}

function getResponseData(contentType: string, response: Response) {
  if (contentType === runtime.noContentContentType || !response.body) {
    return null;
  }
  if (response.status === 204) {
    return '';
  }
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

/**
 * @returns oats runtime client adapter.
 */
export function create(init?: RequestInit): runtime.client.ClientAdapter {
  return async arg => {
    if (arg.servers.length !== 1) {
      return fail('cannot decide which server to use from ' + arg.servers.join(', '));
    }
    const server = arg.servers[0];
    const data = toRequestData(arg.body);
    const url = new URL(server + arg.path);
    const requestContentType = arg.body?.contentType;

    Object.entries(arg.query ?? {})
      .filter(([, value]) => !!value)
      .forEach(([key, value]) =>
        Array.isArray(value)
          ? value.forEach(v => url.searchParams.append(key, `${v}`))
          : url.searchParams.append(key, `${value}`)
      );

    const response = await fetch(
      new Request(url.toString(), {
        ...init,
        method: arg.method.toUpperCase(),
        headers: {
          ...(requestContentType ? { 'content-type': requestContentType } : {}),
          ...arg.headers
        },
        signal: arg.signal,
        body: data
      })
    );

    const contentType = getContentType(response);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => (headers[key] = value));

    return {
      status: response.status,
      value: {
        contentType,
        value: await getResponseData(contentType, response)
      },
      headers
    };
  };
}
