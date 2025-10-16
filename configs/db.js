const mongoose = require('mongoose');
const dotenv = require('dotenv').config({ quiet: true });
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in environment variables');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => console.log(`Server Connected to MongoDB Database: ${new Date().toLocaleString()}`))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

module.exports = mongoose;
