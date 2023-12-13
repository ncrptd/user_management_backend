const { prisma } = require('../../script')
const bcrypt = require('bcrypt');

const getTenants = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });

        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        let tenants;

        if (user.role === 'ROOT_ADMIN') {
            tenants = await prisma.user.findMany({
                where: {
                    OR: [
                        { role: 'TENANT_ADMIN' },
                        { role: 'TENANT' }
                    ]
                },
            });
        } else {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }

        console.log('tenants', tenants);

        res.status(200).json({ status: 'success', tenants });
    } catch (error) {
        console.error('Error fetching tenants:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};


module.exports = {
    getTenants
}