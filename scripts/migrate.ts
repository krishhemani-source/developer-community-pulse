// npm run db:migrate
// Creates every table and index from db/schema.sql. Safe to run more than once.
import "./env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { query } from "../lib/db";

async function main() {
  const file = path.join(process.cwd(), "db", "schema.sql");
  const sql = readFileSync(file, "utf8");

  // Remove comment lines, then split on semicolons that end a line.
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    const firstLine = statement.split("\n")[0];
    await query(statement);
    console.log(`ok  ${firstLine}`);
  }
  console.log(`\nMigration complete: ${statements.length} statements.`);
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
