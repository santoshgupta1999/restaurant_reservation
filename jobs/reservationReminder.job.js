const cron = require("node-cron");
const moment = require("moment-timezone");

const Reservation = require("../models/reservation.model");

const {
    sendReservationNotification
} = require("../utils/reservationNotification");

cron.schedule("*/5 * * * *", async () => {

    try {

        const reservations = await Reservation.find({
            status: {
                $in: ["Confirmed", "Upcoming", "Pending"]
            },
            reminderSentAt: null
        })
            .populate("restaurantId", "timezone venueName")
            .populate("guestId");

        for (const reservation of reservations) {

            const timezone =
                reservation.restaurantId?.timezone ||
                "Asia/Kolkata";

            /*
                CURRENT VENUE TIME
            */
            const now = moment().tz(timezone);

            /*
                BOOKING DATETIME
            */
            const bookingDateTime = moment.tz(
                `${moment(reservation.date).format("YYYY-MM-DD")} ${reservation.time}`,
                "YYYY-MM-DD HH:mm",
                timezone
            );

            /*
                DIFFERENCE IN HOURS
            */
            const diffMinutes =
                bookingDateTime.diff(now, "minutes");

            /*
                SEND BETWEEN
                23h55m → 24h05m
            */
            if (
                diffMinutes >= 1435 &&
                diffMinutes <= 1445
            ) {

                await sendReservationNotification(
                    reservation,
                    reservation.guestId,
                    "Reminder"
                );

                reservation.reminderSentAt =
                    new Date();

                await reservation.save();

                console.log(
                    `Reminder sent for reservation ${reservation.reservationNo}`
                );
            }
        }

    } catch (error) {

        console.error(
            "Reservation reminder cron error:",
            error
        );
    }
});
