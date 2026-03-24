const sequelize = require("./config/db");
const User = require("./models/user");
const { bcrypt, salt } = require("./config/reuseablePackages");

async function seedAdmin() {
    try {
        await sequelize.authenticate();
        console.log("Database connected.");
        
        // We might need to manually sync or alter table to accommodate the ENUM change if sequelize alter isn't working as expected in older setup,
        // but let's try just altering the table:
        await sequelize.query("ALTER TABLE user CHANGE COLUMN userType userType ENUM('mentor', 'mentee', 'admin') NOT NULL;").catch(e => console.log("Alter enum ignored or failed:", e.message));
        
        const adminEmail = "admin@wisdomconnect.com";
        const adminPassword = "password123";
        
        const existingAdmin = await User.findOne({ where: { email: adminEmail } });
        if (existingAdmin) {
            console.log("Admin already exists!");
            process.exit(0);
        }
        
        const hashedPassword = await bcrypt.hash(adminPassword, salt);
        
        await User.create({
            name: "Wisdom Admin",
            email: adminEmail,
            password: hashedPassword,
            userType: "admin",
            status: "approved"
        });
        
        console.log("✅ Admin account created successfully!");
        console.log("Email: " + adminEmail);
        console.log("Password: " + adminPassword);
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Failed to create admin:", error);
        process.exit(1);
    }
}

seedAdmin();
