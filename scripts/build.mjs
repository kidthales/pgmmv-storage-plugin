import console from 'node:console';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { LanguageVariant, SyntaxKind } from 'typescript/unstable/ast';
import { createScanner } from 'typescript/unstable/ast/scanner';

const NON_REGEX_PREDECESSOR_TOKENS = new Set([
  SyntaxKind.Identifier,
  SyntaxKind.PrivateIdentifier,
  SyntaxKind.NumericLiteral,
  SyntaxKind.BigIntLiteral,
  SyntaxKind.StringLiteral,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.TemplateTail,
  SyntaxKind.CloseParenToken,
  SyntaxKind.CloseBracketToken,
  SyntaxKind.PlusPlusToken,
  SyntaxKind.MinusMinusToken,
  SyntaxKind.ThisKeyword,
  SyntaxKind.TrueKeyword,
  SyntaxKind.FalseKeyword,
  SyntaxKind.NullKeyword
]);

/**
 * Check whether a token is trivia (whitespace, newline, or comment).
 *
 * @param {number} token
 * @returns {boolean}
 */
function isTrivia(token) {
  return (
    token === SyntaxKind.SingleLineCommentTrivia ||
    token === SyntaxKind.MultiLineCommentTrivia ||
    token === SyntaxKind.NewLineTrivia ||
    token === SyntaxKind.WhitespaceTrivia
  );
}

/**
 * Strip non-banner comments from JavaScript source while preserving `/**!` / `/*!` headers.
 *
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  const scanner = createScanner(false, LanguageVariant.Standard, source);
  const chunks = [];
  let lastNonTriviaToken = SyntaxKind.Unknown;

  for (let token = scanner.scan(); token !== SyntaxKind.EndOfFile; token = scanner.scan()) {
    if (
      (token === SyntaxKind.SlashToken || token === SyntaxKind.SlashEqualsToken) &&
      !NON_REGEX_PREDECESSOR_TOKENS.has(lastNonTriviaToken)
    ) {
      token = scanner.reScanSlashToken();
    }

    const text = scanner.getTokenText();

    if (token === SyntaxKind.SingleLineCommentTrivia) {
      continue;
    }

    if (token === SyntaxKind.MultiLineCommentTrivia) {
      const isBanner = text.startsWith('/**!') || text.startsWith('/*!');
      if (isBanner) {
        chunks.push(text);
      } else {
        chunks.push(text.includes('\n') ? '\n' : ' ');
      }
      continue;
    }

    if (!isTrivia(token)) {
      lastNonTriviaToken = token;
    }

    chunks.push(text);
  }

  return chunks.join('');
}

async function main() {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
  const unscopedName = String(pkg.name).replace(/^@[^/]+\//, '');
  const inputPath = resolve(rootDir, 'plugin.js');
  const distDir = resolve(rootDir, 'dist');
  const defaultOutPath = resolve(distDir, `${unscopedName}-v${pkg.version}.js`);
  const outputPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : defaultOutPath;

  const isSamePath =
    process.platform === 'win32' ? outputPath.toLowerCase() === inputPath.toLowerCase() : outputPath === inputPath;
  if (isSamePath) {
    throw new Error(`Refusing to overwrite input file: ${inputPath}`);
  }

  const relToDist = relative(distDir, outputPath);
  const isInsideDist =
    relToDist !== '' &&
    relToDist !== '.' &&
    relToDist !== '..' &&
    !relToDist.startsWith(`..${sep}`) &&
    !relToDist.startsWith('../') &&
    !isAbsolute(relToDist);
  if (!isInsideDist) {
    throw new Error(`Refusing to write outside dist directory (${distDir}): ${outputPath}`);
  }

  const source = readFileSync(inputPath, 'utf8');
  const stripped = stripComments(source);
  const prettierConfig = await prettier.resolveConfig(inputPath);
  const formatted = await prettier.format(stripped, {
    ...(prettierConfig ?? {}),
    filepath: inputPath
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, formatted, 'utf8');
  console.log(`Built ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
