const mysql = require("mysql2");

console.log("Connecting...");
const connection = mysql.createConnection({
  host: "gateway01.us-west-2.prod.aws.tidbcloud.com",
  port: 4000,
  user: "46jKsXywegLUNXp.root",
  password: "Y7S2xFZ5LeNwWcNW",
  database: "wisdomconnect_test",
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  },
  connectTimeout: 10000
});

connection.connect((err) => {
  if (err) {
    console.error("❌ Connection failed:", err.message);
  } else {
    console.log("✅ Successfully connected to the database!");
    connection.query("SHOW TABLES;", (err, rows) => {
      if (err) {
        console.error("❌ Show tables failed:", err.message);
      } else {
        console.log("Tables:", rows);
      }
      connection.end();
    });
  }
});
