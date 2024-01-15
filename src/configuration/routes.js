const { Router } = require('express');
const router = Router();
const controller = require('./controller');
const authVerify = require('../middlewares/authVerify');


router.post('/save-template', authVerify, controller.saveTemplate);
router.get('/templates', authVerify, controller.getTemplates);
router.post('/global-template', authVerify, controller.uploadGlobalTemplate);
router.post('/config-file', authVerify, controller.uploadConfigFile);
router.get('/config-file', authVerify, controller.getConfigFile);


module.exports = router
