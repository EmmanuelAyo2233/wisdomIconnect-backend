const {test}=require('node:test');
const assert=require('node:assert/strict');
const {publicUser,hashCode,otp}=require('../utils/security');
test('public users never contain password or verification credentials',()=>{
 const user=publicUser({id:1,name:'Test',password:'secret',verificationToken:'otp',passwordResetToken:'reset',tokenVersion:1});
 assert.deepEqual(user,{id:1,name:'Test'});
 assert.equal(hashCode('123456').length,64);
 for(let i=0;i<100;i++) assert.match(otp(),/^\d{6}$/);
});
