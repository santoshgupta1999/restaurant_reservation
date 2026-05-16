const cron = require("node-cron");

const Table = require("../models/table.model");

/*
|--------------------------------------------------------------------------
| AUTO UNLOCK DAY-LOCK TABLES
|--------------------------------------------------------------------------
| Runs every 5 minutes
| Unlocks only day-locked tables
| Works globally for all countries/timezones
|--------------------------------------------------------------------------
|
| IMPORTANT:
| lockUntilShiftEnd must be stored in UTC Date format
| while creating the lock.
|
*/

cron.schedule("*/5 * * * *", async () => {

    try {

        const now = new Date();

        /* ================= FIND EXPIRED DAY LOCKS ================= */

        const expiredTables = await Table.find({
            status: "OutOfService",

            lockType: "day",

            lockUntilShiftEnd: {
                $lte: now
            }
        }).select("_id joinedWith");

        if (!expiredTables.length) {

            // console.log("No expired locked tables found");
            return;
        }

        /* ================= HANDLE MERGED TABLES ================= */

        const allTableIds = new Set();

        expiredTables.forEach(table => {

            allTableIds.add(table._id.toString());

            if (
                table.joinedWith &&
                table.joinedWith.length
            ) {

                table.joinedWith.forEach(id => {
                    allTableIds.add(id.toString());
                });
            }
        });

        const tableIds = Array.from(allTableIds);

        /* ================= AUTO UNLOCK ================= */

        await Table.updateMany(
            {
                _id: {
                    $in: tableIds
                }
            },
            {
                $set: {
                    status: "Available"
                },

                $unset: {
                    lockReason: "",
                    lockedBy: "",
                    lockedAt: "",
                    lockType: "",
                    lockUntilShiftEnd: ""
                }
            }
        );

        console.log(
            `Auto unlocked ${tableIds.length} table(s)`
        );

    } catch (error) {

        console.error(
            "AUTO UNLOCK ERROR:",
            error
        );
    }

});
