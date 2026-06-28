import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';

type DeprecatedUsage = {
  file: string;
  component: string;
  prop: string;
  line: number;
};

function findSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findSourceFiles(fullPath);
    }

    if (!entry.isFile() || !fullPath.endsWith('.tsx')) {
      return [];
    }

    return [path.relative(process.cwd(), fullPath).replace(/\\/g, '/')];
  });
}

function getJsxOpening(node: ts.Node): ts.JsxOpeningElement | ts.JsxSelfClosingElement | null {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    return node;
  }

  return null;
}

function collectDeprecatedAntdProps(): DeprecatedUsage[] {
  const usages: DeprecatedUsage[] = [];
  const sourceFiles = findSourceFiles(path.join(process.cwd(), 'src')).sort();

  for (const file of sourceFiles) {
    const absolutePath = path.join(process.cwd(), file);
    const sourceText = readFileSync(absolutePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const visit = (node: ts.Node) => {
      const opening = getJsxOpening(node);
      if (opening) {
        const component = opening.tagName.getText(sourceFile);
        const deprecatedProp =
          component === 'Space' ? 'direction' : component === 'Alert' ? 'message' : null;

        if (deprecatedProp) {
          for (const attribute of opening.attributes.properties) {
            if (
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(sourceFile) === deprecatedProp
            ) {
              const position = sourceFile.getLineAndCharacterOfPosition(
                attribute.getStart(sourceFile),
              );
              usages.push({
                file,
                component,
                prop: deprecatedProp,
                line: position.line + 1,
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return usages;
}

describe('Ant Design 6 deprecated props', () => {
  it('does not use removed Space.direction or Alert.message props', () => {
    expect(collectDeprecatedAntdProps()).toEqual([]);
  });
});
