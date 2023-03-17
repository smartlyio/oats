import * as ts from 'typescript';
import * as assert from 'assert';

export function buildMethod(methodStr: string): ts.MethodDeclaration {
  const node = ts.createSourceFile(
    'block.ts',
    `class Foo { ${methodStr} }`,
    ts.ScriptTarget.Latest
  );
  const classDeclaration: ts.Node = node.statements[0];
  assert(ts.isClassDeclaration(classDeclaration));
  const method = classDeclaration.members[0];
  assert(ts.isMethodDeclaration(method));
  return method;
}
export function buildBlock(block: string): ts.Block {
  const node = ts.createSourceFile('block.ts', `function foo() {${block}}`, ts.ScriptTarget.Latest);
  const fun: ts.Node = node.getChildAt(0).getChildAt(0) as any;
  assert(ts.isFunctionDeclaration(fun));
  return fun.body!;
}
