/* eslint-disable @typescript-eslint/no-unused-vars */

import * as client from '../src/client';
describe('ClientEndpoint', () => {
  const body = { contentType: 'application/json', value: { foo: 'some string' } };
  const response = { status: 200, value: { contentType: 'application/json', value: {} } };
  function mock<R>(): R {
    return (() => null) as any;
  }

  it('allows no arguments when none are required', () => {
    void mock<client.ClientEndpoint<void, void, void, typeof response>>()();
  });

  it('allows arguments', () => {
    void mock<client.ClientEndpoint<void, { a: string }, void, typeof response>>()({
      query: { a: 'a' }
    });
  });

  it('disallows unknown arguments', () => {
    void mock<client.ClientEndpoint<void, { a: string }, void, typeof response>>()({
      // @ts-expect-error
      query: { k: 'some string' }
    });
  });

  it('disallows unknown arguments with optional query parameters', () => {
    void mock<client.ClientEndpoint<void, { a?: string }, void, typeof response>>()({
      // @ts-expect-error
      query: { k: 'some string' }
    });
  });

  it('allows passing no field when all query parameters are optional', () => {
    void mock<client.ClientEndpoint<void, { a?: string }, void, typeof response>>()();
  });

  it('allows passing no query when headers are present', () => {
    void mock<client.ClientEndpoint<{ some: string }, { a?: string }, void, typeof response>>()({
      headers: { some: 'abc' }
    });
  });

  it('requires body', () => {
    // @ts-expect-error
    void mock<client.ClientEndpoint<void, void, typeof body, typeof response>>()();
  });

  it('allows no body when body can be void', () => {
    void mock<client.ClientEndpoint<void, void, typeof body | void, typeof response>>()();
  });

  it('allows body when body can be void', () => {
    void mock<client.ClientEndpoint<void, void, typeof body | void, typeof response>>()({
      body
    });
  });

  it('requires body with correct type', () => {
    void mock<client.ClientEndpoint<void, void, typeof body, typeof response>>()({
      // @ts-expect-error
      body: { foo: 1 }
    });
  });

  it('allows passing no query when body is present', () => {
    void mock<client.ClientEndpoint<void, { a?: string }, typeof body, typeof response>>()({
      body
    });
  });

  it('allows passing query when body is present', () => {
    void mock<client.ClientEndpoint<void, { a: string }, typeof body, typeof response>>()({
      body,
      query: { a: 'aaa' }
    });
  });

  it('requires query', () => {
    // @ts-expect-error
    void mock<client.ClientEndpoint<void, { a: string }, void, typeof response>>()();
  });

  it('requires query when body is present', () => {
    // @ts-expect-error
    void mock<client.ClientEndpoint<void, { a: string }, typeof body, typeof response>>()({
      body
    });
  });

  it('allows passing query field when all query parameters are optional', () => {
    void mock<client.ClientEndpoint<void, { a?: string }, void, typeof response>>()({ query: {} });
  });

  it('allows passing optional query parameters', () => {
    void mock<client.ClientEndpoint<void, { a?: string }, void, typeof response>>()({
      query: { a: 'foo' }
    });
  });
});
