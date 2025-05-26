const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { exec } = require('child_process'); 
const mongoose = require('mongoose');
var Dress = require('./models/dress_model.js');
var Short = require('./models/short_model.js');
var Shirt = require('./models/top_models.js');
var Pant = require('./models/pant_model.js');
const AWS = require('aws-sdk');

const cors = require('cors');

const { processKnnMatch } = require('./knn_match');

const port = process.env.PORT || 10000;
const app = express();
const s3 = new AWS.S3();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://visualmatcher.netlify.app',
  credentials: true
}));

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

app.get('/uploads/:filename', (req, res, next) => {
    const filePath = path.join(uploadDir, req.params.filename);
    console.log(`Checking file access:`, {
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

/*
app.use(express.static(path.join(__dirname, 'client', 'build')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});
*/
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        // Log request details
        console.log('Upload request received:', {
            fileExists: !!req.file,
            fileName: req.file?.filename,
            filePath: req.file ? path.join(uploadDir, req.file.filename) : null
        });

        if (!req.file) {
            throw new Error('No file uploaded');
        }

        // Verify file exists and is accessible
        const filePath = path.join(uploadDir, req.file.filename);
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found at ${filePath}`);
        }

        // Log file details
        const stats = fs.statSync(filePath);
        console.log('File details:', {
            size: stats.size,
            permissions: stats.mode,
            path: filePath
        });

        // Process image
        const result = await triggerBashScript(req.file.filename);
        
        // Log success
        console.log('Processing completed:', result);
        
        res.json({
            success: true,
            uploadedImageUrl: `${process.env.BACKEND_URL || 'https://gcp-match.onrender.com'}/uploads/${req.file.filename}`,
            closestImageUrl: result
        });

    } catch (error) {
        console.error('Upload processing error:', {
            message: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            error: 'Error processing the image',
            details: error.message
        });
    }
});
/*
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}
*/
function findHighestMatch(extractedList, shortList) {
  let highestPercentage = 0;
  let highestMatchIndex = -1;
  let i =0;
  shortList.forEach(item => {
    let seen = new Set();
    let similarPercentage = 0;
    let labels = item.labels;

    labels.forEach(labelObj => {
      let label = labelObj[0]; 
      let matchPercentage = labelObj[1];

      extractedList.forEach((extractedItem, index) => {
        let [extractedLabel, extractedPercentage] = extractedItem.split(":");
        extractedLabel = extractedLabel.trim();
        extractedPercentage = parseFloat(extractedPercentage.trim());

        // Check if the label matches and we haven't seen it yet
        if (extractedLabel.includes(label) && !seen.has(extractedLabel)) {
          // Add the extracted percentage to the total
          similarPercentage += Math.min(extractedPercentage,matchPercentage)

          // Mark this label as seen
          seen.add(extractedLabel);
        }
      })
    })

        if (similarPercentage > highestPercentage) {
          console.log(similarPercentage)
          highestPercentage = similarPercentage;
          highestMatchIndex = i;
        }

        i=i+1;

        });
  console.log(highestMatchIndex)
  return highestMatchIndex;
}

const bucketName = "gcpmatchproject";

// Function to fetch the clothing item based on type
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

// Function to retrieve an S3 object and return its public URL
function getS3ObjectUrl(objectKey) {
    const params = { Bucket: bucketName, Key: objectKey };

    return new Promise((resolve, reject) => {
        s3.getObject(params, (err, data) => {
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
            // Validate source file exists
            if (!fs.existsSync(sourceFile)) {
                throw new Error(`Source file not found: ${sourceFile}`);
            }

            fs.mkdirSync(targetDir, { recursive: true });
            fs.copyFileSync(sourceFile, targetFile);
            
            const command = `cd ${targetDir} && python3 base64_converter.py ../uploads/${fileExecuted} && ./convert_upload.sh`;
            console.log('Executing command:', command);

            exec(command, async (err, stdout, stderr) => {
                let extractedList = [];

                try {
                    if (err) {
                        console.error('Script execution error:', {
                            error: err,
                            stderr: stderr
                        });
                        throw new Error(`Script execution failed: ${stderr}`);
                    }

                    console.log('Raw script output:', stdout);

                    // Find all arrays in output using regex
                    const arrays = stdout.match(/\[(.*?)\]/g);
                    if (!arrays || arrays.length === 0) {
                        throw new Error('No arrays found in output');
                    }

                    // Get the last array (which should contain the labels)
                    const lastArray = arrays[arrays.length - 1];
                    console.log('Found label array:', lastArray);

                    // Parse the labels
                    extractedList = lastArray
                        .slice(1, -1) // Remove [ ]
                        .split(',')
                        .map(item => item.trim())
                        .filter(item => {
                            // Only keep items that look like "Label: 0.123"
                            return item && 
                                   !item.startsWith('iVBOR') && 
                                   item.includes(':') &&
                                   !isNaN(parseFloat(item.split(':')[1]));
                        });

                    if (!extractedList.length) {
                        throw new Error('No valid labels found in output');
                    }

                    console.log('Extracted labels:', extractedList);

                    // Connect to MongoDB
                    await mongoose.connect("mongodb+srv://jainishmehta:jainish1234@cluster0.7izqa.mongodb.net/clothing_images?retryWrites=true&w=majority");

                    // Process the labels
                    const processedList = processKnnMatch(extractedList);
                    if (!processedList?.length) {
                        throw new Error('No valid clothing types found');
                    }

                    const bestClothingType = processedList[0].split(' ')[0]?.trim().toLowerCase();
                    if (!bestClothingType) {
                        throw new Error('Invalid clothing type format');
                    }

                    console.log('Best clothing type:', bestClothingType);

                    // Get matching model
                    const clothingModels = {
                        short: Short,
                        dress: Dress,
                        shirt: Shirt,
                        pants: Pant
                    };

                    const Model = clothingModels[bestClothingType];
                    if (!Model) {
                        throw new Error(`Unsupported clothing type: ${bestClothingType}`);
                    }

                    const objectKey = await fetchClothing(Model, extractedList);
                    const imageUrl = await getS3ObjectUrl(objectKey);

                    console.log('Found matching image:', imageUrl);
                    resolve(imageUrl);

                } catch (error) {
                    console.error('Processing error:', {
                        message: error.message,
                        rawOutput: stdout,
                        extractedList: extractedList,
                        stack: error.stack
                    });
                    reject(error);
                } finally {
                    try {
                        fs.unlinkSync(targetFile);
                    } catch (cleanupErr) {
                        console.warn('Cleanup failed:', cleanupErr);
                    }
                }
            });
        } catch (error) {
            console.error('Setup error:', error);
            reject(error);
        }
    });
}

// Serve uploaded images
app.use(express.static('uploads'));
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});

