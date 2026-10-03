process.env.NODE_ENV = "test";
process.env.TEST_DATABASE_STORAGE = ":memory:";
process.env.SECRET_KEY = "isolated-test-key-never-used-in-deployment";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const {
  db,
  User,
  Mentor,
  Mentee,
  Appointment,
  Availability,
  Wallet,
  Payment,
  Connection,
} = require("../models");
const finance = require("../services/financeService");
const { reserve } = require("../services/bookingService");
const {
  connectionFor,
  currentUser,
} = require("../services/authorizationService");
const { toMinor, split } = require("../utils/money");
let admin, mentorUser, menteeUser, stranger, mentor, mentee;
before(async () => {
  await db.sequelize.sync({ force: true });
  const base = {
    password: "test-hash-placeholder",
    isVerified: true,
    accountStatus: "active",
    status: "approved",
  };
  admin = await User.create({
    ...base,
    name: "Admin",
    email: "admin@example.invalid",
    userType: "admin",
  });
  mentorUser = await User.create({
    ...base,
    name: "Mentor",
    email: "mentor@example.invalid",
    userType: "mentor",
    mentorLevel: "verified",
  });
  menteeUser = await User.create({
    ...base,
    name: "Mentee",
    email: "mentee@example.invalid",
    userType: "mentee",
  });
  stranger = await User.create({
    ...base,
    name: "Stranger",
    email: "stranger@example.invalid",
    userType: "mentee",
  });
  mentor = await Mentor.create({
    user_id: mentorUser.id,
    yearsOfExperience: 5,
    kyc_status: "verified",
  });
  mentee = await Mentee.create({ user_id: menteeUser.id });
  await Mentee.create({ user_id: stranger.id });
});
after(() => db.sequelize.close());
test("money rejects malformed amounts and splits without losing cents", () => {
  for (const value of [-1, "NaN", "1e4", "12.001", Infinity])
    assert.throws(() => toMinor(value));
  assert.equal(toMinor("0.29"), 29);
  assert.deepEqual(split(101, 10), { platform: 10, mentor: 91 });
});
test("socket and REST authorization reject foreign conversation IDs and revoked sessions", async () => {
  const conn = await Connection.create({
    mentorId: mentor.id,
    menteeId: mentee.id,
    status: "accepted",
  });
  assert.equal((await connectionFor(menteeUser, conn.id)).id, conn.id);
  await assert.rejects(connectionFor(stranger, conn.id), { statusCode: 403 });
  await menteeUser.update({ tokenVersion: 1 });
  await assert.rejects(currentUser(menteeUser.id, 0), { statusCode: 401 });
  assert.equal((await currentUser(menteeUser.id, 1)).id, menteeUser.id);
});
test("paid booking rejects client price, foreign verification and duplicate settlements", async () => {
  const slot = await Availability.create({
    mentorId: mentorUser.id,
    date: "2099-01-01",
    startTime: "10:00:00",
    endTime: "11:00:00",
    price: "1000.00",
  });
  const { appointment, intent } = await reserve(
    menteeUser,
    { slotId: slot.id, topic: "Career", amount: 1 },
    mentorUser.id,
    true,
  );
  assert.equal(Number(intent.amountMinor), 100000);
  await assert.rejects(
    reserve(stranger, { slotId: slot.id, topic: "Other" }, mentorUser.id, true),
    { statusCode: 409 },
  );
  const data = {
    status: "success",
    reference: intent.reference,
    amount: 100000,
    currency: "NGN",
    domain: "test",
    customer: { email: menteeUser.email },
  };
  await assert.rejects(
    finance.settleCharge({ ...data, amount: 1 }, menteeUser),
    { statusCode: 400 },
  );
  await assert.rejects(finance.settleCharge(data, stranger), {
    statusCode: 403,
  });
  const payment = await finance.settleCharge(data, menteeUser);
  assert.equal((await finance.settleCharge(data, menteeUser)).id, payment.id);
  assert.equal(
    await Payment.count({ where: { reference: intent.reference } }),
    1,
  );
  let wallet = await Wallet.findOne({ where: { userId: mentorUser.id } });
  assert.equal(toMinor(wallet.pendingBalance), 90000);
  await assert.rejects(finance.release(appointment.id, stranger), {
    statusCode: 403,
  });
  await assert.rejects(finance.release(appointment.id, menteeUser), {
    statusCode: 409,
  });
  await appointment.update({
    status: "accepted",
    mentorConfirmed: true,
    menteeConfirmed: true,
  });
  await finance.release(appointment.id, menteeUser);
  await finance.release(appointment.id, menteeUser);
  wallet = await wallet.reload();
  assert.equal(toMinor(wallet.availableBalance), 90000);
  assert.equal(toMinor(wallet.pendingBalance), 0);
});
test("refund callback reverses pending funds once and cannot refund released money", async () => {
  const slot = await Availability.create({
    mentorId: mentorUser.id,
    date: "2099-01-02",
    startTime: "10:00:00",
    endTime: "11:00:00",
    price: "1000.00",
  });
  const { appointment, intent } = await reserve(
    menteeUser,
    { slotId: slot.id, topic: "Career" },
    mentorUser.id,
    true,
  );
  await finance.settleCharge(
    {
      status: "success",
      reference: intent.reference,
      amount: 100000,
      currency: "NGN",
      domain: "test",
      customer: { email: menteeUser.email },
    },
    menteeUser,
  );
  await finance.reserveRefund(appointment.id, menteeUser, "Cancelled");
  await finance.finishRefund(intent.reference, true);
  await finance.finishRefund(intent.reference, true);
  const wallet = await Wallet.findOne({ where: { userId: mentorUser.id } });
  assert.equal(toMinor(wallet.pendingBalance), 0);
  assert.equal((await slot.reload()).status, "available");
});

