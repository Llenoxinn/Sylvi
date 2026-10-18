// Copies the MediaPipe vision WASM runtime into public/ so face detection
// works offline and never depends on a third-party CDN.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const from = join('node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join('public', 'mediapipe');
if (!existsSync(from)) {
  console.warn('[sylvi] @mediapipe/tasks-vision not installed; skipping WASM copy');
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const file of readdirSync(from)) {
  if (file.includes('_module_')) continue;
  cpSync(join(from, file), join(to, file));
}
