const cron = require("node-cron");
const moment = require("moment-timezone");

const Reservation = require("../models/reservation.model");
const Table = require("../models/table.model");

cron.schedule("*/5 * * * *", async () => {

    try {

        const reservations = await Reservation.find({
            status: {
                $in: ["Pending", "Confirmed", "Upcoming"]
            }
        })
            .populate("restaurantId", "timezone")
            .select("_id tableIds date time status restaurantId");

        const upcomingIds = [];
        const noShowIds = [];
        const tableIds = [];

        for (const reservation of reservations) {

            // fallback timezone
            const timezone =
                reservation.restaurantId?.timezone ||
                "Asia/Kolkata";

            // CURRENT TIME IN VENUE TIMEZONE
            const now = moment().tz(timezone);

            // BOOKING DATETIME
            const bookingDateTime = moment.tz(
                `${moment(reservation.date).format("YYYY-MM-DD")} ${reservation.time}`,
                "YYYY-MM-DD HH:mm",
                timezone
            );

            // 3 HOURS BEFORE
            const upcomingTime = bookingDateTime
                .clone()
                .subtract(2, "hours");

            /*
                CASE 1:
                Pending/Confirmed -> Upcoming
            */
            if (
                now.isSameOrAfter(upcomingTime) &&
                now.isBefore(bookingDateTime) &&
                ["Pending", "Confirmed"].includes(reservation.status)
            ) {
                upcomingIds.push(reservation._id);
            }

            /*
                CASE 2:
                Booking time passed -> No-Show
            */
            if (
                now.isSameOrAfter(bookingDateTime) &&
                ["Pending", "Confirmed", "Upcoming"].includes(
                    reservation.status
                )
            ) {

                noShowIds.push(reservation._id);

                // MULTI TABLE SUPPORT
                if (
                    reservation.tableIds &&
                    reservation.tableIds.length
                ) {
                    tableIds.push(...reservation.tableIds);
                }
            }
        }

        // UPDATE UPCOMING
        if (upcomingIds.length) {

            await Reservation.updateMany(
                {
                    _id: { $in: upcomingIds }
                },
                {
                    $set: {
                        status: "Upcoming"
                    }
                }
            );

            console.log(
                `${upcomingIds.length} reservations moved to Upcoming`
            );
        }

        // UPDATE NO-SHOW
        if (noShowIds.length) {

            await Reservation.updateMany(
                {
                    _id: { $in: noShowIds }
                },
                {
                    $set: {
                        status: "No-Show"
                    }
                }
            );

            // FREE ALL TABLES
            if (tableIds.length) {

                await Table.updateMany(
                    {
                        _id: { $in: tableIds }
                    },
                    {
                        $set: {
                            status: "Available"
                        }
                    }
                );
            }

            console.log(
                `${noShowIds.length} reservations moved to No-Show`
            );
        }

    } catch (error) {

        console.error(
            "Reservation cron error:",
            error
        );
    }
});
