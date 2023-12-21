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
        console.log(req.user);
        const file = req.file;
        const bucketName = process.env.AWS_BUCKET_NAME;
        const folderName = req.user.organization || 'temp';
        const key = `${folderName}/${file.originalname}`;

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

        const result = await s3Client.send(completeMultipartUploadCommand);

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        const signedUrl = await getSignedUrl(s3Client, command);



        // Step 4: Save FileUpload data to the database
        const uploadedByUser = await prisma.user.findUnique({ where: { id: req.user.id } });

        // Check if the user already has a fileUpload record
        const existingFileUpload = await prisma.fileUpload.findFirst({
            where: {
                uploadedById: req.user.id,
                // You can add additional conditions if needed
            },
        });

        const fileUpload = existingFileUpload
            ? existingFileUpload
            : await prisma.fileUpload.create({
                data: {
                    fileName: file.originalname,
                    fileSize: file.buffer.length,
                    fileType: file.mimetype,
                    uploadTimestamp: new Date(),
                    uploadedBy: { connect: { id: uploadedByUser.id } },
                    uploadStatus: 'Success',
                    s3Bucket: bucketName,
                    organization: req.user.organization || null,
                    filePath: signedUrl
                },
            });

        // Step 5: Update the User record with the new FileUpload
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                uploads: { connect: { id: fileUpload.id } },
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

module.exports = { uploadFile };
