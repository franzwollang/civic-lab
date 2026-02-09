import { promises as fs } from "fs";
import path from "path";

const DB_DIR = path.resolve(process.cwd(), "db");

function getTablePath(tableName: string) {
  return path.join(DB_DIR, tableName);
}

async function readJson<T>(tableName: string): Promise<T> {
  const filePath = getTablePath(tableName);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function writeJson<T>(tableName: string, data: T): Promise<void> {
  const filePath = getTablePath(tableName);
  const tempPath = `${filePath}.tmp`;
  const serialized = JSON.stringify(data, null, 2);
  await fs.writeFile(tempPath, serialized, "utf-8");
  await fs.rename(tempPath, filePath);
}

async function appendRow<T extends object>(tableName: string, row: T): Promise<T> {
  const rows = await readJson<T[]>(tableName);
  rows.push(row);
  await writeJson(tableName, rows);
  return row;
}

async function updateRow<T extends { [key: string]: unknown }>(
  tableName: string,
  predicate: (row: T) => boolean,
  patch: Partial<T>,
): Promise<T | null> {
  const rows = await readJson<T[]>(tableName);
  const index = rows.findIndex(predicate);
  if (index === -1) return null;
  const next = { ...rows[index], ...patch };
  rows[index] = next;
  await writeJson(tableName, rows);
  return next;
}

export { readJson, writeJson, appendRow, updateRow };
