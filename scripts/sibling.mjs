// De zusterrepo (svenska_ovningar ⇄ svenska_ovningar_b) staat naast deze repo,
// of op de plek in SIBLING_DIR (zo gebruikt in GitHub Actions).
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '..');
export const name = path.basename(root);
export const siblingName = name.endsWith('_b') ? name.slice(0, -2) : `${name}_b`;
export const sibling = process.env.SIBLING_DIR ? path.resolve(process.env.SIBLING_DIR) : path.resolve(root, '..', siblingName);
