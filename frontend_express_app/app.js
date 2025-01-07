const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { exec } = require('child_process'); 
const app = express();
const mongoose = require('mongoose');
var Dress = require('./models/dress_model.js');
const port = 3000;

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
    res.render('arena', { filename: req.file.filename, base64ImageName: base64ImageName });
    triggerBashScript(`base64_${req.file.filename}`);
  }
  catch (error) {
    console.error('Error processing the image:', error);
    res.status(500).send('Error processing the image.');
  }
});


function triggerBashScript(file_executed) {
  const command = `cd base64_uploads && python3 base64_converter.py ${file_executed} && ./convert_upload.sh`;

  // Print the command for debugging purposes
  console.log(`Executing command: ${command}`);

  // Use child_process to execute the bash script
  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error executing bash script: ${stderr}`);
      return;
    }

    const matches = stdout.match(/\[(.*?)\]/);

    // If matches found, split by commas
    mongoose.connect("mongodb+srv://jainishmehta:jainish1234@cluster0.7izqa.mongodb.net/clothing_images?retryWrites=true&w=majority")


    if (matches) {
      const extractedList = matches[1].split(',').map(item => item.trim());
      const extractedTypes = [];
      for (let i=0; i<extractedList.length; i++){
        const description = extractedList[i].split(':')[0].trim();
        extractedTypes.push(description);
        //If there is a match to one of the categories, add it
        if (/Dress/i.test(description)) {
            console.log(`${description} matches 'Dress'`);
          //TODO: Check this stackoverflow for understanding : https://stackoverflow.com/questions/19051041/cannot-overwrite-model-once-compiled-mongoose
            Dress.find().then((posts) => {
              console.log(posts);
             })
          } else {
            console.log(`${description} does not match 'Dress'`);
        }
      }
      console.log(extractedTypes);


    } else {
      console.log('No matches found');
    }
  });
}



// Serve uploaded images
app.use('/uploads', express.static('uploads'));
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});

