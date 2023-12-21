const { Router } = require('express');
const router = Router();
const controller = require('./controller');
const authVerify = require('../middlewares/authVerify')
router.post('/', authVerify, controller.uploadFile)

module.exports = router