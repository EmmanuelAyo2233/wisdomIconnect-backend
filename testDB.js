const { User, Mentee, Mentor, Appointment, Review, MentorCommendation, Achievement } = require("./models");
const UserAchievement = require("./models/userAchievement");
const { Op } = require("sequelize");

async function check() {
  try {
    const user = await User.findOne({ 
        where: { userType: "mentee" },
        include: [{ model: Mentee, as: "mentee" }]
    });

    if (!user) {
        console.log("No mentee found");
        process.exit();
    }

    console.log("Testing user:", user.email, user.userType);

    const roleAchievements = await Achievement.findAll({
       where: {
          [Op.or]: [
             { role: user.userType },
             { role: null }
          ]
       }
    });
    console.log("Found roleAchievements:", roleAchievements.length);

    console.log("Checking user achievements...");
    const existingUserAchievements = await UserAchievement.findAll({ where: { user_id: user.id, role: user.userType } });
    console.log("Checked.");

    console.log("Testing findAll include...");
    const finalUserAchievements = await UserAchievement.findAll({
        where: { user_id: user.id, role: user.userType },
        include: [{ model: Achievement, as: "achievement" }]
    });
    console.log("Final user achievements:", finalUserAchievements.length);

    console.log("Testing MentorCommendation include...");
    const commendations = await MentorCommendation.findAll({
        where: { menteeId: user.mentee.id },
        include: [{ model: Mentor, as: "mentor", include: [{ model: User, as: "user", attributes: ["id", "name", "picture"] }] }],
        order: [["createdAt", "DESC"]]
    });
    console.log("Found commendations:", commendations.length);

    console.log("ALL GOOD!");
    process.exit();
  } catch (e) {
    console.error("ERROR CAUGHT:");
    console.error(e.stack);
    process.exit(1);
  }
}
check();
