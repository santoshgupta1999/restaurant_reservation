const express = require('express');
const mongoose = require('./configs/db');
const dotenv = require('dotenv');
dotenv.config({ quiet: true });
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const userRouter = require('./routes/userRoutes');
const adminRouter = require('./routes/adminRoutes');
const restRouter = require('./routes/restaurantRoutes');
const reservRouter = require('./routes/reservationRoutes');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.send('Restaurants Reservation APP is Running!');
});

app.use('/api/auth/', userRouter);
app.use('/api/admin/', adminRouter);
app.use('/api/restaurant', restRouter);
app.use('/api/reservation', reservRouter);

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(400).json({ success: false, message: err.message});
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { message: err.message, stack: err.stack });
  process.exit(1);
});

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port: ${PORT}`));
