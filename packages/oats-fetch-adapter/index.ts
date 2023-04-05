import * as runtime from '@smartlyio/oats-runtime';
import { fail } from './src/assert';
import * as FormData from 'form-data';

function toRequestData(data: runtime.server.RequestBody<any> | undefined) {
  if (data == null) {
    return data;
  }
  if (data.contentType === 'application/json') {
    return dataToJson(data.value);
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

function dataToJson(data: any) {
  if (data instanceof runtime.valueClass.ValueClass) {
    return runtime.valueClass.toJSON(data);
  }
  return data;
}

export const bind: runtime.client.ClientAdapter = async (
  arg: runtime.server.EndpointArg<any, any, any, any>
): Promise<any> => {
  if (arg.servers.length !== 1) {
    return fail('cannot decide which server to use from ' + arg.servers.join(', '));
  }
  const server = arg.servers[0];
  const params = dataToJson(arg.query);
  const data = toRequestData(arg.body);
  const url = new URL(server + arg.path);

  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, `${value}`));

  const response = await fetch(
    new Request(url.toString(), {
      method: arg.method,
      headers: arg.headers,
      body: data
    })
  );
  const contentType = getContentType(response);
  return {
    status: response.status,
    value: {
      contentType,
      value: await getResponseData(contentType, response)
    }
  };
};

function getContentType(response: Response) {
  const type = response.headers.get('content-type');
  if (!type) {
    return runtime.noContentContentType;
  }
  if (response.status === 204) {
    return 'text/plain';
  }
  return type.split(';')[0].trim();
}

function getResponseData(contentType: string, response: Response) {
  if (contentType === runtime.noContentContentType) {
    if (!response.body) {
      return null;
    }
  }
  if (response.status === 204) {
    return '';
  }
  return response.json();
}
