const { db } = require("./models");

const migrate = async () => {
  // Appointment columns
  const appointmentQueries = [
    "ALTER TABLE appointment ADD COLUMN meetingLink VARCHAR(255) DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN mentorConfirmed BOOLEAN DEFAULT false;",
    "ALTER TABLE appointment ADD COLUMN menteeConfirmed BOOLEAN DEFAULT false;",
    "ALTER TABLE appointment ADD COLUMN callStartedAt DATETIME DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN callEndedAt DATETIME DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN autoCompleted BOOLEAN DEFAULT false;"
  ];

  for (const query of appointmentQueries) {
     try {
        await db.sequelize.query(query);
        console.log("Executed:", query.substring(0, 50));
     } catch (e) {
        console.log("Failed (likely exists):", e.message.substring(0, 50));
     }
  }

  process.exit(0);
};

migrate();
