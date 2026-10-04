"use strict";
// Read-only checks: never print credentials, identifiers or user records.
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mysql = require("mysql2/promise");

async function main() {
  for (const key of ["DB_HOST", "DB_NAME", "DB_USERNAME", "DB_PASSWORD"]) {
    if (!process.env[key]) throw Object.assign(new Error("Missing configuration"), { code: "MISSING_DB_CONFIGURATION" });
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true },
    connectTimeout: 10000,
    multipleStatements: false,
  });
  const read = async (sql, values = []) => {
    if (!/^SELECT\s/i.test(sql) || sql.includes(";")) throw new Error("Only single SELECT statements are permitted");
    return (await connection.query({ sql, timeout: 10000 }, values))[0];
  };
  try {
    const columns = await read("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()");
    const tables = new Map();
    for (const column of columns) {
      if (!tables.has(column.TABLE_NAME)) tables.set(column.TABLE_NAME, new Set());
      tables.get(column.TABLE_NAME).add(column.COLUMN_NAME);
    }
    const files = fs.readdirSync(path.resolve(__dirname, "../migrations")).filter(file => file.endsWith(".js")).sort();
    const applied = tables.has("SequelizeMeta") ? (await read("SELECT name FROM SequelizeMeta")).map(row => row.name) : [];
    const blockers = [];
    for (const [table, field] of [["wallet", "userId"], ["payment", "appointmentId"], ["mentor", "user_id"], ["mentee", "user_id"]]) {
      if (!tables.has(table)) continue;
      if (!tables.get(table).has(field)) { blockers.push(`Missing legacy column ${table}.${field}`); continue; }
      const rows = await read(`SELECT COUNT(*) AS count FROM (SELECT 1 FROM \`${table}\` GROUP BY \`${field}\` HAVING COUNT(*) > 1) AS duplicates`);
      if (Number(rows[0].count)) blockers.push(`Duplicate ${table}.${field} groups require reconciliation`);
    }
    for (const [table, fields] of [["wallet", ["available_balance", "pending_balance", "total_earned"]], ["payment", ["amount", "mentor_share", "platform_share"]], ["withdrawal", ["amount"]]]) {
      for (const field of fields) {
        if (!tables.get(table)?.has(field)) continue;
        const rows = await read(`SELECT COUNT(*) AS count FROM \`${table}\` WHERE \`${field}\` IS NULL OR \`${field}\` < 0 OR \`${field}\` > 100000000`);
        if (Number(rows[0].count)) blockers.push(`Invalid ${table}.${field} values require reconciliation`);
      }
    }
    if (!tables.has("SequelizeMeta") && tables.has("user")) blockers.push("Existing schema has no migration history; reviewed baseline required before CLI migration");
    const required = {user:['tokenVersion'],appointment:['slotId','price'],payment:['platformUserId','refundState','providerTransactionId'],payment_intent:['reference','amountMinor'],wallet:['userId','available_balance','pending_balance'],withdrawal:['idempotencyKey','reference'],ledger_entry:['operationKey'],webhook_event:['key','payload']};
    const missingApplicationColumns = Object.entries(required).flatMap(([table,fields]) => fields.filter(field=>!tables.get(table)?.has(field)).map(field=>`${table}.${field}`));
    console.log(JSON.stringify({
      readOnly: true,
      targetFingerprint: crypto.createHash("sha256").update(`${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`).digest("hex").slice(0, 12),
      tableCount: tables.size,
      appliedMigrations: applied,
      pendingMigrations: files.filter(file => !applied.includes(file)),
      blockers,
      missingApplicationColumns,
      legacyMentorExperienceExists: tables.get('mentor')?.has('experience') || false,
      backupVerified: false,
      writesPausedVerified: false,
    }, null, 2));
    if (blockers.length) process.exitCode = 2;
  } finally {
    await connection.end();
  }
}
main().catch(error => {
  console.error(JSON.stringify({ status: "preflight_failed", code: error.code || error.name || "UNKNOWN", schemaChanged: false }));
  process.exitCode = 1;
});
