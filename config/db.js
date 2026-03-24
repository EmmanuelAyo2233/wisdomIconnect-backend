const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "wisdomconnect_test",
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    dialect: "mysql",
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true, // some cloud DBs require this
      },
    },
    logging: false, // optional
  }
);

sequelize
  .authenticate()
  .then(() => {
     console.log("Database connected successfully");
     sequelize.query("ALTER TABLE chatmessage ADD COLUMN fileUrl VARCHAR(500) DEFAULT NULL;").catch(e=>{});
     sequelize.query("ALTER TABLE chatmessage ADD COLUMN fileType VARCHAR(50) DEFAULT NULL;").catch(e=>{});
     sequelize.query("ALTER TABLE chatmessage ADD COLUMN fileName VARCHAR(255) DEFAULT NULL;").catch(e=>{});
     sequelize.query("ALTER TABLE chatmessage ADD COLUMN isRead BOOLEAN DEFAULT false;").catch(e=>{});
     sequelize.query("ALTER TABLE chatmessage ADD COLUMN isDeleted BOOLEAN DEFAULT false;").catch(e=>{});
     sequelize.query("ALTER TABLE chatmessage ADD COLUMN deletedForSenderId INT DEFAULT NULL;").catch(e=>{});
     sequelize.query("ALTER TABLE chatmessage MODIFY message TEXT;").catch(e=>{});
     
     // New for Connection Deletion History
     sequelize.query("ALTER TABLE connection ADD COLUMN deletedAtMentor DATETIME DEFAULT NULL;").catch(e=>{});
     sequelize.query("ALTER TABLE connection ADD COLUMN deletedAtMentee DATETIME DEFAULT NULL;").catch(e=>{});
  })
  .catch((err) => console.error("Database connection error:", err));

module.exports = sequelize;
