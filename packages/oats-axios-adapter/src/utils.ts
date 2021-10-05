/**
 * Use `URLSearchParams` instead of passing raw data to axios.
 * Otherwise axios will suffix array query parameters with "[]".
 * @see https://github.com/axios/axios/issues/2840
 */
export function urlSearchParamsSerializer(params: unknown) {
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
