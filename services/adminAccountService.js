const { HttpError, positiveId, text, publicUser } = require('../utils/security');
const models = () => require('../models');
async function change(admin,id,action,reason='') {
  if (admin.userType !== 'admin') throw new HttpError(403,'Admin required');
  return models().db.sequelize.transaction(async transaction => {
    const {User,Mentor,Mentee,Appointment,AdminLog}=models();
    const user=await User.findByPk(positiveId(id),{transaction,lock:transaction.LOCK.UPDATE});
    if (!user) throw new HttpError(404,'User not found');
    if (user.userType === 'admin' || user.id === admin.id) throw new HttpError(403,'This action cannot modify an administrator');
    const mentor=await Mentor.findOne({where:{user_id:user.id},transaction,lock:transaction.LOCK.UPDATE});
    const updates={};
    if (action === 'approve') {
      if (user.userType !== 'mentor' || !mentor || user.status !== 'pending' || user.accountStatus !== 'active') throw new HttpError(409,'Only an active pending mentor can be approved');
      updates.status='approved';updates.approvedAt=new Date();
    } else if (action === 'reject') {
      if (user.userType !== 'mentor' || !mentor) throw new HttpError(409,'Mentor profile required');
      if (await Appointment.count({where:{mentorId:mentor.id},transaction})) throw new HttpError(409,'A mentor with bookings must be suspended instead');
      updates.userType='mentee';updates.status='rejected';
      await Mentee.findOrCreate({where:{user_id:user.id},defaults:{user_id:user.id},transaction});
    } else if (action === 'reconsider') {
      if (!mentor || user.status !== 'rejected' || user.accountStatus !== 'active') throw new HttpError(409,'Only a rejected mentor application can be reconsidered');
      updates.userType='mentor';updates.status='pending';updates.approvedAt=null;
    } else if (['deactivate_mentor','deactivate_mentee','suspend','ban'].includes(action)) {
      if (action.startsWith('deactivate_') && user.userType !== action.slice(11)) throw new HttpError(404,'Account not found');
      updates.accountStatus=action === 'ban' ? 'banned':'suspended';
    } else throw new HttpError(400,'Invalid account action');
    updates.tokenVersion=(user.tokenVersion || 0)+1;
    await user.update(updates,{transaction});
    await AdminLog.create({adminId:admin.id,action:action.toUpperCase(),targetId:String(user.id),details:text(reason,'Reason',2000,false)},{transaction});
    return publicUser(user);
  });
}
module.exports={change};
