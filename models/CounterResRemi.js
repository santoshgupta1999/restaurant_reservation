const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
    id: {              // 👈 YE FIELD missing thi
        type: String,
        required: true,
        unique: true
    },
    seq: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model("CounterResRemi", counterSchema);
