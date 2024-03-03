const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../script')
const jwt_secret = process.env.jwt_secret;

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: {
                email: email,
            },
            include: {
                currentSession: true,
            },
        });

        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }

        // Check if the user is deleted

        if (user.isDeleted) {
            return res.status(401).json({ status: 'error', message: 'This account is deleted.' });
        }
        // Check if the user is disabled
        if (user.isDisabled) {
            return res.status(401).json({ status: 'error', message: 'This account is disabled.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }

        if (user.currentSession && user.currentSession.logoutTimestamp === null) {
            return res.status(401).json({ status: 'error', message: 'Another device is already logged in. Logout to proceed.' });
        }

        let updatedUser;

        if (user.currentSession) {
            updatedUser = await prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    currentSession: {
                        update: {
                            loginTimestamp: new Date(),
                            logoutTimestamp: null,
                        },
                    },
                },
                include: {
                    currentSession: true,
                },
            });
        } else {
            updatedUser = await prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    currentSession: {
                        create: {
                            loginTimestamp: new Date(),
                            logoutTimestamp: null,
                        },
                    },
                },
                include: {
                    currentSession: true,
                },
            });
        }

        const token = jwt.sign(
            { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role, organization: updatedUser.organization, uploadFolders: updatedUser.uploadFolders },
            jwt_secret
        );

        res.status(200).json({ user: { id: updatedUser.id, isDeleted: updatedUser.isDeleted, isDisabled: updatedUser.isDisabled, name: updatedUser.name, organization: updatedUser.organization, role: updatedUser.role, uploadFolders: updatedUser.uploadFolders }, token });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};



const logout = async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
            include: {
                currentSession: true,
            },
        });

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        if (!user.currentSession || user.currentSession.logoutTimestamp !== null) {
            return res.status(400).json({ status: 'error', message: 'User is not currently logged in' });
        }

        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                currentSession: {
                    update: {
                        logoutTimestamp: new Date(),
                    },
                },
            },
            include: {
                currentSession: true,
            },
        });

        res.status(200).json({ status: 'success', message: 'Logout successful', user: updatedUser });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};

const signup = async (req, res) => {
    const { name, email, password, role, organization } = req.body;

    const userExists = await prisma.user.findUnique({
        where: {
            email: email,
        },
    });

    if (userExists) {
        return res.status(409).json({ status: 'error', message: 'User with this email already exists' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const defaultUploadFolders = ['Templates', 'Annual Reports'];

    try {
        const newUser = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashedPassword,
                role: role,
                organization: organization,
                uploadFolders: defaultUploadFolders
            },
        });

        res.status(201).json({
            status: 'success',
            message: 'User created successfully',
            user: {
                id: newUser.id,
                name: newUser.name,
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

module.exports = {
    login,
    logout,
    signup
};
