import { Pool } from "pg";

let pool: Pool | undefined;
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("Beta persistence is unconfigured");
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 });
    pool.on("error", () => console.error("Beta database connection unavailable"));
  }
  return pool;
}
