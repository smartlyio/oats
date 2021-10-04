import * as runtime from '@smartlyio/oats-runtime';
import * as FormData from 'form-data';
import * as assert from 'assert';
import globalAxios, { AxiosInstance, AxiosResponse } from 'axios';

function toRequestData(data: runtime.server.RequestBody<any> | undefined) {
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

export const bind: runtime.client.ClientAdapter = withAxios(globalAxios);

export function withAxios(axiosInstance: AxiosInstance): runtime.client.ClientAdapter {
  return async (
    arg: runtime.server.EndpointArg<any, any, any, any>
  ): Promise<runtime.server.Response<any, any, any, Record<string, any>>> => {
    if (arg.servers.length !== 1) {
      return assert.fail('cannot decide which server to use from ' + arg.servers.join(', '));
    }
    const server = arg.servers[0];
    const params = axiosToJson(arg.query);
    const data = toRequestData(arg.body);
    const url = server + arg.path;
    const headers = { ...arg.headers, ...(data instanceof FormData ? data.getHeaders() : {}) };
    const response = await axiosInstance.request({
      method: arg.method,
      headers,
      url,
      params,
      paramsSerializer: urlSearchParamsSerializer,
      data,
      validateStatus: () => true
    });
    const contentType = getContentType(response);
    return {
      status: response.status,
      value: {
        contentType,
        value: getResponseData(contentType, response)
      },
      headers: response.headers ?? {}
    };
  };
}

/**
 * Use `URLSearchParams` instead of passing raw data to axios.
 * Otherwise axios will suffix array query parameters with "[]".
 * @see https://github.com/axios/axios/issues/2840
 */
function urlSearchParamsSerializer(params: unknown) {
  if (typeof params !== 'object') {
    return String(params);
  }
  if (params === null) {
    return '';
  }
  if (params instanceof URLSearchParams) {
    return params.toString();
  }
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    const value = (params as Record<string, unknown>)[key];
    for (const item of ([] as unknown[]).concat(value)) {
      queryParams.append(key, String(item));
    }
  });
  return queryParams.toString();
}

function getContentType(response: AxiosResponse<any>) {
  const type = response.headers['content-type'];
  if (!type) {
    return runtime.noContentContentType;
  }
  if (response.status === 204) {
    return 'text/plain';
  }
  return type.split(';')[0].trim();
}

function getResponseData(contentType: string, response: AxiosResponse<any>) {
  if (contentType === runtime.noContentContentType) {
    if (!response.data) {
      return null;
    }
  }
  if (response.status === 204) {
    return '';
  }
  return response.data;
}
