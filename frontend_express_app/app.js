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
            uploadedImageUrl: `${process.env.BACKEND_URL || 'http://localhost:10000/'}uploads/${req.file.filename}`,
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
            // Ensure the source file exists before proceeding
            if (!fs.existsSync(sourceFile)) {
                throw new Error(`Source file not found: ${sourceFile}`);
            }

            // Create the temporary directory for base64 conversion
            fs.mkdirSync(targetDir, { recursive: true });
            
            // Copy the uploaded image to the temporary directory
            fs.copyFileSync(sourceFile, targetFile);

            // Construct the command with explicit PATH setting
            const gcloudPath = '/opt/render/project/src/frontend_express_app/gcloud-sdk/google-cloud-sdk/bin';
            const command = `cd ${targetDir} && export PATH="${gcloudPath}:$PATH" && ./convert_upload.sh "${sourceFile}"`;
            console.log('Executing command:', command);

            // Execute the command with explicit environment
            const execOptions = {
                env: {
                    ...process.env,
                    PATH: `${gcloudPath}:${process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'}`
                }
            };

            exec(command, execOptions, async (err, stdout, stderr) => {
                let extractedList = [];
                try {
                    if (stderr) {
                        console.warn('Bash script STDERR output:\n', stderr);
                    }

                    if (err) {
                        console.error('Script execution encountered an error:', err);
                        return reject(new Error(`Script execution failed: ${err.message || 'Unknown error'}. Stderr: ${stderr || 'N/A'}`));
                    }

                    console.log('Bash script STDOUT raw output:\n', stdout);

                    const arrays = stdout.match(/\[(.*?)\]/g);

                    if (!arrays || arrays.length === 0) {
                        console.error('No square bracket arrays found in stdout.');
                        return reject(new Error('No array-like structure found in script output.'));
                    }

                    const lastArrayString = arrays[arrays.length - 1];
                    console.log('Candidate label array string (last found array):\n', lastArrayString);

                    extractedList = lastArrayString
                        .slice(1, -1)
                        .split(',')
                        .map(item => item.trim())
                        .filter(item => {
                            if (!item) return false;
                            if (item.startsWith('iVBOR')) return false;
                            const parts = item.split(':');
                            if (parts.length !== 2) return false;
                            const score = parseFloat(parts[1]);
                            return !isNaN(score) && isFinite(score);
                        });

                    if (extractedList.length === 0) {
                        console.error('After filtering, no valid labels were extracted. Original last array string:', lastArrayString);
                        return reject(new Error('No valid labels found in output after parsing and filtering.'));
                    }

                    console.log('Successfully extracted and filtered labels:', extractedList);

                    if (mongoose.connection.readyState === 0) {
                        await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://jainishmehta:jainish1234@cluster0.7izqa.mongodb.net/clothing_images?retryWrites=true&w=majority");
                    } else {
                        console.log("Already connected to MongoDB.");
                    }
                    
                    const processedList = processKnnMatch(extractedList);
                    if (!processedList || processedList.length === 0) {
                        throw new Error('No valid clothing types found by KNN match.');
                    }
                    
                    const bestClothingType = processedList[0]?.split(' ')[0]?.trim().toLowerCase();
                    if (!bestClothingType) {
                        throw new Error('Invalid clothing type format from KNN match.');
                    }

                    console.log('Best clothing type determined:', bestClothingType);
                    const clothingModels = { short: Short, dress: Dress, shirt: Shirt, pants: Pant };
                    const Model = clothingModels[bestClothingType];
                    if (!Model) {
                        throw new Error(`Unsupported clothing type: ${bestClothingType}. Available: ${Object.keys(clothingModels).join(', ')}`);
                    }

                    const objectKey = await fetchClothing(Model, extractedList);
                    const imageUrl = await getS3ObjectUrl(objectKey);

                    console.log('Found matching image URL:', imageUrl);
                    resolve(imageUrl);

                } catch (processingError) {
                    console.error('Error during Vision API response processing or database interaction:', {
                        message: processingError.message,
                        rawOutput: stdout,
                        stderrOutput: stderr,
                        extractedListDuringError: extractedList,
                        stack: processingError.stack
                    });
                    reject(new Error(`Processing failed: ${processingError.message}`));
                } finally {
                    try {
                        if (fs.existsSync(targetFile)) {
                            fs.unlinkSync(targetFile);
                            console.log(`Cleaned up temporary file: ${targetFile}`);
                        }
                    } catch (cleanupErr) {
                        console.warn('Cleanup failed:', cleanupErr.message);
                    }
                }
            });
        } catch (setupError) {
            console.error('Initial setup (file copy/directory creation) error:', setupError);
            reject(new Error(`Setup failed: ${setupError.message}`));
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
