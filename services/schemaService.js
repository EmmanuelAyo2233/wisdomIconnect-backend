async function assertSchema(sequelize) {
 const qi=sequelize.getQueryInterface();
 const required={user:['tokenVersion'],appointment:['slotId','price'],payment:['platformUserId','refundState','providerTransactionId'],payment_intent:['reference','amountMinor'],wallet:['userId','available_balance','pending_balance'],withdrawal:['idempotencyKey','reference'],ledger_entry:['operationKey'],webhook_event:['key','payload']};
 for(const [table,fields] of Object.entries(required)) {
  let columns;
  try {columns=await qi.describeTable(table);} catch {throw new Error(`Schema migration required: missing ${table}`);}
  for(const field of fields) if(!columns[field]) throw new Error(`Schema migration required: missing ${table}.${field}`);
 }
 for(const [table,field] of [['wallet','userId'],['payment','appointmentId'],['ledger_entry','operationKey'],['withdrawal','idempotencyKey']]) {
  const indexes=await qi.showIndex(table);
  if(!indexes.some(index=>index.unique && index.fields.length===1 && index.fields[0].attribute===field)) throw new Error(`Schema migration required: unique ${table}.${field}`);
 }
}
module.exports={assertSchema};
