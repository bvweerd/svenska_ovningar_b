// De zusterrepo (svenska_ovningar ⇄ svenska_ovningar_b) staat naast deze repo.
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '..');
export const name = path.basename(root);
export const siblingName = name.endsWith('_b') ? name.slice(0, -2) : `${name}_b`;
export const sibling = path.resolve(root, '..', siblingName);
