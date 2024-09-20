const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");

// Initialize Express and SQLite (via Sequelize)
const app = express();
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
});

app.use(express.json());

// Define models
const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
});

const Availability = sequelize.define("Availability", {
  userId: {
    type: DataTypes.INTEGER,
    references: { model: "Users", key: "id" },
  },
  startTime: { type: DataTypes.DATE, allowNull: false },
  endTime: { type: DataTypes.DATE, allowNull: false },
});

const BlockedSlot = sequelize.define("BlockedSlot", {
  blockerId: {
    type: DataTypes.INTEGER,
    references: { model: "Users", key: "id" },
  },
  blockeeId: {
    type: DataTypes.INTEGER,
    references: { model: "Users", key: "id" },
  },
  blockerAvailabilityId: {
    type: DataTypes.INTEGER,
    references: { model: "Availabilities", key: "id" },
  },
  blockeeAvailabilityId: {
    type: DataTypes.INTEGER,
    references: { model: "Availabilities", key: "id" },
  },
  blockedStartTime: { type: DataTypes.DATE, allowNull: false },
  blockedEndTime: { type: DataTypes.DATE, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.STRING, allowNull: true },
});

// Convert all input dates to UTC
const toUTC = (date) => new Date(date).toISOString(); // Convert any date to UTC format

// Middleware to handle errors globally
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Set or update availability with UTC conversion
app.post("/availability", async (req, res, next) => {
  const { userId, startTime, endTime } = req.body;

  // Convert times to UTC
  const startUTC = toUTC(startTime);
  const endUTC = toUTC(endTime);

  // Ensure startTime is before endTime
  if (new Date(startTime) >= new Date(endTime)) {
    return res
      .status(400)
      .json({ errors: ["Start time must be before end time."] });
  }

  try {
    // Check for overlap
    const overlap = await Availability.findOne({
      where: {
        userId,
        [Sequelize.Op.or]: [
          { startTime: { [Sequelize.Op.between]: [startTime, endTime] } },
          { endTime: { [Sequelize.Op.between]: [startTime, endTime] } },
        ],
      },
    });

    if (overlap) {
      // If overlap exists, update
      overlap.startTime = startTime;
      overlap.endTime = endTime;
      await overlap.save();
      return res.json({
        message: "Availability updated",
        availability: overlap,
      });
    }

    // Otherwise, create a new availability
    const availability = await Availability.create({
      userId,
      startTime,
      endTime,
    });
    return res.json({ message: "New availability created", availability });
  } catch (error) {
    next(error);
  }
});

// Find overlapping availability between two users
app.get("/availability/overlap/:userId1/:userId2", async (req, res, next) => {
  const { userId1, userId2 } = req.params;

  try {
    // Fetch availability for both users
    const user1Availability = await Availability.findAll({
      where: { userId: userId1 },
    });
    const user2Availability = await Availability.findAll({
      where: { userId: userId2 },
    });

    if (!user1Availability.length || !user2Availability.length) {
      return res
        .status(404)
        .json({ error: "No availability found for one or both users." });
    }

    // Fetch blocked slots for both users
    const user1BlockedSlots = await BlockedSlot.findAll({
      where: { blockerId: userId1 },
    });
    const user2BlockedSlots = await BlockedSlot.findAll({
      where: { blockerId: userId2 },
    });

    // Convert blocked slots into arrays of start and end times
    const user1BlockedTimes = user1BlockedSlots.map((slot) => ({
      blockedStartTime: new Date(slot.blockedStartTime),
      blockedEndTime: new Date(slot.blockedEndTime),
    }));

    const user2BlockedTimes = user2BlockedSlots.map((slot) => ({
      blockedStartTime: new Date(slot.blockedStartTime),
      blockedEndTime: new Date(slot.blockedEndTime),
    }));

    const splitAvailability = (availability, blockedTimes) => {
      const freeSegments = [];
      let currentStart = new Date(availability.startTime);

      blockedTimes.forEach((block) => {
        const blockStart = new Date(block.blockedStartTime);
        const blockEnd = new Date(block.blockedEndTime);

        // Check if block is entirely outside the availability window
        if (
          blockEnd <= currentStart ||
          blockStart >= new Date(availability.endTime)
        ) {
          return; // Ignore blocks outside the availability window
        }

        // Adjust the block start/end times to fit within the availability window
        const validBlockStart =
          blockStart > currentStart ? blockStart : currentStart;
        const validBlockEnd =
          blockEnd < new Date(availability.endTime)
            ? blockEnd
            : new Date(availability.endTime);

        if (currentStart < validBlockStart) {
          // Add free segment before the block
          freeSegments.push({
            startTime: currentStart,
            endTime: validBlockStart,
          });
        }

        // Move the start to the end of the blocked time
        currentStart =
          validBlockEnd > currentStart ? validBlockEnd : currentStart;
      });

      // Add the remaining free segment after the last block
      if (currentStart < new Date(availability.endTime)) {
        freeSegments.push({
          startTime: currentStart,
          endTime: new Date(availability.endTime),
        });
      }

      return freeSegments;
    };

    // Find overlapping slots
    const overlappingSlots = [];

    user1Availability.forEach((slot1) => {
      const user1FreeSegments = splitAvailability(slot1, user1BlockedTimes);

      user2Availability.forEach((slot2) => {
        const user2FreeSegments = splitAvailability(slot2, user2BlockedTimes);

        // Compare free segments between both users to find overlaps
        user1FreeSegments.forEach((segment1) => {
          user2FreeSegments.forEach((segment2) => {
            // Compare the segments by time
            const overlapStart = new Date(
              Math.max(
                new Date(segment1.startTime).getTime(),
                new Date(segment2.startTime).getTime()
              )
            );
            const overlapEnd = new Date(
              Math.min(
                new Date(segment1.endTime).getTime(),
                new Date(segment2.endTime).getTime()
              )
            );

            if (overlapStart < overlapEnd) {
              overlappingSlots.push({
                blockerId: userId1,
                blockeeId: userId2,
                blockerAvailabilityId: slot1.id,
                blockeeAvailabilityId: slot2.id,
                startTime: overlapStart.toISOString(),
                endTime: overlapEnd.toISOString(),
              });
            }
          });
        });
      });
    });

    if (overlappingSlots.length === 0) {
      return res
        .status(404)
        .json({ message: "No overlapping availability found." });
    }

    return res.json({ overlap: overlappingSlots });
  } catch (error) {
    next(error);
  }
});

