import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Launch complete EHMS stack
await import(path.join(rootDir, 'run_ehms.mjs'));
