const { prisma } = require('../../script');
const { S3Client, CopyObjectCommand, DeleteObjectCommand, ListObjectsCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client();

const uploadGlobalTemplate = async (req, res) => {
    try {
        const { fileName, organization, uploadedById, folderName, s3Bucket } = req.body;

        const sourceKey = `${organization}/${uploadedById}/${folderName}/${fileName}`;
        const destinationFolder = `${organization}/global-template`;
        const destinationKey = `${destinationFolder}/${fileName}`;

        // List objects in the destination folder
        const listObjectsParams = {
            Bucket: s3Bucket,
            Prefix: destinationFolder,
        };

        const listObjectsResponse = await s3Client.send(new ListObjectsCommand(listObjectsParams));

        // Delete each file in the destination folder
        for (const object of listObjectsResponse.Contents) {
            const deleteObjectParams = {
                Bucket: s3Bucket,
                Key: object.Key,
            };

            await s3Client.send(new DeleteObjectCommand(deleteObjectParams));
        }

        // Specify the parameters for copying the file to the destination

        const copyObjectParams = {
            Bucket: s3Bucket,
            CopySource: `/${s3Bucket}/${sourceKey}`,
            Key: destinationKey,
        };

        // Copy the object to the destination
        const copyObjectResponse = await s3Client.send(new CopyObjectCommand(copyObjectParams));


        res.status(200).json({ success: true, copyObjectResponse });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


async function getTemplates(req, res) {
    try {
        console.log('user', req.user);
        const { organization } = req.user;
        const templates = await prisma.fileUpload.findMany({
            where: {
                folderName: 'Templates',
            },
        });

        const destinationFolder = `${organization}/global-template`;
        const s3Bucket = 'csvexceluploads';
        console.log('d', destinationFolder)
        const listObjectsParams = {
            Bucket: s3Bucket,
            Prefix: destinationFolder,
        };

        const listObjectsResponse = await s3Client.send(new ListObjectsCommand(listObjectsParams));

        // Check if Contents is defined before using map
        const templatesFromGlobalTemplateFolder = listObjectsResponse.Contents
            ? listObjectsResponse.Contents.map(object => ({
                fileName: object.Key.split('/').pop(),
                fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                organization, organization,
                folderName: 'global-template',
                uploadTimestamp: object.LastModified,
            }))
            : [];

        console.log('te', templatesFromGlobalTemplateFolder);

        return res.status(200).json({ success: true, templates, adminTemplate: templatesFromGlobalTemplateFolder });
    } catch (error) {
        console.error('Error retrieving templates:', error);
        throw error;
    }
}




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

module.exports = { saveTemplate, getTemplates, uploadGlobalTemplate };
