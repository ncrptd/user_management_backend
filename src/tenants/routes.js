const { Router } = require('express');
const router = Router();
const controller = require('./controller');
const authVerify = require('../middlewares/authVerify');

router.get('/', authVerify, controller.getTenants);

module.exports = router