const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});


const formatTime = (timeStr) => {
    const [hour, minute] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

/**
 * Send a reservation confirmation email
 * @param {string} to - recipient email
 * @param {string} name - recipient name
 * @param {string} subject - email subject
 * @param {string} restaurantName - restaurant name
 * @param {string} date - reservation date (e.g., "2025-08-15")
 * @param {string} startTime - start time (e.g., "19:00")
 * @param {string} endTime - end time (e.g., "21:00")
 */
const sendMail = async (to, name, subject, restaurantName, date, startTime, endTime) => {
    try {
        const formattedDate = formatDate(date);
        const formattedStart = formatTime(startTime);
        const formattedEnd = formatTime(endTime);

        const message = `Hi ${name}, your table reservation at ${restaurantName} for ${formattedDate} from ${formattedStart} to ${formattedEnd} is confirmed.`;

        const info = await transporter.sendMail({
            from: `"Your App Name" <${process.env.SMTP_USER}>`,
            to,
            subject,
            text: message,
        });

        console.log("Email sent:", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending email:", error.message);
        throw error;
    }
};

module.exports = sendMail;
