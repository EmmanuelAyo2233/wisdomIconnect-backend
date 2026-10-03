const { Op } = require('sequelize');
const { HttpError, positiveId, text } = require('../utils/security');
const { toMinor, fromMinor } = require('../utils/money');
const models = () => require('../models');

function times(date, startTime, endTime) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date))
    throw new HttpError(400, 'Choose a valid date');
  const pattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/;
  if (!pattern.test(startTime) || !pattern.test(endTime)) throw new HttpError(400, 'Choose valid session times');
  const start = new Date(`${date}T${startTime}+01:00`);
  const end = new Date(`${date}T${endTime}+01:00`);
  if (start <= new Date() || end <= start) throw new HttpError(400, 'Choose a future session with an end after its start');
  return { start, end };
}
async function owner(user, transaction) {
  if (user.userType !== 'mentor') throw new HttpError(403, 'Mentor required');
  const mentor = await models().Mentor.findOne({where:{user_id:user.id},transaction,lock:transaction.LOCK.UPDATE});
  if (!mentor || user.status !== 'approved') throw new HttpError(403, 'Mentor approval required');
  return mentor;
}
async function noOverlap(userId, date, startTime, endTime, transaction, exceptId) {
  const where = {mentorId:userId,date,startTime:{[Op.lt]:endTime},endTime:{[Op.gt]:startTime}};
  if (exceptId) where.id = {[Op.ne]:exceptId};
  if (await models().Availability.findOne({where,transaction})) throw new HttpError(409, 'Availability overlaps an existing slot');
}
async function create(user, body) {
  const { start, end } = times(body.date,body.startTime,body.endTime);
  if (!['fixed','topic'].includes(body.session_type)) throw new HttpError(400, 'Choose a session type');
  const title = text(body.title || body.session_title || 'Mentorship Session','Title',255);
  const topic = body.session_type === 'fixed' ? text(body.topic_name,'Topic',255) : null;
  return models().db.sequelize.transaction(async transaction => {
    const mentor = await owner(user,transaction);
    const duration = Number(body.custom_duration ?? mentor.default_duration ?? 30);
    if (!Number.isInteger(duration) || duration < 5 || duration > 240) throw new HttpError(400, 'Duration must be 5 to 240 minutes');
    const amount = toMinor(body.price ?? (user.mentorLevel === 'starter' ? 0 : mentor.sessionPrice || 0));
    if (amount > (user.mentorLevel === 'gold' ? 5000000 : 2000000) || (amount && (user.mentorLevel === 'starter' || mentor.kyc_status !== 'verified')))
      throw new HttpError(403, 'Your mentor level and KYC must permit the session price');
    await noOverlap(user.id,body.date,body.startTime,body.endTime,transaction);
    const slots=[];
    for (let cursor=start.getTime();cursor+duration*60000<=end.getTime();cursor+=duration*60000) {
      if (slots.length >= 100) throw new HttpError(400, 'Create at most 100 slots at a time');
      const format = value => new Date(value+3600000).toISOString().slice(11,19);
      slots.push({mentorId:user.id,date:body.date,day:new Intl.DateTimeFormat('en',{weekday:'long',timeZone:'Africa/Lagos'}).format(start),startTime:format(cursor),endTime:format(cursor+duration*60000),session_type:body.session_type,session_title:title,title,topic_name:topic,price:fromMinor(amount),status:'available',custom_duration:duration});
    }
    if (!slots.length) throw new HttpError(400, 'Duration exceeds the selected time range');
    return models().Availability.bulkCreate(slots,{transaction});
  });
}
async function change(user, id, body, remove=false) {
  return models().db.sequelize.transaction(async transaction => {
    await owner(user,transaction);
    const slot = await models().Availability.findOne({where:{id:positiveId(id),mentorId:user.id},transaction,lock:transaction.LOCK.UPDATE});
    if (!slot) throw new HttpError(404,'Availability not found');
    if (slot.status !== 'available') throw new HttpError(409,'Reserved availability cannot be modified');
    if (remove) {
      if (await models().Appointment.count({where:{slotId:slot.id},transaction})) throw new HttpError(409,'This slot is retained for booking history');
      await slot.destroy({transaction});return;
    }
    if (body.status && body.status !== 'available') throw new HttpError(400,'Only booking operations can reserve a slot');
    const values={date:body.date ?? slot.date,startTime:body.startTime ?? slot.startTime,endTime:body.endTime ?? slot.endTime};
    times(values.date,values.startTime,values.endTime);
    await noOverlap(user.id,values.date,values.startTime,values.endTime,transaction,slot.id);
    return slot.update(values,{transaction});
  });
}
module.exports = { create, change, times };
