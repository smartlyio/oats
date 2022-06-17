import { getType } from './type-tag';

export function serialize(value: any): any {
  if (Array.isArray(value)) {
    return value.map(v => serialize(v));
  }
  const types = getType(value);
  if (!types) {
    return value;
  }
  return types.reduce((value, type) => {
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
  }, value);
}
