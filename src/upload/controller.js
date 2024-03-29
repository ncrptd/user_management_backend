const { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
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
        const file = req.files.file[0]; // Access the primary file uploaded
        const relatedFile = req.files.relatedFile ? req.files.relatedFile[0] : null; // Access the related file uploaded, if any

        const confi = req.body.confidential;
        const comment = req.body.comment;
        let templateData = req.body.templateData && JSON.parse(req.body.templateData);

        const confidential = confi === 'true' ? true : confi === 'false' ? false : false;
        const bucketName = process.env.AWS_BUCKET_NAME;
        const org = req.user.organization || 'temp';
        const folderName = req.params.folderName;
        const userId = req.user.id;
        const key = `${org}/${userId}/${folderName}/${file.originalname}`;

        // Check if file with the same name exists in the database
        const existingFile = await prisma.fileUpload.findFirst({
            where: {
                fileName: file.originalname,
                folderName: folderName,
            },
        });

        if (existingFile) {
            return res.status(400).json({ error: 'File with the same name already exists' });
        }

        // Continue with primary file upload if file doesn't exist
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

        // Create a new FileUpload record for primary file upload
        const fileUpload = await prisma.fileUpload.create({
            data: {
                fileName: file.originalname,
                fileSize: file.buffer.length,
                fileType: file.mimetype,
                uploadedBy: { connect: { id: uploadedByUser.id } },
                uploadStatus: 'Success',
                s3Bucket: bucketName,
                organization: req.user.organization || null,
                filePath: signedUrl,
                folderName,
                confidential,
                templateData,
                comment
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

        if (relatedFile) {
            const relatedFileKey = `${org}/${userId}/${folderName}/RelatedFiles/${relatedFile.originalname}`;

            try {
                // Upload related file to S3
                const uploadParams = {
                    Bucket: bucketName,
                    Key: relatedFileKey,
                    Body: relatedFile.buffer,
                };

                const uploadCommand = new PutObjectCommand(uploadParams);
                const result = await s3Client.send(uploadCommand);

                const relatedFileUploadResult = { result, success: true };

                // If the related file upload fails, return an error response
                if (!relatedFileUploadResult.success) {
                    return res.status(500).json({ error: 'Failed to upload related file to S3' });
                }

                // Get signed URL for related file
                const relatedFileCommand = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: relatedFileKey,
                });
                const relatedFileSignedUrl = await getSignedUrl(s3Client, relatedFileCommand);

                // Save RelatedFile data to the database
                const relatedFileUpload = await prisma.relatedFile.create({
                    data: {
                        fileName: relatedFile.originalname,
                        fileSize: relatedFile.size,
                        fileType: relatedFile.mimetype,
                        s3Bucket: bucketName,
                        organization: req.user.organization || null,
                        filePath: relatedFileSignedUrl,
                        primaryFileId: fileUpload.id, // Set the primaryFileId to the id of the primary file upload
                    },
                });


                // Handle related file upload success
            } catch (error) {
                // If an error occurs during the related file upload process, return an error response
                console.error('Error uploading related file to S3:', error);
                return res.status(500).json({ error: 'Failed to upload related file to S3' });
            }
        }

        res.json({ message: 'File uploaded successfully', fileUpload });

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
                uploadedBy: {
                    // Exclude files uploaded by users with the role of "tenant-admin"
                    NOT: {
                        role: 'TENANT_ADMIN',
                    },
                },
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
        const bucketName = process.env.AWS_BUCKET_NAME;

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


const generateSignedUrlsForMultipleFiles = async (files) => {
    try {
        const signedUrls = [];
        const bucketName = process.env.AWS_BUCKET_NAME; // Replace with your actual S3 bucket name
        const expirationTime = 5000; // Expiration time for signed URLs

        for (const file of files) {
            const { folderName, fileName, adminTemplate, uploadedById: userId, organization } = file;
            let key;

            if (adminTemplate) {
                key = `${organization}/${folderName}/${fileName}`;
            } else {
                key = `${organization}/${userId}/${folderName}/${fileName}`;
            }

            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            });

            const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expirationTime });
            signedUrls.push(signedUrl);
        }

        return signedUrls;
    } catch (error) {
        console.error('Error generating signed URLs for multiple files:', error);
        throw error;
    }
};

const getDownloadLinksForMultipleFiles = async (req, res) => {
    try {
        const files = req.body.files; // Array of file information

        const signedUrls = await generateSignedUrlsForMultipleFiles(files);

        res.status(200).json({ signedUrls });
    } catch (error) {
        console.error('Error getting download links for multiple files:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


module.exports = { uploadFile, getAllUploadedFiles, getFolders, getDownloadLink, getDownloadLinksForMultipleFiles };
