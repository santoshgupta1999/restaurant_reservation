// 
const sendMail = require("../utils/mailer");
const renderTemplate = require("../utils/renderTemplate");
const Restaurant = require("../models/Restaurant.model");

const TYPES = {
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
    UPDATED: "Updated"
};

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
    // CONFIRMED FLOW
    if (type === TYPES.CONFIRMED) {

        subject = "Your Reservation is Confirmed";

        html = await renderTemplate("booking-confirmation", {
            fullName,
            date: formattedDate,
            time: reservation.time,
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
        Time: ${reservation.time}
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
            time: reservation.time,
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
        Time: ${reservation.time}
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
            time: reservation.time,
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
        Time: ${reservation.time}
        Guests: ${reservation.partySize}
        Restaurant Phone: ${restaurantPhone}
        City: ${city}
        Reservation ID: ${reservation._id}
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
