import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function writeJsonAtomically(file: string, data: unknown): void {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, file);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw error;
  }
}

export function readJsonStore<T extends Record<string, unknown>>(file: string, requiredCollections: string[]): T {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!value || typeof value !== 'object' || requiredCollections.some(name => !Array.isArray(value[name]))) {
    throw new Error('The local store is invalid. Restore it from backup; existing data has been preserved.');
  }
  return value as T;
}
