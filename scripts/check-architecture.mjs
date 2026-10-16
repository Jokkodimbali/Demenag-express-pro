import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const errors = [];
let count = 0;
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'generated') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
      continue;
    }
    if (!/\.(ts|tsx|css|mjs)$/.test(file)) continue;
    count++;
    const text = await readFile(file, 'utf8');
    const lines = text.trimEnd().split('\n').length;
    if (lines > 1000) errors.push(`${file}: ${lines} lignes (maximum 1000).`);
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function inspect(node) {
      if (node.kind === ts.SyntaxKind.AnyKeyword) errors.push(`${file}: type any interdit.`);
      if (
        file.startsWith('frontend/src/') &&
        !file.includes('/content/') &&
        ts.isJsxText(node) &&
        /[\p{L}\p{N}]/u.test(node.text)
      )
        errors.push(`${file}: texte JSX hors du catalogue.`);
      if (
        file.startsWith('frontend/src/') &&
        ts.isJsxAttribute(node) &&
        ['alt', 'title', 'placeholder', 'aria-label'].includes(node.name.getText(source)) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        node.initializer.text.trim()
      )
        errors.push(`${file}: attribut visible hors du catalogue.`);
      if (/^frontend\/src\/(pages|components)\//.test(file) && ts.isCallExpression(node)) {
        const expression = node.expression;
        if (
          (ts.isIdentifier(expression) && expression.text === 'fetch') ||
          (ts.isPropertyAccessExpression(expression) &&
            expression.expression.getText(source) === 'api')
        )
          errors.push(`${file}: accès distant dans une vue ; utiliser un contrôleur.`);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      const specifier = node.moduleSpecifier.text;
      const target = specifier.startsWith('.')
        ? path.normalize(path.join(path.dirname(file), specifier))
        : specifier;
      if (
        file.startsWith('backend/src/adapters/in/') &&
        /backend\/src\/(application\/services|adapters\/out|generated)/.test(target)
      )
        errors.push(`${file}: le contrôleur doit dépendre des ports : ${specifier}.`);
      if (
        file.startsWith('frontend/src/application/') &&
        target.startsWith('frontend/src/adapters/')
      )
        errors.push(`${file}: implémentation concrète dans l’application : ${specifier}.`);
      if (
        /^frontend\/src\/(pages|components)\//.test(file) &&
        target.startsWith('frontend/src/adapters/')
      )
        errors.push(`${file}: adaptateur concret dans une vue : ${specifier}.`);
      const isDomain = file.startsWith('backend/src/domain/');
      const isApplication = file.startsWith('backend/src/application/');
      if (
        (isDomain || isApplication) &&
        /(^|\/)(adapters|generated|composition)(\/|\.)/.test(target)
      )
        errors.push(`${file}: dépendance vers l’infrastructure ${specifier}.`);
      if (isDomain && target.startsWith('backend/src/application/'))
        errors.push(`${file}: le domaine dépend de l’application.`);
      if ((isDomain || isApplication) && !specifier.startsWith('.'))
        errors.push(`${file}: dépendance externe ${specifier} dans une couche métier.`);
      if (file.startsWith('frontend/src/') && target.startsWith('backend/'))
        errors.push(`${file}: dépendance directe vers le backend.`);
    }
  }
}
for (const directory of ['backend/src', 'frontend/src', 'shared', 'scripts'])
  await visit(directory);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Architecture OK : ${count} fichiers, limite de 1000 lignes et dépendances métier vérifiées.`,
  );
