import * as server from './server';
import * as client from './client';
import * as make from './make';
import * as valueClass from './value-class';
import * as reflection from './reflection-type';

export { make, server, client, valueClass, reflection };

export function json<Status extends number, Value>(
  status: Status,
  value: Value
): server.Response<Status, 'application/json', Value> {
  return {
    status,
    value: {
      contentType: 'application/json',
      value
    }
  };
}

export function text<Status extends number, Value>(
  status: Status,
  value: Value
): server.Response<Status, 'text/plain', Value> {
  return {
    status,
    value: {
      contentType: 'text/plain',
      value
    }
  };
}

export function set<Cls extends valueClass.ValueClass<Shape, any>, Shape>(
  to: Cls,
  set: Partial<Shape>
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
  fn: (p: T) => T
): A {
  if (predicate(value)) {
    value = fn(value) as any;
  }
  if (Array.isArray(value)) {
    const arr: any = value.map(item => map(item, predicate, fn));
    return selectArray(value, arr) as any;
  }
  if (value && typeof value === 'object') {
    const record: any = {};
    Object.keys(value).map(key => {
      record[key] = map((value as any)[key], predicate, fn);
    });
    return selectRecord(value, record);
  }
  return value;
}

export async function pmap<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T,
  map: (p: T) => Promise<T>
): Promise<A> {
  return pmapInternal(value, predicate, map);
}

function isPromise(p: any): p is Promise<any> {
  return p && typeof p.then === 'function';
}

function pmapInternal<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T,
  map: (p: T) => Promise<T>
): Promise<A> | A {
  if (predicate(value)) {
    value = map(value) as any;
  }
  if (isPromise(value)) {
    return value.then(n => pmapComposite(n, predicate, map));
  }
  return pmapComposite(value, predicate, map);
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
    return set(original, newRecord).success();
  }
  return newRecord;
}

function pmapArray<A, T>(
  value: A[],
  predicate: (v: any) => v is T,
  map: (v: T) => Promise<T>
): Promise<A[]> | A[] {
  const mapped = value.map(n => pmapInternal<A, T>(n, predicate, map));
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
  map: (v: T) => Promise<T>
): Promise<A> | A {
  const record: any = {};
  const promises: Array<Promise<unknown>> = [];
  Object.keys(value).forEach(key => {
    const v = pmapInternal((value as any)[key], predicate, map);
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
  map: (v: T) => Promise<T>
): Promise<A> | A {
  if (Array.isArray(value)) {
    return pmapArray(value, predicate, map) as any;
  }
  if (value && typeof value === 'object') {
    return pmapObject(value, predicate, map);
  }
  return value;
}
