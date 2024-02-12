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
        const defaultUploadFolders = ['Templates', 'Annual Reports'];
        const newUser = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashedPassword,
                role: role,
                organization: organization,
                uploadFolders: defaultUploadFolders,
                isDisabled: false,
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
                isDisabled: newUser.isDisabled
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
                    },
                    isDeleted: false
                }
            });

        } else if (user.role === 'TENANT_ADMIN') {
            users = await prisma.user.findMany({
                where: {
                    organization: user.organization,
                    isDeleted: false
                },
            });
        } else {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }

        // Filter out the user making the request
        users = users.filter(u => u.id !== req.user.id);

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
        const deletedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                isDeleted: true, // Set isDeleted to true
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
        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                password: hashedPassword,
            },
        });

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
                isDeleted: false

            });
        } else if (user.role === 'TENANT_ADMIN') {
            users = await prisma.user.findMany({
                where: {
                    role: 'USER',
                    organization: user.organization,
                    isDeleted: false

                },
            });
        } else {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }


        res.status(200).json({ status: 'success', users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};

const disableUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if the logged-in user has the authority to disable users

        const loggedInUser = req.user

        if (!loggedInUser || (loggedInUser.role !== 'ROOT_ADMIN' && loggedInUser.role !== 'TENANT_ADMIN')) {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }

        // Find the user to be disabled
        const userToDisable = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!userToDisable) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        // Disable the user
        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                isDisabled: true,
            },
        });

        res.status(200).json({ status: 'success', message: 'User disabled successfully', user: updatedUser });
    } catch (error) {
        console.error('Error disabling user:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};

const enableUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if the logged-in user has the authority to enable user
        const loggedInUser = req.user;

        if (!loggedInUser || (loggedInUser.role !== 'ROOT_ADMIN' && loggedInUser.role !== 'TENANT_ADMIN')) {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }

        // Find the user to be enabled
        const userToEnable = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!userToEnable) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        // Enable the user
        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                isDisabled: false,
            },
        });

        res.status(200).json({ status: 'success', message: 'User enabled successfully', user: updatedUser });
    } catch (error) {
        console.error('Error enabling user:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};


module.exports = {
    addUser,
    getUsers,
    deleteUserById,
    passwordReset,
    manageRoles,
    getOnlyUsers,
    disableUser,
    enableUser
};
