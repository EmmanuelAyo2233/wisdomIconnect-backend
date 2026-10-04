"use strict";
// Explicit deployment migration. Run on a backed-up staging database first.
module.exports = {
  async up(queryInterface, Sequelize) {
    const models = require("../models").db.sequelize;
    const tables = new Set(
      (await queryInterface.showAllTables()).map((t) =>
        typeof t === "string" ? t : t.tableName,
      ),
    );
    // MySQL DDL is not transactional. Reject invalid existing data before any schema write.
    for (const [table,field] of [['wallet','userId'],['payment','appointmentId'],['mentor','user_id'],['mentee','user_id']]) {
      if (!tables.has(table)) continue;
      const [duplicates]=await queryInterface.sequelize.query(`SELECT \`${field}\` FROM \`${table}\` GROUP BY \`${field}\` HAVING COUNT(*) > 1 LIMIT 1`);
      if (duplicates.length) throw new Error(`Reconcile duplicate ${table}.${field} records before migrating`);
    }
    for (const [table,fields] of [['wallet',['available_balance','pending_balance','total_earned']],['payment',['amount','mentor_share','platform_share']],['withdrawal',['amount']]]) {
      if (!tables.has(table)) continue;
      const existing=await queryInterface.describeTable(table);
      for (const field of fields) {
        if (!existing[field]) continue;
        const [invalid]=await queryInterface.sequelize.query(`SELECT id FROM \`${table}\` WHERE \`${field}\` IS NULL OR \`${field}\` < 0 OR \`${field}\` > 100000000 LIMIT 1`);
        if (invalid.length) throw new Error(`Reconcile invalid ${table}.${field} balances before migrating`);
      }
    }
    const ordered = models.modelManager.getModelsTopoSortedByForeignKey();
    if (!ordered)
      throw new Error(
        "Schema contains cyclic foreign keys; review migration order",
      );
    for (const model of [...ordered].reverse()) {
      const table = model.getTableName();
      const attributes = Object.fromEntries(
        Object.values(model.rawAttributes).map((attr) => [
          attr.field,
          { ...attr },
        ]),
      );
      if (!tables.has(table)) {
        await queryInterface.createTable(table, attributes);
        tables.add(table);
      } else {
        const existing = await queryInterface.describeTable(table);
        // MySQL column names are case-insensitive; check case-insensitively to
        // avoid "Duplicate column name" errors where the DB has a column with
        // different capitalisation (e.g. linkedInUrl vs linkedinUrl).
        const existingLower = new Set(Object.keys(existing).map(k => k.toLowerCase()));
        for (const [field, attr] of Object.entries(attributes)) {
          if (!existing[field] && !existingLower.has(field.toLowerCase())) {
            // Drop FK references: MySQL rejects addColumn if the referenced
            // table/column isn't yet present in this migration step.
            const { references: _ref, ...safeAttr } = attr;
            await queryInterface.addColumn(table, field, safeAttr);
          }
        }
      }
    }
    // Refuse to guess which duplicate owns funds or personal data.
    for (const [table, field] of [
      ["wallet", "userId"],
      ["payment", "appointmentId"],
      ["mentor", "user_id"],
      ["mentee", "user_id"],
    ]) {
      const [duplicates] = await queryInterface.sequelize.query(
        `SELECT \`${field}\` FROM \`${table}\` GROUP BY \`${field}\` HAVING COUNT(*) > 1 LIMIT 1`,
      );
      if (duplicates.length)
        throw new Error(
          `Reconcile duplicate ${table}.${field} records before migrating`,
        );
      const indexes = await queryInterface.showIndex(table);
      if (
        !indexes.some(
          (index) =>
            index.unique &&
            index.fields.length === 1 &&
            index.fields[0].attribute === field,
        )
      )
        await queryInterface.addIndex(table, [field], {
          unique: true,
          name: `security_unique_${table}_${field}`,
        });
    }
    for (const [table, fields] of [
      ["wallet", ["available_balance", "pending_balance", "total_earned"]],
      ["payment", ["amount", "mentor_share", "platform_share"]],
      ["withdrawal", ["amount"]],
    ]) {
      for (const field of fields) {
        const [invalid] = await queryInterface.sequelize.query(
          `SELECT id FROM \`${table}\` WHERE \`${field}\` < 0 OR \`${field}\` > 100000000 LIMIT 1`,
        );
        if (invalid.length)
          throw new Error(
            `Reconcile invalid ${table}.${field} balances before migrating`,
          );
        await queryInterface.changeColumn(table, field, {
          type: Sequelize.DECIMAL(14, 2),
          allowNull: false,
          ...(table === "wallet" ? { defaultValue: 0 } : {}),
        });
      }
    }
    const indexes = await queryInterface.showIndex("appointment");
    if (!indexes.some((i) => i.name === "appointment_mentor_schedule"))
      await queryInterface.addIndex(
        "appointment",
        ["mentorId", "date", "status"],
        { name: "appointment_mentor_schedule" },
      );
    if (!indexes.some((i) => i.name === "appointment_mentee_schedule"))
      await queryInterface.addIndex(
        "appointment",
        ["menteeId", "date", "status"],
        { name: "appointment_mentee_schedule" },
      );
    for (const [table,fields,name] of [['ledger_entry',['userId','createdAt'],'ledger_user_created'],['webhook_event',['status','createdAt'],'webhook_pending_created'],['availability',['mentorId','date','status'],'availability_mentor_schedule']]) {
      if (!(await queryInterface.showIndex(table)).some(index=>index.name===name)) await queryInterface.addIndex(table,fields,{name});
    }
    // Old OTPs cannot be safely compared after switching to hashes; force a fresh code.
    await queryInterface.bulkUpdate(
      "user",
      {
        verificationToken: null,
        verificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
      {},
    );
  },
  async down() {
    throw new Error(
      "Financial migration requires a reviewed backup restore; automatic destructive rollback is disabled",
    );
  },
};
