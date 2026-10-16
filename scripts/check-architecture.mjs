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
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      const specifier = node.moduleSpecifier.text;
      const target = specifier.startsWith('.')
        ? path.normalize(path.join(path.dirname(file), specifier))
        : specifier;
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
