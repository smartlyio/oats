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
          const networkProp = prop && prop.networkName ? prop.networkName : key;
          // serializing the same value multiple times is ok but unnecessary so long
          // as the mappings in different objects match. If that is not the case we are screwed.
          if (memo[networkProp] === undefined) {
            memo[networkProp] = serialize(value[key]);
          }
          return memo;
        }, {});
      default:
        return value;
    }
  }, value);
}
