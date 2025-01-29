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
const { MongoClient } = require('mongodb');

const AWS = require('aws-sdk');

const { processKnnMatch } = require('./knn_match');

const port = 3000;

const app = express();
const s3 = new AWS.S3();

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

app.set('view engine', 'ejs');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the upload form
app.get('/', (req, res) => {
  res.send(`
    <h1>Upload an Image</h1>
    <form action="/upload" method="post" enctype="multipart/form-data">
      <input type="file" name="image" accept="image/*" required />
      <button type="submit">Upload</button>
    </form>
  `);
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
    res.render('arena', { filename: req.file.filename, s3_filename: objectkey, base64ImageName: base64ImageName });
    
  }
  catch (error) {
    console.error('Error processing the image:', error);
    res.status(500).send('Error processing the image.');
  }
});

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
                  firstShort = short[0]; // Use first dress (as an example)
                  let result = firstShort['base_64'].replace(/\//g, '_').slice(-10) + ".jpg";
                  console.log(result)
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
                  console.log(dresses[0])
                  firstDress = dresses[0]; // Use first dress (as an example)
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
                  console.log(shirts[0])
                  firstShirt = shirts[0]; // Use first dress (as an example)
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
                  console.log(pants[0])
                  firstPant = pants[0]; // Use first dress (as an example)
                  let result = firstPant['base_64'].replace(/\//g, '_').slice(-10) + ".jpg";
  
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

