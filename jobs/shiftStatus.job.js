const cron = require("node-cron");
const moment = require("moment");

const Shift = require("../models/shift.model");

/**
 * Runs every 5 minutes
 */
cron.schedule("*/5 * * * *", async () => {
    try {

        const now = moment();

        const shifts = await Shift.find({
            isActive: true,
            endDate: { $ne: null },
            endTime: { $ne: null }
        }).select("_id endDate endTime");

        if (!shifts.length) return;

        let shiftIdsToDisable = [];

        for (let shift of shifts) {

            const endDateTime = moment(shift.endDate)
                .set({
                    hour: Number(shift.endTime.split(":")[0]),
                    minute: Number(shift.endTime.split(":")[1]),
                    second: 0
                });

            if (now.isAfter(endDateTime)) {
                shiftIdsToDisable.push(shift._id);
            }
        }

        if (shiftIdsToDisable.length) {
            await Shift.updateMany(
                { _id: { $in: shiftIdsToDisable } },
                { $set: { isActive: false } }
            );
        }

        console.log(`${shiftIdsToDisable.length} shift(s) disabled`);

    } catch (error) {
        console.error("Shift cron error:", error);
    }
});
