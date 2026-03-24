const Mentor = require("./models/mentor");
(async () => {
    try {
        await Mentor.sync({ alter: true });
        console.log("Mentor table synced with certificateUrl.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
