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

  // Mentor settings columns
  const mentorSettingsQueries = [
    "ALTER TABLE mentor ADD COLUMN auto_accept BOOLEAN DEFAULT false;",
    "ALTER TABLE mentor ADD COLUMN instant_booking BOOLEAN DEFAULT false;",
    "ALTER TABLE mentor ADD COLUMN max_sessions_per_day INT DEFAULT 5;",
    "ALTER TABLE mentor ADD COLUMN show_in_explore BOOLEAN DEFAULT true;",
    "ALTER TABLE mentor ADD COLUMN show_pricing BOOLEAN DEFAULT true;",
    "ALTER TABLE mentor ADD COLUMN notif_prefs JSON DEFAULT NULL;",
    "ALTER TABLE mentor ADD COLUMN privacy_settings JSON DEFAULT NULL;"
  ];

  // Mentee settings columns
  const menteeSettingsQueries = [
    "ALTER TABLE mentee ADD COLUMN notif_prefs JSON DEFAULT NULL;",
    "ALTER TABLE mentee ADD COLUMN privacy_settings JSON DEFAULT NULL;"
  ];

  // User columns
  const userQueries = [
    "ALTER TABLE user ADD COLUMN isVerified BOOLEAN DEFAULT false;",
    "ALTER TABLE user ADD COLUMN verificationToken VARCHAR(255) DEFAULT NULL;"
  ];

  // Security, Escrow and Moderation columns
  const securityQueries = [
    "ALTER TABLE appointment ADD COLUMN sessionType VARCHAR(20) DEFAULT 'free';",
    "ALTER TABLE appointment ADD COLUMN mentorJoinTime DATETIME DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN menteeJoinTime DATETIME DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN actualStartTime DATETIME DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN actualEndTime DATETIME DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN endedBy VARCHAR(20) DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN endReason VARCHAR(255) DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN completionMethod VARCHAR(30) DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN disputedBy VARCHAR(20) DEFAULT 'none';",
    "ALTER TABLE appointment ADD COLUMN disputeReason TEXT DEFAULT NULL;",
    "ALTER TABLE review ADD COLUMN status VARCHAR(20) DEFAULT 'pending';",
    "ALTER TABLE mentor_commendation ADD COLUMN status VARCHAR(20) DEFAULT 'pending';"
  ];

  const allQueries = [...appointmentQueries, ...mentorSettingsQueries, ...menteeSettingsQueries, ...userQueries, ...securityQueries];

  for (const query of allQueries) {
     try {
        await db.sequelize.query(query);
        console.log("Executed:", query.substring(0, 60));
     } catch (e) {
        console.log("Skipped (likely exists):", e.message.substring(0, 60));
     }
  }

  process.exit(0);
};

migrate();

