const { Router } = require('express');
const router = Router();
const controller = require('./controller');
const authVerify = require('../middlewares/authVerify');

router.post('/', authVerify, controller.addUser);
router.get('/all', authVerify, controller.getUsers);
router.get('/', authVerify, controller.getOnlyUsers);
router.post('/manage-roles/:userId', authVerify, controller.manageRoles);
router.delete('/:userId', authVerify, controller.deleteUserById);
router.post('/:userId', authVerify, controller.passwordReset);
module.exports = router