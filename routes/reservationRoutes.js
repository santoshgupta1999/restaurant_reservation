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

router.post('/', reservController.getReservations);
router.get('/:id', reservController.getReservationById);

router.put('/update/:id',
    reservationValidator,
    validate,
    reservController.updateReservationById
);

router.delete('/:id', reservController.deleteReservationById);
router.post('/status/:id', verifyToken, reservController.updateReservationStatus);

router.post('/cancelled/:id', reservController.cancelReservation);

router.post('/widget-booking/:restaurantId', reservController.createWidgetReservation);
router.get('/confirmation/:reservationId', reservController.getReservationConfirmation);
router.post('/create-hold/:restaurantId', reservController.createReservationHold);


module.exports = router;