function invoke(handler, user, body={}, params={}) {
 const response={code:200,status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
 return handler({user,body,params,get:()=>undefined},response).then(()=>response);
}
test('withdrawals reserve once, reject once and require admin transfer evidence',async()=>{
 const controller=require('../controllers/paymentController');
 const payload={amount:'500.00',idempotencyKey:'unit-test-1',bankName:'Test Bank',accountName:'Test Mentor',accountNumber:'0123456789'};
 assert.equal((await invoke(controller.withdrawFunds,mentorUser,payload)).code,400);
 payload.amount='5000.00';
 await db.sequelize.transaction(t=>finance.changeWallet(mentorUser.id,1000000,0,'test-opening','withdrawal-test',t));
 const first=await invoke(controller.withdrawFunds,mentorUser,payload);
 assert.equal(first.code,201);
 assert.equal((await invoke(controller.withdrawFunds,mentorUser,payload)).data.withdrawal.id,first.data.withdrawal.id);
 let wallet=await Wallet.findOne({where:{userId:mentorUser.id}});
 const reservedBalance=toMinor(wallet.availableBalance);
 assert.equal((await invoke(controller.approveWithdrawal,stranger,{reference:'TEST'},{withdrawalId:first.data.withdrawal.id})).code,403);
 assert.equal((await invoke(controller.approveWithdrawal,admin,{}, {withdrawalId:first.data.withdrawal.id})).code,400);
 assert.equal((await invoke(controller.rejectWithdrawal,admin,{}, {withdrawalId:first.data.withdrawal.id})).code,200);
 assert.equal((await invoke(controller.rejectWithdrawal,admin,{}, {withdrawalId:first.data.withdrawal.id})).code,409);
 await wallet.reload();
 assert.equal(toMinor(wallet.availableBalance),reservedBalance+500000);
});
test('wallet overdraft rolls back without a ledger entry',async()=>{
 const ledger=require('../models/ledgerEntry');
 const wallet=await Wallet.findOne({where:{userId:mentorUser.id}});
 await assert.rejects(db.sequelize.transaction(t=>finance.changeWallet(mentorUser.id,-toMinor(wallet.availableBalance)-1,0,'test-overdraft','one',t)),{statusCode:409});
 assert.equal(await ledger.count({where:{kind:'test-overdraft'}}),0);
});
test('webhook signatures, duplicates and sensitive payload retention',async()=>{
 process.env.PAYSTACK_SECRET_KEY='sk_test_isolated_placeholder';
 const {receive}=require('../services/webhookService');
 const crypto=require('crypto');
 const raw=Buffer.from(JSON.stringify({event:'charge.success',data:{reference:'test-unknown',amount:100,currency:'NGN',status:'success',domain:'test',customer:{email:'test@example.invalid',phone:'sensitive'},authorization:{authorization_code:'sensitive'}}}));
 assert.equal(await receive(raw,'invalid'),false);
 const signature=crypto.createHmac('sha512',process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');
 assert.equal(await receive(raw,signature),true);
 assert.equal(await receive(raw,signature),true);
 const Inbox=require('../models/webhookEvent');assert.equal(await Inbox.count(),1);
 const event=await Inbox.findOne();assert.equal(event.payload.authorization,undefined);assert.equal(event.payload.customer.phone,undefined);
});
test('availability rejects foreign IDs, invalid dates, overlaps and client reservation status',async()=>{
 const availability=require('../services/availabilityService');
 for (const date of ['2099-02-30','invalid','2099-13-01']) assert.throws(()=>availability.times(date,'09:00','10:00'),{statusCode:400});
 const [slot]=await availability.create(mentorUser,{date:'2099-05-01',startTime:'09:00',endTime:'09:30',session_type:'fixed',topic_name:'Career',price:'0.00',custom_duration:30,status:'booked'});
 assert.equal(slot.status,'available');
 await assert.rejects(availability.create(mentorUser,{date:'2099-05-01',startTime:'09:15',endTime:'09:45',session_type:'fixed',topic_name:'Career',price:'0.00'}),{statusCode:409});
 await assert.rejects(availability.change(stranger,slot.id,{}),{statusCode:403});
 await assert.rejects(availability.change(mentorUser,slot.id,{status:'booked'}),{statusCode:400});
 await slot.update({status:'booked'});
 await assert.rejects(availability.change(mentorUser,slot.id,{},true),{statusCode:409});
});
test('admin account actions cannot promote arbitrary users or erase financial history',async()=>{
 const accounts=require('../services/adminAccountService');
 await assert.rejects(accounts.change(stranger,mentorUser.id,'approve'),{statusCode:403});
 await assert.rejects(accounts.change(admin,menteeUser.id,'approve'),{statusCode:409});
 await assert.rejects(accounts.change(admin,admin.id,'ban'),{statusCode:403});
 await assert.rejects(accounts.change(admin,mentorUser.id,'reject'),{statusCode:409});
 const pending=await User.create({name:'Pending Mentor',email:'pending@example.invalid',password:'fixture',userType:'mentor',status:'pending',isVerified:true});
 const profile=await Mentor.create({user_id:pending.id,yearsOfExperience:1});
 await accounts.change(admin,pending.id,'reject');
 assert.ok(await Mentor.findByPk(profile.id));
 assert.ok(await Mentee.findOne({where:{user_id:pending.id}}));
 await accounts.change(admin,pending.id,'reconsider');
 await accounts.change(admin,pending.id,'approve');
 await accounts.change(admin,pending.id,'deactivate_mentor');
 assert.ok(await User.findByPk(pending.id));
 assert.equal((await pending.reload()).accountStatus,'suspended');
});
