const { Sequelize, DataTypes } = require('sequelize');

// Initialize SQLite connection
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false, // Disable logging for seeding process
});

// Define models
const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
});

const Availability = sequelize.define('Availability', {
    userId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' } },
    startTime: { type: DataTypes.DATE, allowNull: false },
    endTime: { type: DataTypes.DATE, allowNull: false },
});

const BlockedSlot = sequelize.define('BlockedSlot', {
    blockerId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' } },
    blockeeId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' } },
    blockerAvailabilityId: { type: DataTypes.INTEGER, references: { model: 'Availabilities', key: 'id' } },
    blockeeAvailabilityId: { type: DataTypes.INTEGER, references: { model: 'Availabilities', key: 'id' } },
    blockedStartTime: { type: DataTypes.DATE, allowNull: false },
    blockedEndTime: { type: DataTypes.DATE, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
});

// Function to convert a date string to UTC format
const toUTC = (date) => new Date(date).toISOString();

// Seed data
const seedDatabase = async () => {
    try {
        await sequelize.sync({ force: true }); // Reset the database

        // Create users
        const user1 = await User.create();
        const user2 = await User.create();
        const user3 = await User.create();

        // Create availability slots (1-hour slots)
        const availability1 = await Availability.create({
            userId: user1.id,
            startTime: toUTC('2024-09-21T09:00:00'),  // Availability from 9 AM to 11 AM (in UTC)
            endTime: toUTC('2024-09-21T11:00:00'),
        });

        const availability2 = await Availability.create({
            userId: user2.id,
            startTime: toUTC('2024-09-21T09:00:00'),  // Availability from 9 AM to 11 AM (in UTC)
            endTime: toUTC('2024-09-21T11:00:00'),
        });

        const availability3 = await Availability.create({
            userId: user3.id,
            startTime: toUTC('2024-09-21T10:00:00'),  // Availability from 10 AM to 12 PM (in UTC)
            endTime: toUTC('2024-09-21T12:00:00'),
        });

        // Block specific slots within the availability for both users
        await BlockedSlot.create({
            blockerId: user1.id,
            blockeeId: user2.id,
            blockerAvailabilityId: availability1.id,
            blockeeAvailabilityId: availability2.id,
            blockedStartTime: toUTC('2024-09-21T09:00:00'),  // Blocking only 9 AM to 10 AM (in UTC)
            blockedEndTime: toUTC('2024-09-21T10:00:00'),
            title: "Team Sync",
            description: "Discuss project milestones and blockers.",
        });

        await BlockedSlot.create({
            blockerId: user2.id,
            blockeeId: user1.id,
            blockerAvailabilityId: availability2.id,
            blockeeAvailabilityId: availability1.id,
            blockedStartTime: toUTC('2024-09-21T10:00:00'),  // Blocking only 10 AM to 11 AM (in UTC)
            blockedEndTime: toUTC('2024-09-21T11:00:00'),
            title: "Follow-up Meeting",
            description: "Post-meeting follow-up discussion.",
        });

        console.log('Database seeded successfully!');
    } catch (error) {
        console.error('Error seeding the database:', error);
    }
};

// Execute the seed function
seedDatabase().catch(error => {
    console.error('Error seeding the database:', error);
});
