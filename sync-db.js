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
    "ALTER TABLE mentor ADD COLUMN privacy_settings JSON DEFAULT NULL;",
    "ALTER TABLE mentor ADD COLUMN strikes INT DEFAULT 0;"
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

  // Activity logging table
  const activityQueries = [
    "CREATE TABLE IF NOT EXISTS activities (" +
    "  id INT AUTO_INCREMENT PRIMARY KEY," +
    "  type ENUM('BOOKING', 'PAYMENT', 'SESSION', 'USER', 'SYSTEM') NOT NULL," +
    "  message TEXT NOT NULL," +
    "  userId INT NULL," +
    "  targetId VARCHAR(255) NULL," +
    "  metadata JSON NULL," +
    "  status ENUM('success', 'pending', 'failed') DEFAULT 'success' NOT NULL," +
    "  createdAt DATETIME NOT NULL," +
    "  updatedAt DATETIME NOT NULL," +
    "  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE SET NULL ON UPDATE CASCADE" +
    ");"
  ];

  // Refund and Escrow queries
  const refundEscrowQueries = [
    "ALTER TABLE payment ADD COLUMN escrow_status ENUM('held', 'released', 'refunded', 'disputed') DEFAULT 'held';",
    "ALTER TABLE payment ADD COLUMN refund_reference VARCHAR(255) DEFAULT NULL;",
    "ALTER TABLE payment ADD COLUMN refundedAt DATETIME DEFAULT NULL;",
    "ALTER TABLE payment ADD COLUMN refundReason VARCHAR(255) DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN refund_status ENUM('none', 'pending', 'refunded', 'failed') DEFAULT 'none';",
    "ALTER TABLE appointment ADD COLUMN completion_status ENUM('pending', 'completed', 'disputed', 'cancelled') DEFAULT 'pending';",
    "ALTER TABLE appointment ADD COLUMN mentor_reason TEXT DEFAULT NULL;",
    "ALTER TABLE appointment ADD COLUMN mentee_reason TEXT DEFAULT NULL;",
    "ALTER TABLE refund_request ADD COLUMN appointmentId INT DEFAULT NULL;",
    "ALTER TABLE refund_request ADD COLUMN mentorId INT DEFAULT NULL;",
    "ALTER TABLE refund_request ADD COLUMN reasonType ENUM('no_show', 'technical', 'cancelled', 'misconduct', 'duration', 'other') DEFAULT 'other';",
    "ALTER TABLE refund_request ADD COLUMN evidenceUrl VARCHAR(500) DEFAULT NULL;",
    "ALTER TABLE refund_request ADD CONSTRAINT fk_refund_appointment FOREIGN KEY (appointmentId) REFERENCES appointment(id) ON DELETE SET NULL;",
    "ALTER TABLE refund_request ADD CONSTRAINT fk_refund_mentor FOREIGN KEY (mentorId) REFERENCES mentor(id) ON DELETE SET NULL;"
  ];

  // KYC queries
  const kycQueries = [
    "ALTER TABLE mentor ADD COLUMN kyc_status ENUM('not_verified','pending','verified','rejected') DEFAULT 'not_verified';",
    "ALTER TABLE mentor ADD COLUMN kyc_rejection_reason TEXT DEFAULT NULL;",
    "CREATE TABLE IF NOT EXISTS mentor_kyc (" +
    "  id INT AUTO_INCREMENT PRIMARY KEY," +
    "  mentor_id INT NOT NULL," +
    "  id_type ENUM('national_id','drivers_license','international_passport','voters_card') NOT NULL," +
    "  id_document_url VARCHAR(500) NOT NULL," +
    "  selfie_url VARCHAR(500) NOT NULL," +
    "  phone_number VARCHAR(50) DEFAULT NULL," +
    "  status ENUM('pending','verified','rejected') DEFAULT 'pending'," +
    "  admin_note TEXT DEFAULT NULL," +
    "  reviewed_by INT DEFAULT NULL," +
    "  reviewed_at DATETIME DEFAULT NULL," +
    "  createdAt DATETIME NOT NULL," +
    "  updatedAt DATETIME NOT NULL," +
    "  FOREIGN KEY (mentor_id) REFERENCES mentor(id) ON DELETE CASCADE" +
    ");"
  ];

  // Reviews and Commendations - isFlagged and isHidden columns
  const reviewCommendationQueries = [
    "ALTER TABLE review ADD COLUMN isFlagged BOOLEAN DEFAULT false;",
    "ALTER TABLE review ADD COLUMN isHidden BOOLEAN DEFAULT false;",
    "ALTER TABLE mentor_commendation ADD COLUMN isFlagged BOOLEAN DEFAULT false;",
    "ALTER TABLE mentor_commendation ADD COLUMN isHidden BOOLEAN DEFAULT false;",
    "ALTER TABLE review MODIFY COLUMN status VARCHAR(20) DEFAULT 'approved';",
    "ALTER TABLE mentor_commendation MODIFY COLUMN status VARCHAR(20) DEFAULT 'approved';"
  ];

  

  const allQueries = [
    ...appointmentQueries, 
    ...mentorSettingsQueries, 
    ...menteeSettingsQueries, 
    ...userQueries, 
    ...securityQueries, 
    ...activityQueries,
    ...refundEscrowQueries,
    ...kycQueries,
    ...reviewCommendationQueries
  ];

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

