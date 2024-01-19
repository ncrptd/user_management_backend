const { prisma } = require('../../script');
const { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');


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

        // Check if Contents is iterable (an array)
        if (Array.isArray(listObjectsResponse.Contents)) {
            // Delete each file in the destination folder
            for (const object of listObjectsResponse.Contents) {
                const deleteObjectParams = {
                    Bucket: s3Bucket,
                    Key: object.Key,
                };

                await s3Client.send(new DeleteObjectCommand(deleteObjectParams));
            }
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
        const { organization } = req.user;
        const templates = await prisma.fileUpload.findMany({
            where: {
                folderName: 'Templates',
            },
        });

        const destinationFolder = `${organization}/global-template`;
        const s3Bucket = 'csvexceluploads';
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





const uploadConfigFile = async (req, res) => {
    try {
        const configFile = req.file;
        const { organization, id } = req.user;

        const bucketName = process.env.AWS_BUCKET_NAME;
        const folderName = `${organization}/ConfigFile`;

        // List objects in the destination folder
        const listObjectsParams = {
            Bucket: bucketName,
            Prefix: folderName,
        };

        const listObjectsResponse = await s3Client.send(new ListObjectsCommand(listObjectsParams));

        // Check if Contents is iterable (an array)
        if (Array.isArray(listObjectsResponse.Contents)) {
            // Delete each file in the destination folder
            for (const object of listObjectsResponse.Contents) {
                const deleteObjectParams = {
                    Bucket: bucketName,
                    Key: object.Key,
                };

                await s3Client.send(new DeleteObjectCommand(deleteObjectParams));
            }
        }

        // Specify the parameters for uploading the new file to the destination
        const uploadParams = {
            Bucket: bucketName,
            Key: `${folderName}/${configFile.originalname}`,
            Body: configFile.buffer,
            ContentType: configFile.mimetype,
        };

        // Upload the new file to the destination
        await s3Client.send(new PutObjectCommand(uploadParams));

        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


const getConfigFile = async (req, res) => {
    try {
        const { organization } = req.user;
        const bucketName = process.env.AWS_BUCKET_NAME;
        const folderName = `${organization}/ConfigFile`;

        // List objects in the folder
        const listObjectsParams = {
            Bucket: bucketName,
            Prefix: folderName,
        };

        const listObjectsResponse = await s3Client.send(new ListObjectsCommand(listObjectsParams));

        // Check if Contents is iterable (an array)
        if (Array.isArray(listObjectsResponse.Contents) && listObjectsResponse.Contents.length > 0) {
            // Retrieve the first file in the folder
            const configFileKey = listObjectsResponse.Contents[0].Key;

            // Retrieve the content of the file
            const getObjectParams = {
                Bucket: bucketName,
                Key: configFileKey,
            };

            const { Body } = await s3Client.send(new GetObjectCommand(getObjectParams));

            // Convert the stream to a buffer
            const buffer = await streamToBuffer(Body);

            // Parse the JSON content from the buffer
            const jsonData = JSON.parse(buffer.toString());

            // Respond with the parsed JSON data
            res.status(200).json({ success: true, configFile: jsonData });
        } else {
            res.status(404).json({ error: 'Config file not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Helper function to convert a stream to a buffer
const streamToBuffer = async (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (error) => reject(error));
    });
};
module.exports = { saveTemplate, getTemplates, uploadGlobalTemplate, uploadConfigFile, getConfigFile };
