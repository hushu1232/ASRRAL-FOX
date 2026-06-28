import { readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';

type PageHeaderUsage = {
  file: string;
  hasImport: boolean;
  rendersPageHeader: boolean;
  pageHeaderHasTabsProp: boolean;
  rendersLocalTabs: boolean;
};

const TARGET_PAGES = [
  'src/app/(auth)/assets/page.tsx',
  'src/app/(auth)/marketplace/page.tsx',
  'src/app/(auth)/notifications/page.tsx',
  'src/app/(auth)/settings/page.tsx',
];

const SETTINGS_PAGE = 'src/app/(auth)/settings/page.tsx';

function inspectPageHeaderUsage(file: string): PageHeaderUsage {
  const sourceText = readFileSync(path.join(process.cwd(), file), 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let hasImport = false;
  let rendersPageHeader = false;
  let pageHeaderHasTabsProp = false;
  let rendersLocalTabs = false;

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const moduleName = node.moduleSpecifier.getText(sourceFile).replace(/[\'\"]/g, '');
      const defaultImport = node.importClause?.name?.getText(sourceFile);
      if (moduleName === '@/components/layout/PageHeader' && defaultImport === 'PageHeader') {
        hasImport = true;
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);

      if (tagName === 'PageHeader') {
        rendersPageHeader = true;
        pageHeaderHasTabsProp =
          pageHeaderHasTabsProp ||
          node.attributes.properties.some(
            (property) =>
              ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'tabs',
          );
      }

      if (tagName === 'Tabs') {
        rendersLocalTabs = true;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { file, hasImport, rendersPageHeader, pageHeaderHasTabsProp, rendersLocalTabs };
}

describe('authenticated page shells', () => {
  it('uses the shared PageHeader on scoped high-traffic pages', () => {
    expect(TARGET_PAGES.map(inspectPageHeaderUsage)).toEqual(
      TARGET_PAGES.map((file) =>
        expect.objectContaining({
          file,
          hasImport: true,
          rendersPageHeader: true,
        }),
      ),
    );
  });

  it('keeps settings tabs local to the settings page', () => {
    expect(inspectPageHeaderUsage(SETTINGS_PAGE)).toEqual(
      expect.objectContaining({
        rendersPageHeader: true,
        pageHeaderHasTabsProp: false,
        rendersLocalTabs: true,
      }),
    );
  });
});
