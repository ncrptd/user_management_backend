const { prisma } = require('../../script')
const bcrypt = require('bcrypt');

const addUser = async (req, res) => {
    try {
        const { firstName, lastName, email, password, role, organization } = req.body;
        const requestingUser = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });

        if (requestingUser.role === 'ROOT_ADMIN') {
        } else if (requestingUser.role === 'TENANT_ADMIN') {
            if (role !== 'USER' && role !== 'TENANT_ADMIN') {
                return res.status(403).json({
                    status: 'error',
                    message: 'TENANT_ADMIN can only create USER and TENANT_ADMIN roles',
                });
            }

            if (requestingUser.organization !== organization) {
                return res.status(403).json({
                    status: 'error',
                    message: 'TENANT_ADMIN can only create users within its organization',
                });
            }
        } else {
            return res.status(403).json({
                status: 'error',
                message: 'Regular USER cannot create any user',
            });
        }

        const existingUser = await prisma.user.findUnique({
            where: {
                email: email,
            },
        });

        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'User with this email already exists',
            });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const name = firstName + ' ' + lastName;
        const newUser = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashedPassword,
                role: role,
                organization: organization,
            },
        });

        res.status(201).json({
            status: 'success',
            message: 'User created successfully',
            user: {
                id: newUser.id,
                name: name,
                email: newUser.email,
                role: newUser.role,
                organization: newUser.organization,
            },
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};


const getUsers = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        let users;

        if (user.role === 'ROOT_ADMIN') {
            users = await prisma.user.findMany({
                where: {
                    role: {
                        not: 'ROOT_ADMIN'
                    }
                }
            });

        } else if (user.role === 'TENANT_ADMIN') {
            users = await prisma.user.findMany({
                where: {
                    organization: user.organization,
                },
            });
        } else {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }
        console.log('org', user.organization)
        console.log('us', users)
        res.status(200).json({ status: 'success', users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};


const deleteUserById = async (req, res) => {
    const userId = req.params.userId;
    try {
        const deletedUser = await prisma.user.delete({
            where: {
                id: userId,
            },
        });

        res.status(200).json({ message: 'User deleted successfully', deletedUser });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error Deleting User' });
    } finally {
        await prisma.$disconnect();
    }
};

const passwordReset = async (req, res) => {
    const { newPassword } = req.body;
    console.log('n', req.body)
    const userId = req.params.userId;
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        console.log('p', hashedPassword)
        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                password: hashedPassword,
            },
        });
        console.log('u', updatedUser)

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};

const manageRoles = async (req, res) => {
    const userId = req.params.userId;
    const { newRole } = req.body;
    const { role } = req.user;

    try {
        if (role === 'ROOT_ADMIN' || (role === 'TENANT_ADMIN' && ['USER', 'TENANT_ADMIN'].includes(newRole))) {
            const user = await prisma.user.findUnique({
                where: {
                    id: userId,
                },
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const updatedUser = await prisma.user.update({
                where: {
                    id: userId,
                },
                data: {
                    role: newRole,
                },
            });

            res.status(200).json({ message: 'User role updated successfully', user: updatedUser });
        } else {
            return res.status(403).json({ error: 'Unauthorized. Insufficient permissions to manage roles.' });
        }
    } catch (error) {
        console.error('Error managing roles:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};

const getOnlyUsers = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });

        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        let users;

        if (user.role === 'ROOT_ADMIN') {
            users = await prisma.user.findMany({
                where: {
                    role: 'USER',
                },
            });
        } else if (user.role === 'TENANT_ADMIN') {
            users = await prisma.user.findMany({
                where: {
                    role: 'USER',
                    organization: user.organization,
                },
            });
        } else {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }

        console.log('users', users);

        res.status(200).json({ status: 'success', users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = {
    getUsers,
};

module.exports = {
    addUser,
    getUsers,
    deleteUserById,
    passwordReset,
    manageRoles,
    getOnlyUsers
};
