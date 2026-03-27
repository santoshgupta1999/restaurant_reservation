const cron = require("node-cron");
const moment = require("moment");

const Table = require("../models/table.model");

cron.schedule("0 2 * * *", async () => {
    console.log("Running auto-unlock job...");

    try {

        const todayStart = moment().startOf("day");

        const tablesToUnlock = await Table.find({
            status: "OutOfService",
            lockedAt: { $lt: todayStart.toDate() }
        }).select("_id");

        if (!tablesToUnlock.length) return;

        const tableIds = tablesToUnlock.map(t => t._id);

        await Table.updateMany(
            { _id: { $in: tableIds } },
            {
                $set: { status: "Available" },
                $unset: {
                    lockReason: "",
                    lockedBy: "",
                    lockedAt: ""
                }
            }
        );

        console.log(`Auto unlocked ${tableIds.length} table(s)`);

    } catch (error) {
        console.error("Auto unlock error:", error);
    }

}, {
    timezone: "Asia/Kolkata"
});
