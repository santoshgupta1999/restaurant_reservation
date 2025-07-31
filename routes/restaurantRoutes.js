const express = require('express');
const router = express.Router();

const slotController = require('../controllers/slot.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

router.post('/slot/add', verifyToken, requireRole('admin', 'manager'), slotController.createSlots);


module.exports = router;
