/**
 * Value class generation for TypeScript output.
 */

import * as oas from 'openapi3-ts';
import { GenerationContext } from './context';
import { ts, raw } from '../template';
import { runtime, fromLib } from './helpers';
import { generateClassMembers } from './types';

/**
 * Generates a complete value class declaration.
 */
export function generateValueClass(
  key: string,
  valueIdentifier: string,
  schema: oas.SchemaObject,
  ctx: GenerationContext
): string {
  const members = generateClassMembers(
    schema.properties,
    schema.required,
    schema.additionalProperties,
    ctx
  );

  const builtinMembers = generateClassBuiltinMembers(key, ctx);

  return ts`export class ${valueIdentifier} extends ${fromLib('valueClass', 'ValueClass')} { ${[...members, ...builtinMembers].join(' ')} }`;
}

/**
 * Generates the class constructor method.
 */
export function generateClassConstructor(key: string, ctx: GenerationContext): string {
  const { options } = ctx;
  const shapeName = options.nameMapper(key, 'shape');
  const valueName = options.nameMapper(key, 'value');

  return raw`public constructor(value: ${shapeName}, opts?: ${fromLib('make', 'MakeOptions')} | InternalUnsafeConstructorOption) { super(); ${runtime}.instanceAssign(this, value, opts, build${valueName}); }`;
}

/**
 * Generates the static reflection property.
 */
export function generateReflectionProperty(
  key: string,
  ctx: GenerationContext
): string {
  const { options } = ctx;
  const valueName = options.nameMapper(key, 'value');
  const reflectionName = options.nameMapper(key, 'reflection');

  return raw`public static reflection: ${fromLib('reflection', 'NamedTypeDefinitionDeferred')}<${valueName}> = () => { return ${reflectionName}; };`;
}

/**
 * Generates the static make method.
 */
export function generateClassMakeMethod(key: string, ctx: GenerationContext): string {
  const { options } = ctx;
  const className = options.nameMapper(key, 'value');
  const shapeName = options.nameMapper(key, 'shape');

  return raw`static make(value: ${shapeName}, opts?: ${runtime}.make.MakeOptions): ${runtime}.make.Make<${className}> { if (value instanceof ${className}) { return ${runtime}.make.Make.ok(value); } const make = build${className}(value, opts); if (make.isError()) { return ${runtime}.make.Make.error(make.errors); } else { return ${runtime}.make.Make.ok(new ${className}(make.success(), { unSafeSet: true })); } }`;
}

/**
 * Generates all built-in class members (constructor, reflection, make).
 */
export function generateClassBuiltinMembers(
  key: string,
  ctx: GenerationContext
): string[] {
  return [
    generateClassConstructor(key, ctx),
    generateReflectionProperty(key, ctx),
    generateClassMakeMethod(key, ctx)
  ];
}
