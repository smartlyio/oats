import * as server from './server';
import * as client from './client';
import * as make from './make';
import * as valueClass from './value-class';
import * as reflection from './reflection-type';

export { make, server, client, valueClass, reflection };

export const noContentContentType = 'oatsNoContent' as const;

export function setHeaders<
  Status extends number,
  ConntentType,
  Value,
  Headers extends Record<string, any>
>(
  response: server.Response<Status, ConntentType, Value, Record<string, any>>,
  headers: Headers
): server.Response<Status, ConntentType, Value, Headers> {
  return { ...response, headers };
}

export function noContent<Status extends number>(
  status: Status
): server.Response<Status, typeof noContentContentType, null, Record<string, any>> {
  return {
    status,
    value: { contentType: noContentContentType, value: null },
    headers: {}
  };
}

export function json<Status extends number, Value>(
  status: Status,
  value: Value
): server.Response<Status, 'application/json', Value, Record<string, any>> {
  return {
    status,
    value: { contentType: 'application/json', value },
    headers: {}
  };
}

export function text<Status extends number, Value>(
  status: Status,
  value: Value
): server.Response<Status, 'text/plain', Value, Record<string, any>> {
  return {
    status,
    value: { contentType: 'text/plain', value },
    headers: {}
  };
}

export function set<Cls>(
  to: Cls,
  set: Cls extends valueClass.ValueClass<infer Shape, any> ? Partial<Shape> : never
): make.Make<Cls> {
  return (to as any).constructor.make({ ...to, ...set });
}

type ValueType =
  | valueClass.ValueClass<any, any>
  | { [key: string]: any }
  | readonly any[]
  | string
  | boolean
  | number;

export function map<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T,
  fn: (p: T, traversalPath: string[]) => T
): A {
  return mapInternal(value, predicate, fn, []);
}

function mapInternal<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T,
  fn: (p: T, traversalPath: string[]) => T,
  traversalPath: string[]
): A {
  if (predicate(value)) {
    value = fn(value, traversalPath) as any;
  }
  if (Array.isArray(value)) {
    const arr: any = value.map((item, index) =>
      mapInternal(item, predicate, fn, traversalPath.concat(String(index)))
    );
    return selectArray(value, arr) as any;
  }
  if (value && typeof value === 'object') {
    const record: any = {};
    Object.keys(value).map(key => {
      record[key] = mapInternal((value as any)[key], predicate, fn, traversalPath.concat(key));
    });
    return selectRecord(value, record);
  }
  return value;
}

export function getAll<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T
): readonly T[] {
  return getAllInternal(value, predicate);
}

function getAllInternal<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T
): readonly T[] {
  const match: T[] = [];
  if (predicate(value)) {
    match.push(value);
  }
  if (Array.isArray(value)) {
    return [
      ...match,
      ...value.reduce((acc, item) => acc.concat(getAllInternal(item, predicate)), [])
    ];
  }
  if (value && typeof value === 'object') {
    return [
      ...match,
      ...Object.values(value).reduce((acc, item) => acc.concat(getAllInternal(item, predicate)), [])
    ];
  }
  return match;
}

export async function pmap<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T,
  map: (p: T, traversalPath: string[]) => Promise<T>
): Promise<A> {
  return pmapInternal(value, predicate, map, []);
}

function isPromise(p: any): p is Promise<any> {
  return p && typeof p.then === 'function';
}

function pmapInternal<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T,
  map: (p: T, traversalPath: string[]) => Promise<T>,
  traversalPath: string[]
): Promise<A> | A {
  if (predicate(value)) {
    value = map(value, traversalPath) as any;
  }
  if (isPromise(value)) {
    return value.then(n => pmapComposite(n, predicate, map, traversalPath));
  }
  return pmapComposite(value, predicate, map, traversalPath);
}

function selectArray<T>(original: T[], newArray: T[]): T[] {
  for (let i = 0; i < original.length; i++) {
    if (original[i] !== newArray[i]) {
      return newArray;
    }
  }
  return original.length !== newArray.length ? newArray : original;
}

function selectRecord<T extends { [key: string]: unknown }>(original: T, newRecord: T) {
  const changed = Object.keys(original).some(key => {
    return original[key] !== newRecord[key];
  });
  if (!changed) {
    return original;
  }
  if (original instanceof valueClass.ValueClass) {
    return set<valueClass.ValueClass<any, any>>(original, newRecord).success();
  }
  return newRecord;
}

function pmapArray<A, T>(
  value: A[],
  predicate: (v: any) => v is T,
  map: (v: T, traversalPath: string[]) => Promise<T>,
  traversalPath: string[]
): Promise<A[]> | A[] {
  const mapped = value.map((n, i) =>
    pmapInternal<A, T>(n, predicate, map, traversalPath.concat(String(i)))
  );
  if (mapped.some(isPromise)) {
    return Promise.all(mapped).then(newValues => {
      return selectArray(value, newValues);
    });
  }
  return selectArray<A>(value, mapped as any);
}

function pmapObject<A, T>(
  value: A,
  predicate: (v: any) => v is T,
  map: (v: T, traversalPath: string[]) => Promise<T>,
  traversalPath: string[]
): Promise<A> | A {
  const record: any = {};
  const promises: Array<Promise<unknown>> = [];
  Object.keys(value).forEach(key => {
    const v = pmapInternal((value as any)[key], predicate, map, traversalPath.concat(key));
    if (isPromise(v)) {
      promises.push(
        v.then(result => {
          record[key] = result;
        })
      );
    } else {
      record[key] = v;
    }
  });

  if (promises.length) {
    return Promise.all(promises).then(() => selectRecord(value, record));
  }
  return selectRecord(value, record);
}

function pmapComposite<A, T>(
  value: A,
  predicate: (v: any) => v is T,
  map: (v: T, traversalPath: string[]) => Promise<T>,
  traversalPath: string[]
): Promise<A> | A {
  if (Array.isArray(value)) {
    return pmapArray(value, predicate, map, traversalPath) as any;
  }
  if (value && typeof value === 'object') {
    return pmapObject(value, predicate, map, traversalPath);
  }
  return value;
}
