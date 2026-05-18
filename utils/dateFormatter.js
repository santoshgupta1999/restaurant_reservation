const moment = require("moment-timezone");

/* ================= CONFIG ================= */

const FALLBACK_TIMEZONE =
    process.env.APP_TIMEZONE || "UTC";

const DEFAULT_FORMAT = "DD/MM/YYYY hh:mm A";
const DATE_ONLY_FORMAT = "DD/MM/YYYY";
const TIME_ONLY_FORMAT = "hh:mm A";

/* ================= HELPERS ================= */

const resolveTimezone = (timezone) =>
    timezone || FALLBACK_TIMEZONE;

/* ================= FORMATTERS ================= */

const formatDateTime = (
    value,
    timezone
) => {

    if (!value) return null;

    return moment(value)
        .tz(resolveTimezone(timezone))
        .format(DEFAULT_FORMAT);
};

const formatDate = (
    value,
    timezone
) => {

    if (!value) return null;

    return moment(value)
        .tz(resolveTimezone(timezone))
        .format(DATE_ONLY_FORMAT);
};

/* ================= FIXED TIME FORMAT ================= */

const formatTime = (value) => {

    if (!value) return null;

    return moment(
        value,
        ["HH:mm", "hh:mm A"],
        true
    ).format(TIME_ONLY_FORMAT);
};

/* ================= RAW + FORMATTED ================= */

const formatWithRaw = (
    value,
    type = "datetime",
    timezone
) => {

    if (!value) {
        return {
            raw: null,
            formatted: null
        };
    }

    let formatted;

    if (type === "date") {

        formatted = formatDate(
            value,
            timezone
        );

    } else if (type === "time") {

        formatted = formatTime(value);

    } else {

        formatted = formatDateTime(
            value,
            timezone
        );
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
