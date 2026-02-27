const cron = require("node-cron");
const Table = require("../models/table.model");
const Reservation = require("../models/reservation.model");

cron.schedule("0 2 * * *", async () => {
    console.log("Running auto-unlock job...");

    try {

        const yesterdayEnd = new Date();
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
        yesterdayEnd.setHours(23, 59, 59, 999);

        const lockedTables = await Table.find({
            status: "OutOfService",
            lockedAt: { $lte: yesterdayEnd }
        });

        for (let table of lockedTables) {

            const futureBooking = await Reservation.findOne({
                tableId: table._id,
                date: { $gt: new Date() },
                status: { $in: ["Pending", "Confirmed"] }
            });

            if (futureBooking) {
                table.status = "Available";
                table.lockReason = null;
                table.lockedBy = null;
                table.lockedAt = null;

                await table.save();
                console.log(`Auto unlocked table ${table._id}`);
            }
        }

    } catch (error) {
        console.error("Auto unlock error:", error);
    }

}, {
    timezone: "Asia/Kolkata"
});
