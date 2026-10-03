process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_STORAGE = ':memory:';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const { db, User, Wallet } = require('../models');
const migration = require('../migrations/20261003000001-security-and-financial-integrity');
after(() => db.sequelize.close());
test('financial migration creates a clean schema and retains records on replay', async () => {
  const qi = db.sequelize.getQueryInterface();
  await migration.up(qi, Sequelize);
  await require('../services/schemaService').assertSchema(db.sequelize);
  const tables = await qi.showAllTables();
  for (const name of ['payment_intent','ledger_entry','webhook_event','appointment']) assert.ok(tables.includes(name),name);
  const user=await User.create({name:'Migration fixture',email:'migration@example.invalid',password:'isolated-placeholder',userType:'mentee',isVerified:true});
  await Wallet.create({userId:user.id,availableBalance:'12.34'});
  await migration.up(qi, Sequelize);
  assert.equal(Number((await Wallet.findOne({where:{userId:user.id}})).availableBalance),12.34);
  await assert.rejects(Wallet.create({userId:user.id}),{name:'SequelizeUniqueConstraintError'});
});

for (const scenario of ['duplicate wallet ownership', 'invalid wallet balance']) {
  test(`migration rejects ${scenario} before any schema changes`, async () => {
    const isolated = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    try {
      const qi = isolated.getQueryInterface();
      await qi.createTable('wallet', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, allowNull: false },
        available_balance: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
        pending_balance: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
        total_earned: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      });
      const row = { userId: 7, available_balance: 12.34, pending_balance: 0, total_earned: 0 };
      await qi.bulkInsert('wallet', scenario === 'duplicate wallet ownership' ? [row, row] : [{ ...row, available_balance: -1 }]);
      const before = await qi.describeTable('wallet');
      await assert.rejects(migration.up(qi, Sequelize), scenario === 'duplicate wallet ownership' ? /Reconcile duplicate wallet/ : /Reconcile invalid wallet/);
      assert.deepEqual(await qi.showAllTables(), ['wallet']);
      assert.deepEqual(await qi.describeTable('wallet'), before);
      const [[count]] = await isolated.query('SELECT COUNT(*) AS count FROM wallet');
      assert.equal(count.count, scenario === 'duplicate wallet ownership' ? 2 : 1);
    } finally {
      await isolated.close();
    }
  });
}
