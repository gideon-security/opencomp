#!/usr/bin/env node

const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'dist',
  'build',
  'coverage',
  'generated',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.icns',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.webm',
  '.pdf',
  '.zip',
  '.gz',
  '.wasm',
  '.node',
  '.exe',
  '.dmg',
  '.blockmap',
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Runtime/host-provided variables that are expected in code without being
// declared in any .env.example.
const KNOWN_RUNTIME_VARS = new Set([
  'NODE_ENV',
  'PORT',
  'CI',
  'TZ',
  'INIT_CWD',
  'APPIMAGE',
  'npm_lifecycle_event',
  'npm_package_version',
  'NEXT_RUNTIME',
  'NEXT_PHASE',
  'NEXT_DEPLOYMENT_ID',
  'ELECTRON_RENDERER_URL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'TRIGGER_API_URL',
]);

const walk = (dir, visitor) => {
  for (const entry of readdirSync(dir)) {
    if (entry === '.env.example') continue;
    const fullPath = path.join(dir, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(fullPath, visitor);
      continue;
    }
    visitor(fullPath, stats);
  }
};

const parseEnvKeys = (filePath) => {
  const keys = [];
  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (match) keys.push(match[1]);
  }
  return keys;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Collect declared variables from every .env.example ──────────────────────
const declaredByFile = [];
const declaredVars = new Map(); // name -> first declaring file

const visitDeclared = (dir) => {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) visitDeclared(fullPath);
      continue;
    }
    if (entry !== '.env.example' && entry !== '.env.test.local.example') continue;
    const relative = path.relative(repoRoot, fullPath);
    for (const key of parseEnvKeys(fullPath)) {
      declaredByFile.push([key, relative]);
      if (!declaredVars.has(key)) declaredVars.set(key, relative);
    }
  }
};
visitDeclared(repoRoot);

// ── Build searchable corpus of all text files (examples excluded) ────────────
let corpus = '';
const codeCorpus = [];

const isCodeFile = (file) =>
  /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(file);

walk(repoRoot, (fullPath, stats) => {
  if (BINARY_EXTENSIONS.has(path.extname(fullPath))) return;
  if (stats.size > MAX_FILE_BYTES) return;
  if (/^(package-lock\.json|.*\.env\.example)$/.test(path.basename(fullPath))) return;
  let content;
  try {
    content = readFileSync(fullPath, 'utf8');
  } catch {
    return;
  }
  corpus += `\n${content}`;
  if (isCodeFile(fullPath)) codeCorpus.push(content);
});

const codeText = codeCorpus.join('\n');

// ── Unused: declared but referenced nowhere outside example files ────────────
const unused = [];
for (const [key, declaredIn] of [...declaredVars].sort(([a], [b]) => a.localeCompare(b))) {
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(key)}([^A-Za-z0-9_]|$)`);
  if (!pattern.test(corpus)) unused.push({ key, declaredIn });
}

// ── Undeclared: read in code but absent from every .env.example ──────────────
const referencedInCode = new Set();
const envPatterns = [/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g, /import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g];
for (const pattern of envPatterns) {
  for (const match of codeText.matchAll(pattern)) {
    referencedInCode.add(match[1]);
  }
}
const undeclared = [...referencedInCode]
  .filter((name) => !declaredVars.has(name) && !KNOWN_RUNTIME_VARS.has(name))
  .filter((name) => !name.startsWith('npm_'))
  .sort((a, b) => a.localeCompare(b));

// ── Report ───────────────────────────────────────────────────────────────────
if (unused.length > 0) {
  console.error('Unused environment variables (declared in .env.example, never referenced):');
  for (const { key, declaredIn } of unused) {
    console.error(`- ${key} (${declaredIn})`);
  }
}

if (undeclared.length > 0) {
  console.warn(
    `Referenced in code but missing from every .env.example (${undeclared.length}):`,
  );
  console.warn(`  ${undeclared.join(', ')}`);
}

if (unused.length > 0) {
  process.exit(1);
}

console.log(
  `Environment check passed: ${declaredVars.size} declared variables, ${referencedInCode.size} referenced in code.`,
);
