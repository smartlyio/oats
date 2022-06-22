import { getType } from './type-tag';

export function serialize(value: any): any {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v => serialize(v));
  }
  const types = getType(value);
  if (!types) {
    return value;
  }
  // get mapping from all types ts property names to network names
  const jointMap = types
    .flatMap(type => (type.type === 'object' ? [type] : []))
    .reduce<Map<string, string>>((memo, type) => {
      for (const key in type.properties) {
        const mapped = type.properties[key].networkName;
        if (mapped != null) {
          memo.set(key, mapped);
        }
      }
      return memo;
    }, new Map());
  // in case there are no network mapping done we can return immediately to avoid wasting a loop
  if (jointMap.size === 0) {
    return value;
  }
  // map value using jointMap
  return Object.entries(value).reduce<Record<string, any>>((memo, [key, prop]) => {
    const to = jointMap.get(key) ?? key;
    memo[to] = serialize(prop);
    return memo;
  }, {});
}
