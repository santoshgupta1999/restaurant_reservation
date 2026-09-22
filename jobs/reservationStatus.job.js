const cron = require("node-cron");
const moment = require("moment-timezone");

const Reservation = require("../models/reservation.model");
const Table = require("../models/table.model");

/**
 * Runs every minute to check reservation statuses with a 5-minute grace period
 */
cron.schedule("* * * * *", async () => {

    try {

        const reservations = await Reservation.find({
            status: {
                $in: ["Pending", "Confirmed", "Upcoming"]
            },
            date: {
                $lte: moment().add(2, "days").endOf("day").toDate()
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

            const timeClean = reservation.time ? String(reservation.time).trim() : "";
            // Use venue timezone so that legacy records (stored at 18:30 UTC for IST)
            // as well as new records (stored at 00:00 UTC) both correctly resolve to the booking date (e.g. 2026-09-22)
            const dateStr = moment.tz(reservation.date, timezone).format("YYYY-MM-DD");

            // BOOKING DATETIME (supports both 12H "hh:mm A" and 24H "HH:mm")
            const bookingDateTime = moment.tz(
                `${dateStr} ${timeClean}`,
                [
                    "YYYY-MM-DD HH:mm",
                    "YYYY-MM-DD H:mm",
                    "YYYY-MM-DD hh:mm A",
                    "YYYY-MM-DD h:mm A",
                    "YYYY-MM-DD hh:mma",
                    "YYYY-MM-DD h:mma"
                ],
                timezone
            );

            if (!bookingDateTime.isValid()) {
                continue;
            }

            // 2 HOURS BEFORE BOOKING TIME
            const upcomingTime = bookingDateTime
                .clone()
                .subtract(2, "hours");

            // 5 MINUTES AFTER BOOKING START TIME -> NO-SHOW THRESHOLD
            const noShowThreshold = bookingDateTime
                .clone()
                .add(5, "minutes");

            /*
                CASE 1:
                Pending/Confirmed -> Upcoming
                (between 2 hours before booking and 5-minute grace period)
            */
            if (
                now.isSameOrAfter(upcomingTime) &&
                now.isBefore(noShowThreshold) &&
                ["Pending", "Confirmed"].includes(reservation.status)
            ) {
                upcomingIds.push(reservation._id);
            }

            /*
                CASE 2:
                5 minutes passed after booking start time -> No-Show
                (e.g., 2:00 PM booking automatically becomes No-Show at 2:05 PM)
            */
            if (
                now.isSameOrAfter(noShowThreshold) &&
                ["Pending", "Confirmed", "Upcoming"].includes(
                    reservation.status
                )
            ) {

                noShowIds.push(reservation._id);

                // MULTI TABLE SUPPORT: Free tables
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
                `${noShowIds.length} reservations moved to No-Show (after 5-minute grace period)`
            );
        }

    } catch (error) {

        console.error(
            "Reservation cron error:",
            error
        );
    }
});
