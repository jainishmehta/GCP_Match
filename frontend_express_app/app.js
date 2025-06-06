require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process'); 
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const cors = require('cors');

const Dress = require('./models/dress_model.js');
const Short = require('./models/short_model.js');
const Shirt = require('./models/top_models.js');
const Pant = require('./models/pant_model.js');
const { processKnnMatch } = require('./knn_match');

const port = process.env.PORT || 10000;
const app = express();
const s3 = new AWS.S3();

const allowedOrigins = [
    'http://localhost:3000',
    'https://visualmatcher.netlify.app'
];
const corsOptions = {
    origin: function (origin, callback) {
        callback(null, allowedOrigins.includes(origin) || !origin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
    console.log('Incoming request:', {
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.method === 'POST' ? 'POST body omitted' : undefined,
        timestamp: new Date().toISOString()
    });
    next();
});


const uploadDir = process.env.NODE_ENV === 'production' 
    ? '/opt/render/project/src/frontend_express_app/uploads'
    : path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use('/uploads', (req, res, next) => {
    console.log('Upload request:', {
        path: req.path,
        uploadDir,
        exists: fs.existsSync(path.join(uploadDir, path.basename(req.path)))
    });
    next();
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const filename = Date.now() + path.extname(file.originalname);
        console.log(`Saving file: ${filename}`);
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });

app.use('/uploads', express.static(uploadDir));

app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    console.log('Checking file access:', {
        filename: req.params.filename,
        fullPath: filePath,
        exists: fs.existsSync(filePath)
    });
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        console.log('Upload attempt:', {
            filePresent: !!req.file,
            contentType: req.headers['content-type'],
            origin: req.headers.origin
        });

        if (!req.file) {
            throw new Error('No file uploaded');
        }

        // Validate file type
        if (!req.file.mimetype.startsWith('image/')) {
            throw new Error('Invalid file type. Only images are allowed.');
        }

        const result = await triggerBashScript(req.file.filename);

        return res.status(200).json({
            success: true,
            uploadedImageUrl: `${process.env.BACKEND_URL || 'http://localhost:10000'}/uploads/${req.file.filename}`,
            closestImageUrl: result,
            message: 'Upload successful'
        });

    } catch (error) {
        console.error('Upload failed:', {
            error: error.message,
            stack: error.stack,
            file: req.file,
            headers: req.headers
        });

        return res.status(500).json({
            success: false,
            error: 'Upload failed',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

function findHighestMatch(extractedList, shortList) {
    let highestPercentage = 0;
    let highestMatchIndex = -1;
    shortList.forEach((item, i) => {
        let seen = new Set();
        let similarPercentage = 0;
        let labels = item.labels;
        labels.forEach(labelObj => {
            let label = labelObj[0]; 
            let matchPercentage = labelObj[1];
            extractedList.forEach(extractedItem => {
                let [extractedLabel, extractedPercentage] = extractedItem.split(":");
                extractedLabel = extractedLabel.trim();
                extractedPercentage = parseFloat(extractedPercentage.trim());
                if (extractedLabel.includes(label) && !seen.has(extractedLabel)) {
                    similarPercentage += Math.min(extractedPercentage, matchPercentage);
                    seen.add(extractedLabel);
                }
            });
        });
        if (similarPercentage > highestPercentage) {
            highestPercentage = similarPercentage;
            highestMatchIndex = i;
        }
    });
    return highestMatchIndex;
}

const bucketName = "gcpmatchproject";

async function fetchClothing(ClothingModel, extractedList) {
    try {
        const items = await ClothingModel.find({});
        const highestIndex = findHighestMatch(extractedList, items);
        const bestMatch = items[highestIndex];
        if (!bestMatch) throw new Error("No matching clothing item found.");
        const objectKey = bestMatch['base_64'].replace(/\//g, '_').slice(-10) + ".jpg";
        return objectKey;
    } catch (error) {
        console.error(`Error fetching clothing: ${error}`);
        throw error;
    }
}

function getS3ObjectUrl(objectKey) {
    const params = { Bucket: bucketName, Key: objectKey };
    return new Promise((resolve, reject) => {
        s3.getObject(params, (err) => {
            if (err) {
                console.error(`Error retrieving S3 object: ${err}`);
                return reject(err);
            }
            const url = `https://${bucketName}.s3.amazonaws.com/${objectKey}`;
            resolve(url);
        });
    });
}

function triggerBashScript(fileExecuted) {
    return new Promise((resolve, reject) => {
        const sourceFile = path.join(uploadDir, fileExecuted);
        const targetDir = path.join(__dirname, 'base64_uploads');
        const targetFile = path.join(targetDir, fileExecuted);
        try {
            if (!fs.existsSync(sourceFile)) throw new Error(`Source file not found: ${sourceFile}`);
            fs.mkdirSync(targetDir, { recursive: true });
            fs.copyFileSync(sourceFile, targetFile);

            const command = `cd ${targetDir} && python3 base64_converter.py ../uploads/${fileExecuted} && ./convert_upload.sh`;
            console.log('Executing command:', command);

            exec(command, async (err, stdout, stderr) => {
                let extractedList = [];
                try {
                    if (err) {
                        console.error('Script execution error:', { error: err, stderr });
                        throw new Error(`Script execution failed: ${stderr}`);
                    }
                    const arrays = stdout.match(/\[(.*?)\]/g);
                    if (!arrays || arrays.length === 0) throw new Error('No arrays found in output');
                    const lastArray = arrays[arrays.length - 1];
                    console.log('Found label array:', lastArray);
                    extractedList = lastArray
                        .slice(1, -1)
                        .split(',')
                        .map(item => item.trim())
                        .filter(item => item && !item.startsWith('iVBOR') && item.includes(':') && !isNaN(parseFloat(item.split(':')[1])));
                    if (!extractedList.length) throw new Error('No valid labels found in output');
                    console.log('Extracted labels:', extractedList);

                    await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://jainishmehta:jainish1234@cluster0.7izqa.mongodb.net/clothing_images?retryWrites=true&w=majority");
                    const processedList = processKnnMatch(extractedList);
                    if (!processedList?.length) throw new Error('No valid clothing types found');
                    const bestClothingType = processedList[0].split(' ')[0]?.trim().toLowerCase();
                    if (!bestClothingType) throw new Error('Invalid clothing type format');

                    console.log('Best clothing type:', bestClothingType);
                    const clothingModels = { short: Short, dress: Dress, shirt: Shirt, pants: Pant };
                    const Model = clothingModels[bestClothingType];
                    if (!Model) throw new Error(`Unsupported clothing type: ${bestClothingType}`);

                    const objectKey = await fetchClothing(Model, extractedList);
                    const imageUrl = await getS3ObjectUrl(objectKey);

                    console.log('Found matching image:', imageUrl);
                    resolve(imageUrl);

                } catch (error) {
                    console.error('Processing error:', {
                        message: error.message,
                        rawOutput: stdout,
                        extractedList,
                        stack: error.stack
                    });
                    reject(error);
                } finally {
                    try { fs.unlinkSync(targetFile); } catch (cleanupErr) { console.warn('Cleanup failed:', cleanupErr); }
                }
            });
        } catch (error) {
            console.error('Setup error:', error);
            reject(error);
        }
    });
}

app.get('/', (req, res) => {
    res.json({
        message: 'Image Matching API',
        status: 'running',
        endpoints: {
            upload: 'POST /upload',
            images: 'GET /uploads/:filename'
        }
    });
});

app.use(express.static('uploads'));

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
