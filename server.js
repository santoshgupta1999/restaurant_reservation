const express = require('express');
const mongoose = require('./configs/db');
const dotenv = require('dotenv');
dotenv.config({ quiet: true });
const cors = require('cors');
const path = require('path');
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

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port: ${PORT}`));
