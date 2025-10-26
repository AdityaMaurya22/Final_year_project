const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 8501;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// Language options
const languages = {
  "English": "en", "Hindi": "hi", "Bengali": "bn", "Tamil": "ta", "Telugu": "te",
  "Marathi": "mr", "Gujarati": "gu", "Kannada": "kn", "Malayalam": "ml", "Punjabi": "pa",
  "Urdu": "ur", "Spanish": "es", "French": "fr", "German": "de", "Japanese": "ja", 
  "Arabic": "ar", "Italian": "it", "Nepali": "ne", "Portuguese": "pt", "Russian": "ru",
  "Bhojpuri": "bho", "Chinese (Simplified)": "zh-CN", "Chinese (Traditional)": "zh-TW"
};

// Routes
app.get('/languages', (req, res) => {
  res.json(languages);
});

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.sendStatus(200);
});

app.post('/upload', upload.single('file'), (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const targetLang = req.body.target_lang || 'hi';
  const inputFile = req.file.path;
  
  console.log(`Processing: ${req.file.originalname}`);
  console.log(`Target language: ${targetLang}`);

  // Call Python translation script
  const pythonProcess = spawn('python', ['translate_file.py', inputFile, targetLang], {
    cwd: __dirname
  });

  let output = '';
  let errorOutput = '';

  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
    console.log(data.toString());
  });

  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.error(data.toString());
  });

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      try {
        // Parse the JSON result from Python script
        const lines = output.split('\n');
        
        // Find the line that contains the JSON result
        let resultLine = null;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes('"success"') && lines[i].includes('{')) {
            resultLine = lines[i];
            break;
          }
        }
        
        if (resultLine) {
          // Clean the JSON string
          const jsonStart = resultLine.indexOf('{');
          const jsonEnd = resultLine.lastIndexOf('}') + 1;
          const cleanJson = resultLine.substring(jsonStart, jsonEnd);
          
          const result = JSON.parse(cleanJson);
          res.json(result);
        } else {
          console.error('No valid JSON result found in output:', output);
          res.status(500).json({ error: 'Failed to parse translation result' });
        }
      } catch (error) {
        console.error('Error parsing result:', error);
        console.error('Output was:', output);
        res.status(500).json({ error: 'Failed to process translation result' });
      }
    } else {
      console.error(`Python script exited with code ${code}`);
      res.status(500).json({ error: 'Translation failed', details: errorOutput });
    }
  });
});

app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'translated_files', filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Translation server is running' });
});

app.listen(PORT, () => {
  console.log('Translanova Translation Server');
  console.log('=====================================');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Upload directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`Output directory: ${path.join(__dirname, 'translated_files')}`);
  console.log('=====================================');
  console.log('Ready to process translations!');
});
