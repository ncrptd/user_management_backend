const { prisma } = require('../../script');

const saveTemplate = async (req, res) => {
    try {
        const { templateName, template } = req.body;
        const { id: createdById } = req.user;

        const existingTemplate = await prisma.excelTemplate.findFirst({
            where: {
                templateName,
                createdBy: { id: createdById },
            },
        });

        if (existingTemplate) {
            const updatedTemplate = await prisma.excelTemplate.update({
                where: { id: existingTemplate.id },
                data: { template },
            });

            res.status(200).json({ success: true, message: 'Template Updated Successfully', template: updatedTemplate });
        } else {
            const createdTemplate = await prisma.excelTemplate.create({
                data: {
                    templateName,
                    template,
                    createdBy: { connect: { id: createdById } },
                },
            });

            res.status(201).json({ success: true, message: 'Template Created Successfully', template: createdTemplate });
        }
    } catch (error) {
        console.error('Error saving/updating template:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

module.exports = { saveTemplate };
