import fs from 'fs/promises';
import path from 'path';
import { delay } from './delay';

function getFilePath(fileName: string) {
  return path.join(process.cwd(), 'src/server/data', `${fileName}.json`);
}

export async function readJson<T>(fileName: string): Promise<T> {
  await delay(500);

  const filePath = getFilePath(fileName);
  const data = await fs.readFile(filePath, 'utf-8');

  return JSON.parse(data) as T;
}

export async function writeJson<T>(fileName: string, data: T): Promise<void> {
  await delay(500);

  const filePath = getFilePath(fileName);

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
