// 
const sendMail = require("../utils/mailer");
const renderTemplate = require("../utils/renderTemplate");

const TYPES = {
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled"
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

    // ✅ CONFIRMED FLOW
    if (type === TYPES.CONFIRMED) {

        subject = "Your Reservation is Confirmed";

        html = await renderTemplate("booking-confirmation", {
            fullName,
            date: formattedDate,
            time: reservation.time,
            partySize: reservation.partySize,
            reservationNo: reservation.reservationNo,
            email: guest.email,
            restaurantAddress: reservation.restaurantAddress
        });

        text = `
Hi ${fullName},
Your reservation is confirmed.

Date: ${formattedDate}
Time: ${reservation.time}
Guests: ${reservation.partySize}

Reservation ID: ${reservation._id}
`;

    }

    // ❌ CANCELLED FLOW
    else if (type === TYPES.CANCELLED) {

        subject = "Your Reservation has been Cancelled";

        html = await renderTemplate("booking-cancelled", {
            fullName,
            date: formattedDate,
            time: reservation.time,
            reservationNo: reservation.reservationNo,
            email: guest.email,
            restaurantAddress: reservation.restaurantAddress,
        });

        text = `
Hi ${fullName},
Your reservation has been cancelled.

Date: ${formattedDate}
Time: ${reservation.time}

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
