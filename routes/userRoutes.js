const express = require("express");
const { register, login } = require("../controllers/user.controllers.js");
const { registerValidation, loginValidation, handleValidationErrors } = require("../validators/userValidation.js");
const router = express.Router();

router.post("/signup", registerValidation, handleValidationErrors, register);
router.post("/login", loginValidation, handleValidationErrors, login);

module.exports = router;
