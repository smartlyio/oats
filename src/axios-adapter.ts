import * as runtime from './runtime';
import * as FormData from 'form-data';
import * as assert from 'assert';
import axios, { AxiosResponse } from 'axios';

function toAxiosData(data: runtime.server.RequestBody<any> | undefined) {
  if (data == null) {
    return data;
  }
  if (data.contentType === 'application/json') {
    return axiosToJson(data.value);
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
  assert.fail('unknown content type for axios client ' + data.contentType);
}

function axiosToJson(data: any) {
  if (data instanceof runtime.valueClass.ValueClass) {
    return runtime.valueClass.toJSON(data);
  }
  return data;
}

export const axiosAdapter: runtime.client.ClientAdapter = async (
  arg: runtime.server.EndpointArg<any, any, any, any>
): Promise<any> => {
  if (arg.servers.length !== 1) {
    return assert.fail('cannot decide which server to use from ' + arg.servers.join(', '));
  }
  const server = arg.servers[0];
  const params = axiosToJson(arg.query);
  const data = toAxiosData(arg.body);
  const url = server + arg.path;
  const headers = { ...arg.headers, ...(data instanceof FormData ? data.getHeaders() : {}) };
  const response = await axios.request({
    method: arg.method,
    headers,
    url,
    params,
    data,
    validateStatus: () => true
  });
  return {
    status: response.status,
    value: {
      contentType: getContentType(response),
      value: getResponseData(response)
    }
  };
};

function getContentType(response: AxiosResponse<any>) {
  if (response.status === 204) {
    return 'text/plain';
  }
  const type = response.headers['content-type'];
  return type.split(';')[0].trim();
}

function getResponseData(response: AxiosResponse<any>) {
  if (response.status === 204) {
    return '';
  }
  return response.data;
}
