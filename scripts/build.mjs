import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(root, 'web');
const output = path.resolve(root, 'dist');
if (source !== path.join(root, 'web') || output !== path.join(root, 'dist')) {
  throw new Error('Refusing to build outside the SHIRO workspace.');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
console.log(`Copied SHIRO static workspace to ${output}`);
