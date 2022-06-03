import { getType } from './make';

export function serialize(value: any): any {
  if (Array.isArray(value)) {
    return value.map(v => serialize(v));
  }
  const type = getType(value);
  if (!type) {
    return value;
  }
  switch (type.type) {
    case 'object':
      return Object.keys(value).reduce<Record<string, any>>((memo, key) => {
        const prop = type.properties[key];
        const serialized = serialize(value[key]);
        if (prop && prop.networkName) {
          memo[prop.networkName] = serialized;
        } else {
          memo[key] = serialized;
        }
        return memo;
      }, {});
    default:
      return value;
  }
}
