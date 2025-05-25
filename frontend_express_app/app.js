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
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const uploadedImagePath = path.join(__dirname, 'uploads', req.file.filename);
  try {
    const imageBuffer = await sharp(uploadedImagePath).resize(224, 224).toBuffer();
    const base64Image = imageBuffer.toString('base64');
    const base64ImageName = `base64_uploads/base64_${req.file.filename}`;
    fs.writeFileSync(base64ImageName, base64Image);
    
    const objectkey = await triggerBashScript(`base64_${req.file.filename}`);
    
    const backendUrl = process.env.BACKEND_URL || 'https://gcp-match.onrender.com';
    const responseData = {
      uploadedImageUrl: `${backendUrl}/uploads/${req.file.filename}`,
      closestImageUrl: objectkey
    };
    console.log('Response Data:', responseData);

    res.json(responseData);
  }
  catch (error) {
    console.error('Error processing the image:', error);
    res.status(500).send('Error processing the image.');
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

// Main function to trigger the bash script and process results
function triggerBashScript(fileExecuted) {
    return new Promise((resolve, reject) => {
        const command = `cd base64_uploads && python3 base64_converter.py ${fileExecuted} && ./convert_upload.sh`;

        console.log(`Executing command: ${command}`);
        exec(command, async (err, stdout, stderr) => {
            if (err) {
                console.error(`Error executing bash script: ${stderr}`);
                return reject(err);
            }

            const matches = stdout.match(/\[(.*?)\]/);
            console.log(`MATCHES ${matches}`);
            if (!matches) return reject("No matches found in script output.");

            const extractedList = matches[1].split(",").map(item => item.trim());
            console.log("Extracted List:", extractedList);

            mongoose.connect("mongodb+srv://jainishmehta:jainish1234@cluster0.7izqa.mongodb.net/clothing_images?retryWrites=true&w=majority");

            try {
                const processedList = processKnnMatch(extractedList);
                const bestClothingType = processedList[0].split(' ')[0].trim();
                console.log("Best Clothing Type:", bestClothingType);

                const clothingModels = {
                    short: Short,
                    dress: Dress,
                    shirt: Shirt,
                    pants: Pant
                };

                const Model = clothingModels[bestClothingType];
                if (!Model) {
                    console.warn(`No model found for clothing type: ${bestClothingType}`);
                    return reject(`Unsupported clothing type: ${bestClothingType}`);
                }

                const objectKey = await fetchClothing(Model, extractedList);
                const imageUrl = await getS3ObjectUrl(objectKey);

                console.log(`Image URL: ${imageUrl}`);
                resolve(imageUrl);

            } catch (error) {
                console.error("Error processing clothing:", error);
                reject(error);
            }
        });
    });
}


// Serve uploaded images
app.use(express.static('uploads'));
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});

