export function assert(condition: any, msg: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

export function fail(msg: string): never {
  throw new Error(msg);
}
