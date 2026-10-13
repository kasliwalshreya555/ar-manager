import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const workspaceId = process.env.AR_WORKSPACE_ID;

if (!supabaseUrl || !supabaseKey || !workspaceId) {
  throw new Error(
    "Missing SUPABASE_URL, SUPABASE_ANON_KEY, or AR_WORKSPACE_ID in .env.local"
  );
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  global: { headers: { "x-workspace": workspaceId } },
});

async function main() {
  const tables = [
    "customers",
    "invoices",
    "credit_notes",
    "receipts",
    "allocations",
    "notes",
  ] as const;

  const snapshot: Record<string, unknown[]> = {};

  for (const table of tables) {
    const { data, error } = await db.from(table).select("*");

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`);
    }

    snapshot[table] = data ?? [];
    console.log(`${table}: ${snapshot[table].length} records`);
  }

  const outputPath = path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "sample.json"
  );

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  console.log(`\nFixture saved to: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
