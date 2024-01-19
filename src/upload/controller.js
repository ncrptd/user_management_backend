const { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { prisma } = require('../../script');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const uploadFile = async (req, res) => {
    try {
        const file = req.file;
        const confi = req.body.confidential;
        const confidential = confi === 'true' ? true : confi === 'false' ? false : false;
        const bucketName = process.env.AWS_BUCKET_NAME;
        const org = req.user.organization || 'temp';
        const folderName = req.params.folderName;
        const userId = req.user.id;

        const key = `${org}/${userId}/${folderName}/${file.originalname}`;




        // Step 1: Create a multipart upload
        const createMultipartUploadCommand = new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
        });
        const { UploadId } = await s3Client.send(createMultipartUploadCommand);

        // Step 2: Upload parts
        const partSize = 5 * 1024 * 1024; // 5MB part size
        const parts = [];
        let partNumber = 1;
        let offset = 0;

        while (offset < file.buffer.length) {
            const partBuffer = file.buffer.slice(offset, offset + partSize);
            const uploadPartCommand = new UploadPartCommand({
                Bucket: bucketName,
                Key: key,
                UploadId: UploadId,
                PartNumber: partNumber,
                Body: partBuffer,
            });

            const { ETag } = await s3Client.send(uploadPartCommand);
            parts.push({ PartNumber: partNumber, ETag: ETag });

            offset += partSize;
            partNumber += 1;
        }

        // Step 3: Complete the multipart upload
        const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
            UploadId: UploadId,
            MultipartUpload: { Parts: parts },
        });

        await s3Client.send(completeMultipartUploadCommand);

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        const signedUrl = await getSignedUrl(s3Client, command);

        // Step 4: Save FileUpload data to the database
        const uploadedByUser = await prisma.user.findUnique({ where: { id: req.user.id } });

        // Check if the folder name already exists in the user's uploadFolders
        const userFolders = await prisma.user.findUnique({
            where: { id: userId },
            select: { uploadFolders: true },
        });

        const existingFolders = userFolders ? userFolders.uploadFolders : [];
        const newFolders = [...new Set([...existingFolders, folderName])]; // Use a Set to ensure unique folder names

        // Create a new FileUpload record for each upload
        const fileUpload = await prisma.fileUpload.create({
            data: {
                fileName: file.originalname,
                fileSize: file.buffer.length,
                fileType: file.mimetype,
                uploadTimestamp: new Date(),
                uploadedBy: { connect: { id: uploadedByUser.id } },
                uploadStatus: 'Success',
                s3Bucket: bucketName,
                organization: req.user.organization || null,
                filePath: signedUrl,
                folderName,
                confidential
            },
        });

        // Step 5: Update the User record with the new FileUpload and folder name
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                uploads: { connect: { id: fileUpload.id } },
                uploadFolders: { set: newFolders }, // Use set to update the array
            },
        });

        res.json({ message: 'File uploaded to S3 and database successfully', fileUpload });
    } catch (error) {
        console.error('Error uploading file to S3:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await prisma.$disconnect();
    }
};

const getAllUploadedFiles = async (req, res) => {
    try {
        const userId = req.user.id;
        const org = req.user.organization;

        // Retrieve FileUpload records for the user:
        // - Either confidential files uploaded by the user
        // - Or non-confidential files within the same organization
        const uploadedFiles = await prisma.fileUpload.findMany({
            where: {
                organization: org,
                OR: [
                    {
                        confidential: true,
                        uploadedById: userId,
                    },
                    {
                        confidential: false,
                    },
                ],
            },
            include: {
                uploadedBy: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        res.json({ uploadedFiles });
    } catch (error) {
        console.error('Error getting uploaded files:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getFolders = async (req, res) => {
    try {
        const userId = req.user.id;

        // Retrieve all folders for the user
        const userFolders = await prisma.user.findUnique({
            where: { id: userId },
            select: { uploadFolders: true },
        });

        const folders = userFolders ? userFolders.uploadFolders : [];

        res.json({ folders });
    } catch (error) {
        console.error('Error getting folders:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getDownloadLink = async (req, res) => {
    try {
        const { folderName, fileName, adminTemplate, uploadedById: userId, organization } = req.body;

        let key;
        const bucketName = 'csvexceluploads'; // Replace with your actual S3 bucket name

        if (adminTemplate) {
            key = `${organization}/${folderName}/${fileName}`;
        } else {
            key = `${organization}/${userId}/${folderName}/${fileName}`;
        }

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        const expirationTime = 2000;

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expirationTime });

        res.status(200).json({ signedUrl });

    } catch (error) {
        console.error('download link error', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = { uploadFile, getAllUploadedFiles, getFolders, getDownloadLink };
