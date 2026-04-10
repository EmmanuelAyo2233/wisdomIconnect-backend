"use strict";
const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const process = require("process");
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.js")[env];
const db = {};
const User = require("./user");
const Mentee = require("./mentee");
const Mentor = require("./mentor");
const Appointment = require("./appointment");
const ChatMessage = require("./chatmessage");
const Comment = require("./comment");
const Post = require("./post");
const Availability = require("./availability");
const Connection = require("./connection");
const Playbook = require("./playbook");
const PlaybookLike = require("./playbookLike");
const PlaybookView = require("./playbookView");
const SavedPlaybook = require("./savedPlaybook");
const MessageRequest = require("./messageRequest");
const Notification = require("./notification");
const PlaybookComment = require("./playbookComment");
const Review = require("./review");
const MentorCommendation = require("./mentorCommendation");
const Payment = require("./payment");
const Wallet = require("./wallet");
const Withdrawal = require("./withdrawal");
const Achievement = require("./achievement");
const UserAchievement = require("./userAchievement");

const sequelize = require("../config/db");

fs.readdirSync(__dirname)
    .filter((file) => {
        return (
            file.indexOf(".") !== 0 &&
            file !== basename &&
            file.slice(-3) === ".js" &&
            file.indexOf(".test.js") === -1
        );
    })
    .forEach((file) => {
        const model = require(path.join(__dirname, file));
        db[model.name] = model;
    });

Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Define Associations
User.hasOne(Mentor, { foreignKey: "user_id", as: "mentor" });
Mentor.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasOne(Mentee, { foreignKey: "user_id", as: "mentee" });
Mentee.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Mentor.hasMany(Appointment, { foreignKey: "mentorId", as: "appointment" });
// Appointment.belongsTo(Mentor, { foreignKey: "mentorId", as: "mentor" });

Mentor.hasMany(Connection, { foreignKey: "mentorId", as: "connections" });
Connection.belongsTo(Mentor, { foreignKey: "mentorId", as: "mentor" });

Mentee.hasMany(Connection, { foreignKey: "menteeId", as: "connections" });
Connection.belongsTo(Mentee, { foreignKey: "menteeId", as: "mentee" });

// Mentee.hasMany(Appointment, { foreignKey: "menteeId", as: "appointment" });
// Appointment.belongsTo(Mentee, { foreignKey: "menteeId", as: "mentee" });

Appointment.hasOne(Review, { foreignKey: "appointmentId", as: "review" });
Appointment.hasOne(MentorCommendation, { foreignKey: "appointmentId", as: "commendation" });
Appointment.hasOne(Payment, { foreignKey: "appointmentId", as: "payment" });

Connection.hasMany(ChatMessage, {
    foreignKey: "chatAccessId",
    as: "chatMessage",
});
ChatMessage.belongsTo(Connection, {
    foreignKey: "chatAccessId",
    as: "connection",
});

User.hasMany(ChatMessage, { foreignKey: "senderId", as: "sentMessages" });
ChatMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });

User.hasMany(Post, { foreignKey: "userId", as: "post" });
Post.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Comment, { foreignKey: "userId", as: "comment" });
Comment.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Availability, { foreignKey: "mentorId", as: "availability" });
Availability.belongsTo(User, { foreignKey: "mentorId", as: "mentorUser" });

Post.hasMany(Comment, { foreignKey: "postId", as: "comment" });
Comment.belongsTo(Post, { foreignKey: "postId", as: "post" });

User.hasMany(Playbook, { foreignKey: "mentor_id", as: "playbooks" });
Playbook.belongsTo(User, { foreignKey: "mentor_id", as: "mentor" });

// Playbook Likes
User.hasMany(PlaybookLike, { foreignKey: "user_id", as: "playbookLikes" });
PlaybookLike.belongsTo(User, { foreignKey: "user_id", as: "user" });
Playbook.hasMany(PlaybookLike, { foreignKey: "playbook_id", as: "playbookLikes" });
PlaybookLike.belongsTo(Playbook, { foreignKey: "playbook_id", as: "playbook" });

// Playbook Views
User.hasMany(PlaybookView, { foreignKey: "user_id", as: "playbookViews" });
PlaybookView.belongsTo(User, { foreignKey: "user_id", as: "user" });
Playbook.hasMany(PlaybookView, { foreignKey: "playbook_id", as: "playbookViews" });
PlaybookView.belongsTo(Playbook, { foreignKey: "playbook_id", as: "playbook" });

// Saved Playbooks
User.hasMany(SavedPlaybook, { foreignKey: "user_id", as: "savedPlaybooks" });
SavedPlaybook.belongsTo(User, { foreignKey: "user_id", as: "user" });
Playbook.hasMany(SavedPlaybook, { foreignKey: "playbook_id", as: "savedPlaybooks" });
SavedPlaybook.belongsTo(Playbook, { foreignKey: "playbook_id", as: "playbook" });

// Playbook Comments
User.hasMany(PlaybookComment, { foreignKey: "user_id", as: "playbookComments" });
PlaybookComment.belongsTo(User, { foreignKey: "user_id", as: "user" });
Playbook.hasMany(PlaybookComment, { foreignKey: "playbook_id", as: "comments" });
PlaybookComment.belongsTo(Playbook, { foreignKey: "playbook_id", as: "playbook" });
PlaybookComment.hasMany(PlaybookComment, { foreignKey: "parent_id", as: "replies" });
PlaybookComment.belongsTo(PlaybookComment, { foreignKey: "parent_id", as: "parentComment" });

// Message Requests
Mentee.hasMany(MessageRequest, { foreignKey: "mentee_id", as: "messageRequests" });
MessageRequest.belongsTo(Mentee, { foreignKey: "mentee_id", as: "mentee" });
Mentor.hasMany(MessageRequest, { foreignKey: "mentor_id", as: "messageRequests" });
MessageRequest.belongsTo(Mentor, { foreignKey: "mentor_id", as: "mentor" });

// Gamification
User.hasMany(UserAchievement, { foreignKey: "user_id", as: "achievements" });
UserAchievement.belongsTo(User, { foreignKey: "user_id", as: "user" });

Achievement.hasMany(UserAchievement, { foreignKey: "achievement_id", as: "earnedBy" });
UserAchievement.belongsTo(Achievement, { foreignKey: "achievement_id", as: "achievement" });

module.exports = {
    db,
    User,
    Mentee,
    Mentor,
    Appointment,
    ChatMessage,
    Post,
    Comment,
    Availability,
    Connection,
    Playbook,
    PlaybookLike,
    PlaybookView,
    SavedPlaybook,
    MessageRequest,
    Notification,
    PlaybookComment,
    Review,
    MentorCommendation,
    Payment,
    Wallet,
    Withdrawal,
};
