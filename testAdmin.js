require("dotenv").config();
const { User } = require("./models");
const jwt = require("jsonwebtoken");
const axios = require('axios');
const { SECRET_KEY } = require("./config/reuseablePackages");

async function check() {
  try {
    const user = await User.findOne({ where: { userType: 'mentee' }});
    if (!user) {
        console.log("NO user found"); 
        return process.exit();
    }
    
    console.log("Testing as:", user.email);
    const tokenPayload = {
      id: user.id,
      email: user.email,
      userType: user.userType,
      status: user.status
    };

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: "7d" });

    const meRes = await axios.get('http://127.0.0.1:5000/api/v1/user/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("SUCCESS:");
    console.log(meRes.data);

    // Also testing mentor
    const user2 = await User.findOne({ where: { userType: 'mentor' }});
    if(user2) {
       console.log("Testing as:", user2.email);
       const token2 = jwt.sign({
         id: user2.id,
         email: user2.email,
         userType: user2.userType,
         status: user2.status
       }, SECRET_KEY, { expiresIn: "7d" });
       const meRes2 = await axios.get('http://127.0.0.1:5000/api/v1/user/me', {
         headers: { Authorization: `Bearer ${token2}` }
       });
       console.log("SUCCESS 2:");
       console.log(JSON.stringify(meRes2.data.data.achievements, null, 2));
    }

    process.exit();
  } catch (e) {
    if (e.response) {
      console.error("ERROR from server:");
      console.error(JSON.stringify(e.response.data, null, 2));
    } else {
      console.error("ERROR:", e);
    }
    process.exit(1);
  }
}
check();
