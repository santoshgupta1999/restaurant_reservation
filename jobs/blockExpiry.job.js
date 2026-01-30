const cron = require("node-cron");
const Block = require("../models/block.model");
const Table = require("../models/table.model");
const Shift = require("../models/shift.model");

/**
 * Runs every 5 minutes
 */
cron.schedule("*/5 * * * *", async () => {
    try {
        const now = new Date();

        const expiredBlocks = await Block.find({
            status: "Active",
            isExpired: false,
            endDate: { $lt: now }
        });

        if (!expiredBlocks.length) return;

        for (const block of expiredBlocks) {

            if (block.tableIds?.length) {
                await Table.updateMany(
                    { _id: { $in: block.tableIds } },
                    { $set: { isActive: true }, $unset: { blockPriority: "" } }
                );
            }

            if (block.shiftIds?.length) {
                await Shift.updateMany(
                    { _id: { $in: block.shiftIds } },
                    { $set: { isActive: true }, $unset: { blockPriority: "" } }
                );
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
