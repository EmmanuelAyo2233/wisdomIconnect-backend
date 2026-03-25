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

let sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
    sequelize = new Sequelize(
        config.database,
        config.username,
        config.password,
        config
    );
}

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
};
