const moment = require("moment-timezone");

/* ================= CONFIG ================= */
const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
const DEFAULT_FORMAT = "DD/MM/YYYY hh:mm A";
const DATE_ONLY_FORMAT = "DD/MM/YYYY";
const TIME_ONLY_FORMAT = "hh:mm A";

/* ================= FORMATTERS ================= */

const formatDateTime = (value, timezone = DEFAULT_TIMEZONE) => {
    if (!value) return null;
    return moment(value).tz(timezone).format(DEFAULT_FORMAT);
};

const formatDate = (value, timezone = DEFAULT_TIMEZONE) => {
    if (!value) return null;
    return moment(value).tz(timezone).format(DATE_ONLY_FORMAT);
};

const formatTime = (value, timezone = DEFAULT_TIMEZONE) => {
    if (!value) return null;
    return moment(value, ["HH:mm", "hh:mm A"])
        .tz(timezone)
        .format(TIME_ONLY_FORMAT);
};

/* ================= RAW + FORMATTED ================= */

const formatWithRaw = (value, type = "datetime", timezone = DEFAULT_TIMEZONE) => {
    if (!value) return { raw: null, formatted: null };

    let formatted;

    if (type === "date") {
        formatted = formatDate(value, timezone);
    } else if (type === "time") {
        formatted = formatTime(value, timezone);
    } else {
        formatted = formatDateTime(value, timezone);
    }

    return {
        raw: value,
        formatted
    };
};

module.exports = {
    formatDateTime,
    formatDate,
    formatTime,
    formatWithRaw
};
