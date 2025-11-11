const express = require('express');
const router = express.Router();

const reservController = require('../controllers/reservation.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { reservationValidator } = require('../validators/reservationValidation');
const { validate } = require('../middlewares/validationResultHandler');


router.post('/add',
    verifyToken,
    reservationValidator,
    validate,
    reservController.createReservation
);

router.get('/', reservController.getReservations);
router.get('/:id', reservController.getReservationById);

router.put('/update/:id',
    reservationValidator,
    validate,
    reservController.updateReservationById
);

router.delete('/:id', reservController.deleteReservationById);
router.put('/status/:id', reservController.updateReservationStatus);

module.exports = router;