// Block specific slot with UTC conversion
app.post("/availability/block", async (req, res, next) => {
  const {
    blockerId,
    blockeeId,
    blockerAvailabilityId,
    blockeeAvailabilityId,
    startTime,
    endTime,
    title,
    description,
  } = req.body;

  // Convert blocked times to UTC
  const blockedStartUTC = toUTC(startTime);
  const blockedEndUTC = toUTC(endTime);

  try {
    // Ensure the blocked time is within the user's availability
    const blockerAvailability = await Availability.findOne({
      where: { id: blockerAvailabilityId, userId: blockerId },
    });
    const blockeeAvailability = await Availability.findOne({
      where: { id: blockeeAvailabilityId, userId: blockeeId },
    });

    if (!blockerAvailability || !blockeeAvailability) {
      return res
        .status(404)
        .json({ error: "Availability not found for blocker or blockee." });
    }

    if (
      blockedStartUTC < blockerAvailability.startTime ||
      blockedEndUTC > blockerAvailability.endTime
    ) {
      return res
        .status(400)
        .json({ error: "Blocked time must be within the availability range." });
    }

    // Block the slot for both users
    const blockedSlotUser1 = await BlockedSlot.create({
      blockerId,
      blockeeId,
      blockerAvailabilityId,
      blockeeAvailabilityId,
      blockedStartTime: blockedStartUTC,
      blockedEndTime: blockedEndUTC,
      title: title || null,
      description: description || null,
    });

    const blockedSlotUser2 = await BlockedSlot.create({
      blockerId: blockeeId,
      blockeeId: blockerId,
      blockerAvailabilityId: blockeeAvailabilityId,
      blockeeAvailabilityId: blockerAvailabilityId,
      blockedStartTime: blockedStartUTC,
      blockedEndTime: blockedEndUTC,
      title: title || null,
      description: description || null,
    });

    return res.json({ blockedSlotUser1, blockedSlotUser2 });
  } catch (error) {
    next(error);
  }
});

// View availability with blocked slots in UTC
app.get("/availability/:userId", async (req, res, next) => {
  const { userId } = req.params;

  try {
    const availabilities = await Availability.findAll({ where: { userId } });

    if (!availabilities.length) {
      return res
        .status(404)
        .json({ error: "No availability found for this user." });
    }

    // Fetch all blocked slots where the current user is involved (either as blocker or blockee)
    const blockedSlots = await BlockedSlot.findAll({
      attributes: [
        "id",
        "blockerAvailabilityId",
        "blockeeAvailabilityId",
        "blockedStartTime",
        "blockedEndTime",
        "title",
        "description",
      ],
      where: {
        [Sequelize.Op.or]: [{ blockerId: userId }, { blockeeId: userId }],
      },
    });

    const blockedSlotIds = blockedSlots.map((slot) => ({
      availabilityId:
        userId === slot.blockerId
          ? slot.blockerAvailabilityId
          : slot.blockeeAvailabilityId,
      blockedSlotId: slot.id,
      blockedStartTime: new Date(slot.blockedStartTime).toISOString(),
      blockedEndTime: new Date(slot.blockedEndTime).toISOString(),
      title: slot.title,
      description: slot.description,
    }));

    // Combine availability data with blocked status and blockedSlotId
    const response = availabilities.map((slot) => {
      const blockedSlotsForThisAvailability = blockedSlotIds.filter(
        (b) => b.availabilityId === slot.id
      );
      return {
        id: slot.id,
        startTime: new Date(slot.startTime).toISOString(), // Ensure returned date is in UTC
        endTime: new Date(slot.endTime).toISOString(), // Ensure returned date is in UTC
        blockedSlots: blockedSlotsForThisAvailability,
      };
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Unblock specific slot with UTC handling
app.delete("/availability/block/:blockedSlotId", async (req, res, next) => {
  const { blockedSlotId } = req.params;

  try {
    const deleted = await BlockedSlot.destroy({ where: { id: blockedSlotId } });

    if (!deleted) {
      return res.status(404).json({ error: "Blocked slot not found." });
    }

    res.json({ message: "Slot unblocked successfully." });
  } catch (error) {
    next(error);
  }
});

// Sync the database and start the server
sequelize
  .sync({ force: false })
  .then(() => {
    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });
  })
  .catch((error) => {
    console.error("Failed to sync database:", error);
    process.exit(1);
  });

module.exports = app;
