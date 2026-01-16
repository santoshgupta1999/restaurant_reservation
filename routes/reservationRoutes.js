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
router.post('/status/:id', reservController.updateReservationStatus);

router.post("/getDashboardOverview", verifyToken, reservController.getDashboardOverview)
router.post("/getReservationList", reservController.getReservationList)
router.post("/getMonthlyGraph", verifyToken, reservController.getMonthlyGraph)

module.exports = router;
