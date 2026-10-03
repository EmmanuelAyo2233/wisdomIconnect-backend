require('dotenv').config();
try {
 require('../config/envValidator')();
 console.log('Configuration checks passed. Secret values are not printed.');
} catch(error) {console.error(error.message);process.exitCode=1;}
