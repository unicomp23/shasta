import * as AWS from 'aws-sdk';
const s3 = new AWS.S3();

async function getInstanceIds(bucketName: string) {
    const params = {
        Bucket: bucketName,
        Prefix: 'instanceIds/'
    };

    try {
        const data = await s3.listObjectsV2(params).promise();
        return data.Contents ? data.Contents.map((item: AWS.S3.Object) => item.Key ? item.Key.replace('instanceIds/', '') : '') : [];          
    } catch (err) {
        console.log(err);
        return [];
    }
}

// Usage
const bucketName = process.env.S3_BUCKET_NAME;
if (!bucketName) {
    throw new Error('S3_BUCKET_NAME is missing in environment variables');
}

// Usage
getInstanceIds(bucketName).then(console.log);
