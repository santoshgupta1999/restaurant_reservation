const express = require('express');
const mongoose = require('./configs/db'); // Import db connection
const dotenv = require('dotenv');
dotenv.config({ quiet: true });
const cors = require('cors');
const path = require('path');
const userRouter = require('./routes/userRoutes');
const adminRouter = require('./routes/restaurantRoutes');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Example route
app.get('/', (req, res) => {
    res.send('Restaurants Reservation APP is Running!');
});

app.use('/api/users/', userRouter);
app.use('/api/admin/', adminRouter);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port: ${PORT}`));
