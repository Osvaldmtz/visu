#!/usr/bin/env node
/**
 * Run this script to apply the onboarding migration.
 * Requires: SUPABASE_DB_URL in .env.local (direct Postgres connection string)
 *
 * Alternatively, copy the SQL from supabase/migrations/001_onboarding_columns.sql
 * and run it in the Supabase SQL Editor at:
 * https://supabase.com/dashboard/project/ariroiycjuferrlxidla/sql
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "../supabase/migrations/001_onboarding_columns.sql");
const sql = readFileSync(sqlPath, "utf-8");

console.log("=== Migration SQL to run in Supabase SQL Editor ===\n");
console.log(sql);
console.log("\n=== Open: https://supabase.com/dashboard/project/ariroiycjuferrlxidla/sql ===");
