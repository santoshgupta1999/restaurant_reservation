const sendMail = require("../utils/mailer");

const sendReservationNotification = async (reservation, guest, type) => {

    if (!guest.email) return;

    const fullName = `${guest.firstName || ""} ${guest.lastName || ""}`.trim();

    let subject = "";
    let text = "";
    let html = "";

    if (type === "Confirmed") {

        subject = "Your Reservation is Confirmed";

        text = `Hi, ${fullName},
            Your reservation is confirmed.
            Date: ${reservation.date.toDateString()}
            Time: ${reservation.time}
            Party Size: ${reservation.partySize}`;

        html = `
            <h2>Hi, ${fullName},</h2>
            <p>Your reservation has been <b>confirmed</b>.</p>
            <p><b>Date:</b> ${reservation.date.toDateString()}</p>
            <p><b>Time:</b> ${reservation.time}</p>
            <p><b>Party Size:</b> ${reservation.partySize}</p>
            <br/>
            <p>We look forward to serving you!</p>
        `;

    } else if (type === "Cancelled") {

        subject = "Your Reservation has been Cancelled ❌";

        text = `Hi, ${fullName},
            Your reservation has been cancelled.
            Date: ${reservation.date.toDateString()}
            Time: ${reservation.time}`;

        html = `
            <h2>Hi, ${fullName},</h2>
            <p>Your reservation has been <b>cancelled</b>.</p>
            <p><b>Date:</b> ${reservation.date.toDateString()}</p>
            <p><b>Time:</b> ${reservation.time}</p>
            <br/>
            <p>If this was a mistake, please contact us.</p>
        `;
    }

    await sendMail(guest.email, subject, text, html);
};

module.exports = { sendReservationNotification };
