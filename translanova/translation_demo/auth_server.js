const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');

// Verify environment variables are loaded
console.log('Environment check:');
if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not defined in environment variables');
    console.log('Current directory:', __dirname);
    console.log('Looking for .env file at:', path.join(__dirname, '.env'));
    process.exit(1);
}
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
console.log('Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s
})
.then(() => {
  console.log('Successfully connected to MongoDB Atlas');
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  console.log('Connection string used:', process.env.MONGODB_URI.replace(/:[^:]*@/, ':****@')); // Hide password in logs
});

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Translation Schema
const translationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalFile: {
    type: String,
    required: true
  },
  translatedFile: {
    type: String,
    required: true
  },
  originalLanguage: String,
  targetLanguage: {
    type: String,
    required: true
  },
  originalTranscript: String,
  englishTranslation: String,
  finalTranslation: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);
const Translation = mongoose.model('Translation', translationSchema);

// Authentication Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findOne({ _id: decoded.id });
    
    if (!user) {
      throw new Error();
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Please authenticate' });
  }
};

// Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Registration attempt:', req.body);
    console.log('JWT_SECRET is set:', !!process.env.JWT_SECRET);
    
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user exists
    console.log('Checking if user exists...');
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log('User already exists:', { email, username });
      return res.status(400).json({ error: 'User already exists' });
    }

    console.log('No existing user found, proceeding with registration');

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    console.log('Creating new user object...');
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    console.log('Attempting to save user:', { username, email });
    await user.save();
    console.log('User saved successfully');
    
    // Generate token
    console.log('Generating JWT token...');
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log('Token generated successfully');
    
    res.status(201).json({ token, user: { id: user._id, username, email } });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Error creating user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.json({ token, user: { id: user._id, username: user.username, email } });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Save translation
app.post('/api/translations', auth, async (req, res) => {
  try {
    const {
      originalFile,
      translatedFile,
      originalLanguage,
      targetLanguage,
      originalTranscript,
      englishTranslation,
      finalTranslation
    } = req.body;

    const translation = new Translation({
      userId: req.user._id,
      originalFile,
      translatedFile,
      originalLanguage,
      targetLanguage,
      originalTranscript,
      englishTranslation,
      finalTranslation
    });

    await translation.save();
    res.status(201).json(translation);
  } catch (error) {
    res.status(500).json({ error: 'Error saving translation' });
  }
});

// Get user's translations
app.get('/api/translations', auth, async (req, res) => {
  try {
    const translations = await Translation.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(translations);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching translations' });
  }
});

// Get user profile
app.get('/api/user/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// Update user profile
app.put('/api/user/profile', auth, async (req, res) => {
  try {
    const updates = {};
    if (req.body.username) updates.username = req.body.username;
    if (req.body.email) updates.email = req.body.email;
    if (req.body.password) {
      updates.password = await bcrypt.hash(req.body.password, 10);
    }

    // Check if email or username is already taken
    if (updates.email || updates.username) {
      const existingUser = await User.findOne({
        $and: [
          { _id: { $ne: req.user._id } },
          {
            $or: [
              { email: updates.email || '' },
              { username: updates.username || '' }
            ]
          }
        ]
      });

      if (existingUser) {
        return res.status(400).json({ 
          error: 'Email or username already taken' 
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error updating user profile' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Auth & DB server running on port ${PORT}`);
});