const { Router } = require('express');
const router = Router();
const controller = require('./controller');
const authVerify = require('../middlewares/authVerify');

router.post('/login', controller.login);
router.post('/logout', authVerify, controller.logout)
router.post('/signup', controller.signup);


module.exports = router