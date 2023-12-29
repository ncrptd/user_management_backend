const { Router } = require('express');
const router = Router();
const controller = require('./controller');
const authVerify = require('../middlewares/authVerify');


router.post('/save-template', authVerify, controller.saveTemplate);
router.get('/templates', authVerify, controller.getTemplates)
module.exports = router
