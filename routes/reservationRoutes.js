const express = require('express');
const router = express.Router();

const reservController = require('../controllers/reservation.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { reservationValidator, reservationStatusValidator } = require('../validators/reservationValidation');
const { validate } = require('../middlewares/validationResultHandler');


router.post('/add',
    verifyToken,
    reservationValidator,
    validate,
    reservController.createReservation
);

router.get('/', verifyToken, requireRole('user'), reservController.getReservation);
router.get('/:id', verifyToken, requireRole('user'), reservController.getReservationById);

router.post('/update/:id',
    verifyToken,
    requireRole('user'),
    reservationValidator,
    validate,
    reservController.updateReservation
);

router.delete('/:id', verifyToken, validate, reservController.deleteReservation);

router.get('/admin/get', reservController.getAllReservationsByAdmin);

router.post('/status/:id',
    verifyToken,
    requireRole('admin'),
    reservationStatusValidator,
    reservController.updateReservationStatus
);

module.exports = router;
