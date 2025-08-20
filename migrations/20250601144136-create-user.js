"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Creates database tables: user, mentee, mentor, appointment
    async up(queryInterface, Sequelize) {
        // Create user Table
        await queryInterface.createTable("user", {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            email: {
                type: Sequelize.STRING,
                unique: true,
                allowNull: false,
            },
            password: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            userType: {
                type: Sequelize.ENUM("mentee", "mentor"),
                allowNull: false,
            },
            picture: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            createdAt: {
                type: Sequelize.DATEONLY,
                allowNull: true,
            },
            updatedAt: {
                type: Sequelize.DATEONLY,
                allowNull: true,
            },
        });

        // Create menteeProfile Table
        await queryInterface.createTable("mentee", {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            bio: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            gender: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            role: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "user",
                    key: "id",
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },
            interest: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            startDate: {
                type: Sequelize.DATEONLY,
                allowNull: true,
            },
            endDate: {
                type: Sequelize.DATEONLY,
                allowNull: true,
            },
            phone: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            fluentIn: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            createdAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });

        // Create mentorProfile Table
        await queryInterface.createTable("mentor", {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            bio: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            experienceDescription: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            role: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            gender: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "user",
                    key: "id",
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },
            yearsOfExperience: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            linkedInUrl: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            education: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            experience: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            phone: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            available: {
                type: Sequelize.BOOLEAN,
                allowNull: true,
            },
            slotBooked: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            expertise: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            fluentIn: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            createdAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });

        // Create Appointment Table
        await queryInterface.createTable("appointment", {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            mentorId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "mentor",
                    key: "id",
                },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            menteeId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "mentee",
                    key: "id",
                },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            accessCode: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            session: {
                type: Sequelize.STRING, // e.g., 'successful', 'cancelled'
                allowNull: true,
            },
            date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            time: {
                type: Sequelize.TIME,
                allowNull: false,
            },
            status: {
                type: Sequelize.STRING,
                defaultValue: null, // e.g. booked, cancelled, completed
            },
            createdAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });

        // Create Chat Access Table
        await queryInterface.createTable("chataccess", {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            accessCode: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            mentorId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "mentor", // ✅ should match table name in DB
                    key: "id",
                },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            menteeId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "mentee", // ✅ should match table name in DB
                    key: "id",
                },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            bookingId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "appointment", // ✅ Sequelize pluralizes table names by default
                    key: "id",
                },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });

        // Create chatMessage Table
        await queryInterface.createTable("chatmessage", {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            chatAccessId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "chataccess",
                    key: "id",
                },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            },
            senderId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "user", // <-- reference user table
                    key: "id", // <-- reference id column
                },
                onDelete: "CASCADE", // if user deleted, delete related messages
                onUpdate: "CASCADE",
            },
            message: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });

        // Creat Post Table
        await queryInterface.createTable("post", {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "user", // <-- reference user table
                    key: "id", // <-- reference id column
                },
                onDelete: "CASCADE", // if user deleted, delete related messages
                onUpdate: "CASCADE",
            },
            title: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });

        // Create Comment Table
        await queryInterface.createTable("comment", {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            postId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "post", // <-- reference post table
                    key: "id", // <-- reference id column
                },
                onDelete: "CASCADE", // if post deleted, delete related messages
                onUpdate: "CASCADE",
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: "user", // <-- reference user table
                    key: "id", // <-- reference id column
                },
                onDelete: "CASCADE", // if user deleted, delete related messages
                onUpdate: "CASCADE",
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });

        // Create Availability Table
        await queryInterface.createTable("availability", {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            time: {
                type: Sequelize.TIME,
                allowNull: false,
            },
            mentorId: {
                type: Sequelize.INTEGER,
                references: {
                    model: "user",
                    key: "id",
                },
                onDelete: "CASCADE",
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: true,
            },
        });
    },
    // Drops database tables: appointment, mentee, mentor, user
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable("availability");
        await queryInterface.dropTable("comment");
        await queryInterface.dropTable("post");
        await queryInterface.dropTable("chatmessage");
        await queryInterface.dropTable("chataccess");
        await queryInterface.dropTable("appointment");
        await queryInterface.dropTable("mentee");
        await queryInterface.dropTable("mentor");
        await queryInterface.dropTable("user");
    },
};
