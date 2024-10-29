const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
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
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.send(`Image uploaded successfully: <a href="/uploads/${req.file.filename}">${req.file.filename}</a>`);
});

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
