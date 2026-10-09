import { database } from "./database";
import { readFile } from "node:fs/promises";

async function migrate() {
  const db = database();
  try {
    await db.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  } finally {
    await db.end();
  }
}
void migrate();
