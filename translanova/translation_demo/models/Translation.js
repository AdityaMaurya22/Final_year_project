const mongoose = require('mongoose');

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

module.exports = mongoose.model('Translation', translationSchema);