const cron = require("node-cron");
const Shift = require("../models/shift.model");

cron.schedule("*/5 * * * *", async () => {
    try {

        const now = new Date();

        const shifts = await Shift.find({
            isActive: true,
            endDate: { $exists: true }
        });

        for (let shift of shifts) {

            if (!shift.endTime) continue;

            const [h, m] = shift.endTime.split(":").map(Number);

            const endDateTime = new Date(shift.endDate);
            endDateTime.setHours(h, m, 0, 0);

            if (now > endDateTime) {
                shift.isActive = false;
                await shift.save();
            }
        }

        console.log("Shift status cron executed");

    } catch (error) {
        console.error("Shift cron error:", error);
    }
});
