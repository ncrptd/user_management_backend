const { Router } = require('express');
const router = Router();
const controller = require('./controller');
const authVerify = require('../middlewares/authVerify');
router.post('/download-link', authVerify, controller.getDownloadLink);
router.post('/:folderName', authVerify, controller.uploadFile)
router.get('/', authVerify, controller.getAllUploadedFiles);
router.get('/folders', authVerify, controller.getFolders);
module.exports = router