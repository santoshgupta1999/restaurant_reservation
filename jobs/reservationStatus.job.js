const cron = require("node-cron");
const Reservation = require("../models/reservation.model");
const Table = require("../models/table.model");

cron.schedule("*/5 * * * *", async () => {
    try {
        const now = new Date();

        const expiredReservations = await Reservation.find({
            status: { $in: ["Pending", "Confirmed"] }
        });

        const toUpdate = [];

        for (let reservation of expiredReservations) {

            const dateString = new Date(reservation.date)
                .toISOString()
                .split("T")[0];

            const bookingDateTime = new Date(
                `${dateString}T${reservation.time}:00+05:30`
            );

            if (bookingDateTime < now) {
                toUpdate.push(reservation);
            }
        }

        if (toUpdate.length === 0) return;

        const reservationIds = toUpdate.map(r => r._id);
        const tableIds = toUpdate
            .filter(r => r.tableId)
            .map(r => r.tableId);

        await Reservation.updateMany(
            { _id: { $in: reservationIds } },
            { $set: { status: "No-show" } }
        );

        await Table.updateMany(
            { _id: { $in: tableIds } },
            { $set: { status: "Available" } }
        );

        console.log("Auto No-show update done");

    } catch (error) {
        console.error("Auto reservation error:", error);
    }
});
