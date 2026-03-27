const cron = require("node-cron");
const moment = require("moment");

const Block = require("../models/block.model");
const Table = require("../models/table.model");
const Shift = require("../models/shift.model");

/**
 * Runs every 5 minutes
 */
cron.schedule("*/5 * * * *", async () => {
    try {
        const now = new Date();
        const today = moment().startOf("day");

        const expiredBlocks = await Block.find({
            status: "Active",
            isExpired: false,
            $or: [
                { endDate: { $lt: now } },

                {
                    endDate: {
                        $gte: today.toDate(),
                        $lte: moment().endOf("day").toDate()
                    },
                    endTime: { $ne: null }
                }
            ]
        });

        if (!expiredBlocks.length) return;

        for (const block of expiredBlocks) {

            const stillActiveBlocks = await Block.find({
                _id: { $ne: block._id },
                restaurantId: block.restaurantId,
                status: "Active",
                isExpired: false,
                startDate: { $lte: now },
                endDate: { $gte: now }
            });

            const stillBlockedTableIds = new Set();
            const stillBlockedShiftIds = new Set();

            for (const b of stillActiveBlocks) {
                b.tableIds?.forEach(id => stillBlockedTableIds.add(id.toString()));
                b.shiftIds?.forEach(id => stillBlockedShiftIds.add(id.toString()));
            }

            if (block.isFullRestaurantBlock) {

                const allTables = await Table.find({
                    restaurantId: block.restaurantId
                }).select("_id");

                const tableIdsToUnblock = allTables
                    .map(t => t._id.toString())
                    .filter(id => !stillBlockedTableIds.has(id));

                await Table.updateMany(
                    { _id: { $in: tableIdsToUnblock } },
                    { $set: { isActive: true }, $unset: { blockPriority: "" } }
                );
            }

            if (block.tableIds?.length) {
                const tableIdsToUnblock = block.tableIds
                    .map(id => id.toString())
                    .filter(id => !stillBlockedTableIds.has(id));

                if (tableIdsToUnblock.length) {
                    await Table.updateMany(
                        { _id: { $in: tableIdsToUnblock } },
                        { $set: { isActive: true }, $unset: { blockPriority: "" } }
                    );
                }
            }

            if (block.shiftIds?.length) {
                const shiftIdsToUnblock = block.shiftIds
                    .map(id => id.toString())
                    .filter(id => !stillBlockedShiftIds.has(id));

                if (shiftIdsToUnblock.length) {
                    await Shift.updateMany(
                        { _id: { $in: shiftIdsToUnblock } },
                        { $set: { isActive: true }, $unset: { blockPriority: "" } }
                    );
                }
            }

            block.isExpired = true;
            block.status = "Expired";
            await block.save();
        }

        console.log(`${expiredBlocks.length} block(s) auto-unblocked`);
    } catch (err) {
        console.error("Block expiry job error:", err);
    }
});
