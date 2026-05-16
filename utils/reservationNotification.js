// 
const sendMail = require("../utils/mailer");
const renderTemplate = require("../utils/renderTemplate");
const Restaurant = require("../models/Restaurant.model");
const Table = require("../models/table.model");

const TYPES = {
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
    UPDATED: "Updated",
    REMINDER: "Reminder"
};

function convertTo12Hour(time) {
    if (!time) return time;

    const [hours, minutes] = time.split(":");
    let h = parseInt(hours, 10);

    const ampm = h >= 12 ? "PM" : "AM";

    h = h % 12;
    if (h === 0) h = 12;

    return `${h.toString().padStart(2, "0")}:${minutes} ${ampm}`;
}

const sendReservationNotification = async (reservation, guest, type) => {

    if (!guest.email) return;

    const fullName =
        `${guest.firstName || ""} ${guest.lastName || ""}`.trim() || "Guest";

    const formattedDate = new Date(reservation.date).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    let subject = "";
    let html = "";
    let text = "";

    const restaurant = await Restaurant.findById(reservation.restaurantId).lean();
    const restaurantPhone = `${restaurant?.countryCode || ""}${restaurant?.phone || ""}`;
    const city = restaurant?.city || "";

    let tableNumbers = "-";

    let floorNames = "-";

    if (reservation.tableIds?.length) {

        const tables = await Table.find({
            _id: { $in: reservation.tableIds }
        })
            .populate("roomId", "name")
            .select("tableNumber roomId")
            .lean();

        if (tables.length) {

            tableNumbers = tables
                .map(table => table.tableNumber)
                .join(", ");

            floorNames = [
                ...new Set(
                    tables
                        .map(table => table.roomId?.name)
                        .filter(Boolean)
                )
            ].join(", ");
        }
    }
    // CONFIRMED FLOW
    if (type === TYPES.CONFIRMED) {

        subject = "Your Reservation is Confirmed";

        html = await renderTemplate("booking-confirmation", {
            fullName,
            date: formattedDate,
            time: convertTo12Hour(reservation.time),
            partySize: reservation.partySize,
            reservationNo: reservation.reservationNo,
            email: guest.email,
            reservationId: reservation._id,
            restaurantName: restaurant.venueName,
            image: restaurant.heroImage,
            restaurantId: reservation.restaurantId,
            restaurantPhone,
            city,
            restaurantAddress: reservation.restaurantAddress,
            isUpdate: false
        });

        text = `
        Hi ${fullName},
        Your reservation is confirmed.

        Date: ${formattedDate}
        Time: ${convertTo12Hour(reservation.time)}
        Guests: ${reservation.partySize}
        Restaurant Phone: ${restaurantPhone}
        City: ${city}
        Reservation ID: ${reservation._id}
        `;

    }

    // UPDATED FLOW
    else if (type === TYPES.UPDATED) {

        subject = "Your Reservation has been Updated";

        html = await renderTemplate("booking-confirmation", {
            fullName,
            date: formattedDate,
            time: convertTo12Hour(reservation.time),
            partySize: reservation.partySize,
            reservationNo: reservation.reservationNo,
            email: guest.email,
            reservationId: reservation._id,
            restaurantName: restaurant.venueName,
            image: restaurant.heroImage,
            restaurantId: reservation.restaurantId,
            restaurantPhone,
            city,
            restaurantAddress: reservation.restaurantAddress,

            // NEW FLAG (template me use hoga)
            isUpdate: true
        });

        text = `
        Hi ${fullName},
        Your reservation has been updated.

        Date: ${formattedDate}
        Time: ${convertTo12Hour(reservation.time)}
        Guests: ${reservation.partySize}
        Restaurant Phone: ${restaurantPhone}
        City: ${city}
        Reservation ID: ${reservation._id}
        `;
    }

    // CANCELLED FLOW
    else if (type === TYPES.CANCELLED) {

        subject = "Your Reservation has been Cancelled";

        html = await renderTemplate("booking-cancelled", {
            fullName,
            date: formattedDate,
            time: convertTo12Hour(reservation.time),
            partySize: reservation.partySize,
            reservationNo: reservation.reservationNo,
            email: guest.email,
            reservationId: reservation._id,
            restaurantName: restaurant.venueName,
            image: restaurant.heroImage,
            restaurantId: reservation.restaurantId,
            restaurantPhone,
            city,
            restaurantAddress: reservation.restaurantAddress,
        });

        text = `
        Hi ${fullName},
        Your reservation has been cancelled.

        Date: ${formattedDate}
        Time: ${convertTo12Hour(reservation.time)}
        Guests: ${reservation.partySize}
        Restaurant Phone: ${restaurantPhone}
        City: ${city}
        Reservation ID: ${reservation._id}
        `;
    } else if (type === TYPES.REMINDER) {

        subject =
            `Reminder for your reservation at ${restaurant.venueName}`;

        html = await renderTemplate("booking-reminder", {
            fullName,
            date: formattedDate,
            time: convertTo12Hour(reservation.time),
            partySize: reservation.partySize,
            reservationNo: reservation.reservationNo,
            email: guest.email,
            reservationId: reservation._id,
            restaurantName: restaurant.venueName,
            image: restaurant.heroImage,
            restaurantId: reservation.restaurantId,
            restaurantPhone,
            city,
            restaurantAddress: restaurant.restaurantAddress,
            tableNumbers,
            floorNames
        });

        text = `
    Hi ${fullName},

    This is a reminder for your upcoming reservation.

    Date: ${formattedDate}
    Time: ${convertTo12Hour(reservation.time)}
    Guests: ${reservation.partySize}

    Table Number: ${tableNumbers}
    Floor: ${floorNames}

    Restaurant Name: ${restaurant.venueName}
    Restaurant Phone: ${restaurantPhone}
    City: ${city}

    Reservation NO: ${reservation.reservationNo}
    `;
    }

    try {
        await sendMail(guest.email, subject, text, html);
    } catch (error) {
        console.error("Email failed:", error.message);
    }
};

module.exports = {
    sendReservationNotification
};
