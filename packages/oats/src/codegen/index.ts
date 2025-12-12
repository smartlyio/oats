/**
 * Code generation module exports.
 */

// Context
export {
  GenerationContext,
  GenerationState,
  Options,
  Resolve,
  AdditionalPropertiesIndexSignature,
  createContext
} from './context';

// Helpers
export {
  runtime,
  runtimeLibrary,
  readonlyModifier,
  valueClassIndexSignatureKey,
  oatsBrandFieldName,
  scalarTypes,
  quotedProp,
  generateLiteral,
  generateNumericLiteral,
  fromLib,
  makeCall,
  makeAnyProperty,
  brandTypeName,
  isScalar,
  addIndexSignatureIgnores,
  resolveModule
} from './helpers';

// Types
export {
  generateAdditionalPropType,
  generateClassMembers,
  generateOatsBrandProperty,
  generateObjectMembers,
  generateType,
  generateStringType,
  scalarTypeWithBrand
} from './types';

// Reflection
export {
  generateReflectionType,
  generateAdditionalPropsReflectionType,
  generateObjectReflectionType,
  generateReflectionMaker,
  generateNamedTypeDefinitionDeclaration,
  inventIsA,
  generateIsA,
  generateIsAForScalar
} from './reflection';

// Classes
export {
  generateValueClass,
  generateClassConstructor,
  generateReflectionProperty,
  generateClassMakeMethod,
  generateClassBuiltinMembers
} from './classes';

// Makers
export {
  generateTypeShape,
  generateBrand,
  generateTopLevelClassBuilder,
  generateTopLevelClassMaker,
  generateTopLevelMaker,
  generateTopLevelClass,
  generateTopLevelType
} from './makers';

// Query types
export {
  generateContentSchemaType,
  generateHeadersSchemaType,
  generateQueryType,
  generateParameterType,
  generateRequestBodyType,
  generateResponseType,
  generateQueryTypes
} from './query-types';

