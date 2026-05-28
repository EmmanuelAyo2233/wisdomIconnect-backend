const mysql = require("mysql2");

console.log("Connecting with rejectUnauthorized: true...");
const connection = mysql.createConnection({
  host: "gateway01.us-west-2.prod.aws.tidbcloud.com",
  port: 4000,
  user: "46jKsXywegLUNXp.root",
  password: "Y7S2xFZ5LeNwWcNW",
  database: "wisdomconnect_test",
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  connectTimeout: 10000
});

connection.connect((err) => {
  if (err) {
    console.error("❌ Connection failed:", err.message);
  } else {
    console.log("✅ Successfully connected to the database!");
    connection.end();
  }
});
