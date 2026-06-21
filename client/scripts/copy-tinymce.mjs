import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'node_modules', 'tinymce');
const target = join(root, 'public', 'tinymce');

if (!existsSync(source)) {
  console.warn('[postinstall] TinyMCE package not found; skipping public asset copy.');
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log('[postinstall] Copied TinyMCE assets to public/tinymce.');
