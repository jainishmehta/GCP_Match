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
const { MongoClient, MinKey } = require('mongodb');

const AWS = require('aws-sdk');

const cors = require('cors');

const { processKnnMatch } = require('./knn_match');

const port = process.env.PORT || 5000;
const app = express();
const s3 = new AWS.S3();
app.use(cors());  // Should be before your routes

// Set up storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Directory to store uploaded images
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename the file
  }
});

const upload = multer({ storage: storage });


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'client', 'build')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});


// Handle image upload
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
    
    const responseData = {
      uploadedImageUrl: `http://localhost:5000/uploads/${req.file.filename}`,
      closestImageUrl: objectkey,  // Replace with actual closest image URL
    };
    console.log('Response Data:', responseData);  // Logs the data
    
    // Send the response
    res.json(responseData);
  }
  catch (error) {
    console.error('Error processing the image:', error);
    res.status(500).send('Error processing the image.');
  }
});


// Serve React static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'build')));

  // Catch-all route to serve index.html (for React Router)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
  });
}

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

         // Check if this match has the highest percentage so far
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

function triggerBashScript(file_executed) {
  return new Promise((resolve, reject) => {
    const command = `cd base64_uploads && python3 base64_converter.py ${file_executed} && ./convert_upload.sh`;

    // Print the command for debugging purposes
    console.log(`Executing command: ${command}`);

    // Use child_process to execute the bash script
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error executing bash script: ${stderr}`);
        return reject(err); // Reject promise on error
      }
      const matches = stdout.match(/\[(.*?)\]/);
      mongoose.connect("mongodb+srv://jainishmehta:jainish1234@cluster0.7izqa.mongodb.net/clothing_images?retryWrites=true&w=majority")
      if (matches) {
          const extractedList = matches[1].split(',').map(item => item.trim());
          console.log("Extracted list")
          console.log(extractedList);
          const processed_list = processKnnMatch(extractedList);
          const bestClothingType = processed_list[0].split(' ')[0];
          console.log("PROCESSED LIST", bestClothingType.trim());
          // Declare clothes outside the if/else if block
          let firstMatch;
          try {
            //TODO: check every clothing type works
            if (bestClothingType === 'short') {
              (async function fetchShorts() {
                try {
                  //TODO: change to match KNN closest dress, currently just the first dress
                  const short = await Short.find({});
                  highest_index = findHighestMatch(extractedList, short)
                  firstShort = short[highest_index]; // Use first dress (as an example)
                  let result = firstShort['base_64'].replace(/\//g, '_').slice(-10) + ".jpg";

                  const s3 = new AWS.S3();
                  const bucketName = 'gcpmatchproject';
                  const objectKey = result;
  
                  const params = {
                    Bucket: bucketName,
                    Key: objectKey
                  };
  
                  s3.getObject(params, (err, data) => {
                    if (err) {
                      console.error(err);
                      reject(err); // Reject on S3 error
                    } else {
                      // TODO: is it best practice to use a public endpoint
                     // fs.writeFileSync(`./s3_uploads/${objectKey}`, data.Body);
                     // console.log(`File saved as ./s3_uploads/${objectKey}`);
                      resolve(`https://${bucketName}.s3.amazonaws.com/${objectKey}`); // Resolve promise with the objectKey
                    }
                  });
                } catch (error) {
                  console.error("Error fetching dresses:", error);
                  reject(error); // Reject if error occurs
                }
              })();



            } else if (bestClothingType === 'dress') {
              (async function fetchDresses() {
                try {
                  //TODO: change to match KNN closest dress, currently just the first dress
                  const dresses = await Dress.find({});
                  highest_index = findHighestMatch(extractedList, dresses)
                  console.log(highest_index)
                  firstDress = dresses[highest_index]; // Use first dress (as an example)
                  let result = firstDress['base_64'].replace(/\//g, '_').slice(-10) + ".jpg";
  
                  const s3 = new AWS.S3();
                  const bucketName = 'gcpmatchproject';
                  const objectKey = result;
  
                  const params = {
                    Bucket: bucketName,
                    Key: objectKey
                  };
  
                  s3.getObject(params, (err, data) => {
                    if (err) {
                      console.error(err);
                      reject(err); // Reject on S3 error
                    } else {
                      // TODO: is it best practice to use a public endpoint
                     // fs.writeFileSync(`./s3_uploads/${objectKey}`, data.Body);
                     // console.log(`File saved as ./s3_uploads/${objectKey}`);
                      resolve(`https://${bucketName}.s3.amazonaws.com/${objectKey}`); // Resolve promise with the objectKey
                    }
                  });
                } catch (error) {
                  console.error("Error fetching dresses:", error);
                  reject(error); // Reject if error occurs
                }
              })();
             }else if (bestClothingType === 'shirt') {
              (async function fetchShirts() {
                try {
                  //TODO: change to match KNN closest dress, currently just the first dress
                  const shirts = await Shirt.find({});
                  highest_index = findHighestMatch(extractedList, shirts)
                  console.log(highest_index)
                  firstShirt = shirts[highest_index]; // Use first dress (as an example)
                  let result = firstShirt['base_64'].replace(/\//g, '_').slice(-10) + ".jpg";
  
                  const s3 = new AWS.S3();
                  const bucketName = 'gcpmatchproject';
                  const objectKey = result;
  
                  const params = {
                    Bucket: bucketName,
                    Key: objectKey
                  };
  
                  s3.getObject(params, (err, data) => {
                    if (err) {
                      console.error(err);
                      reject(err); // Reject on S3 error
                    } else {
                      // TODO: is it best practice to use a public endpoint
                     // fs.writeFileSync(`./s3_uploads/${objectKey}`, data.Body);
                     // console.log(`File saved as ./s3_uploads/${objectKey}`);
                      resolve(`https://${bucketName}.s3.amazonaws.com/${objectKey}`); // Resolve promise with the objectKey
                    }
                  });
                } catch (error) {
                  console.error("Error fetching dresses:", error);
                  reject(error); // Reject if error occurs
                }
              })();           
             }else if (bestClothingType === 'pants') {
              (async function fetchPants() {
                try {
                  //TODO: change to match KNN closest dress, currently just the first dress
                  const pants = await Pant.find({});
                  highest_index = findHighestMatch(extractedList, pants)
                  console.log(highest_index)
                  firstPant = pants[highest_index]; // Use first dress (as an example)
                  let result = firstPant['base_64'].replace(/\//g, '_').slice(-10) + ".jpg";
  
                  const s3 = new AWS.S3();
                  const bucketName = 'gcpmatchproject';
                  const objectKey = result;
  
                  const params = {
                    Bucket: bucketName,
                    Key: objectKey
                  };
                  console.log(objectKey)
                  s3.getObject(params, (err, data) => {
                    if (err) {
                      console.error(err);
                      reject(err); // Reject on S3 error
                    } else {
                      // TODO: is it best practice to use a public endpoint
                     // fs.writeFileSync(`./s3_uploads/${objectKey}`, data.Body);
                     // console.log(`File saved as ./s3_uploads/${objectKey}`);
                      resolve(`https://${bucketName}.s3.amazonaws.com/${objectKey}`); // Resolve promise with the objectKey
                    }
                  });
                } catch (error) {
                  console.error("Error fetching dresses:", error);
                  reject(error); // Reject if error occurs
                }
              })(); 
            } else if (bestClothingType === 'skirts') {
            }

          } catch (error) {
            console.error("Error fetching clothes:", error);
            reject(error); // Reject if error occurs
          }
        }
    });
  });
}


// Serve uploaded images
app.use('/uploads', express.static('uploads'));
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});

