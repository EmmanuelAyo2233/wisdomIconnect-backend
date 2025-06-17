"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Creates database tables: user, mentee, mentor, appointment
    async up( queryInterface, Sequelize )
    {
        // Create user Table
        await queryInterface.createTable( "user", {
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
                type: Sequelize.ENUM( "mentee", "mentor" ),
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
        } );

        // Create menteeProfile Table
        await queryInterface.createTable( "mentee", {
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
            experienceDescription: {
                type: Sequelize.TEXT,
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
                type: Sequelize.STRING,
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
                defaultValue: Sequelize.literal( "CURRENT_TIMESTAMP" ),
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal( "CURRENT_TIMESTAMP" ),
            },
        } );

        // Create mentorProfile Table
        await queryInterface.createTable( "mentor", {
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
            discipline: {
                type: Sequelize.STRING,
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
                defaultValue: Sequelize.literal( "CURRENT_TIMESTAMP" ),
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal( "CURRENT_TIMESTAMP" ),
            },
        } );

        // Create Appointment Table
        await queryInterface.createTable( "appointment", {
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
                defaultValue: Sequelize.literal( "CURRENT_TIMESTAMP" ),
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal( "CURRENT_TIMESTAMP" ),
            },
        } );
    },
    // Drops database tables: appointment, mentee, mentor, user
    async down( queryInterface, Sequelize )
    {
        await queryInterface.dropTable( "appointment" );
        await queryInterface.dropTable( "mentee" );
        await queryInterface.dropTable( "mentor" );
        await queryInterface.dropTable( "user" );
    },
};
