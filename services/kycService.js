const {HttpError,positiveId,text}=require('../utils/security');
const models=()=>require('../models');
async function submit(user,values) {
 if(user.userType!=='mentor') throw new HttpError(403,'Mentor required');
 return models().db.sequelize.transaction(async transaction=>{
  const {Mentor,MentorKyc}=models();
  const mentor=await Mentor.findOne({where:{user_id:user.id},transaction,lock:transaction.LOCK.UPDATE});
  if(!mentor) throw new HttpError(404,'Mentor not found');
  if(['pending','verified'].includes(mentor.kyc_status)) throw new HttpError(409,'Your KYC is already submitted or verified');
  const record=await MentorKyc.findOne({where:{mentorId:mentor.id},transaction,lock:transaction.LOCK.UPDATE});
  const data={...values,mentorId:mentor.id,status:'pending',admin_note:null,reviewed_by:null,reviewed_at:null};
  const kyc=record ? await record.update(data,{transaction}):await MentorKyc.create(data,{transaction});
  await mentor.update({kyc_status:'pending',kyc_rejection_reason:null},{transaction});
  return kyc;
 });
}
async function review(admin,id,action,note) {
 if(admin.userType!=='admin') throw new HttpError(403,'Admin required');
 if(!['approve','reject'].includes(action)) throw new HttpError(400,'Choose approve or reject');
 const reason=text(note || (action==='approve'?'Verified by admin':''),'Review note',2000);
 return models().db.sequelize.transaction(async transaction=>{
  const {Mentor,MentorKyc,AdminLog}=models();
  const snapshot=await MentorKyc.findByPk(positiveId(id),{transaction});
  if(!snapshot) throw new HttpError(404,'KYC not found');
  const mentor=await Mentor.findByPk(snapshot.mentorId,{transaction,lock:transaction.LOCK.UPDATE});
  const kyc=await MentorKyc.findByPk(snapshot.id,{transaction,lock:transaction.LOCK.UPDATE});
  if(!mentor || kyc.status!=='pending') throw new HttpError(409,'KYC already reviewed');
  const status=action==='approve'?'verified':'rejected';
  await kyc.update({status,admin_note:reason,reviewed_by:admin.id,reviewed_at:new Date()},{transaction});
  await mentor.update({kyc_status:status,kyc_rejection_reason:status==='rejected'?reason:null},{transaction});
  await AdminLog.create({adminId:admin.id,action:`KYC_${action.toUpperCase()}`,targetId:String(kyc.id),details:reason},{transaction});
  return {kyc,mentor};
 });
}
module.exports={submit,review};
