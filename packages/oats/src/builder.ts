import * as ts from 'typescript';
import * as assert from 'assert';

export function buildBlock(block: string): ts.Block {
  const node = ts.createSourceFile('block.ts', `function foo() {${block}}`, ts.ScriptTarget.Latest);
  const fun: ts.FunctionDeclaration = node.getChildAt(0).getChildAt(0) as any;
  assert(fun.kind === ts.SyntaxKind.FunctionDeclaration);
  return fun.body!;
}
