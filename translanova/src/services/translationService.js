import axios from 'axios';

// Python backend base URL (Flask server)
const BACKEND_URL = 'http://localhost:8501';

// Keep axios for some endpoints (download/health) but point to backend
const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 300000, // 5 minutes timeout for large files
});

// Static language list (same as in the Streamlit app)
const SUPPORTED_LANGUAGES = {
  "English": "en",
  "Hindi": "hi", 
  "Bengali": "bn", 
  "Tamil": "ta", 
  "Telugu": "te",
  "Marathi": "mr", 
  "Gujarati": "gu", 
  "Kannada": "kn", 
  "Malayalam": "ml", 
  "Punjabi": "pa",
  "Urdu": "ur", 
  "Spanish": "es", 
  "French": "fr", 
  "German": "de", 
  "Japanese": "ja", 
  "Arabic": "ar",
  "Italian": "it",
  "Nepali": "ne",
  "Portuguese": "pt",
  "Russian": "ru",
  "Bhojpuri": "bho",
  "Chinese (Simplified)": "zh-CN", 
  "Chinese (Traditional)": "zh-TW"
};

// Get supported languages
export const getLanguages = async () => {
  try {
    // Prefer server-provided languages if available
    const resp = await fetch(`${BACKEND_URL}/languages`);
    if (resp.ok) {
      return await resp.json();
    }
    // Fallback to static list
    return SUPPORTED_LANGUAGES;
  } catch (error) {
    console.error('Error fetching languages:', error);
    return SUPPORTED_LANGUAGES;
  }
};
// Real audio translation using Python backend
export const translateAudio = async (file, targetLanguage) => {
  try {
    // Create FormData to send to Python backend
    const formData = new FormData();
    formData.append('file', file);
    formData.append('target_lang', targetLanguage);
    
    // Call the Python backend
    const response = await fetch(`${BACKEND_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', errorText);
      throw new Error(`Translation failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();

    // Save translation to MongoDB if user is authenticated
    try {
      const currentUser = JSON.parse(localStorage.getItem('user'));
      if (currentUser) {
        const { saveTranslation } = require('./authService');
        await saveTranslation({
          originalFile: file.name,
          translatedFile: result.audio_file || result.video_file,
          originalLanguage: 'auto', // Whisper auto-detects the language
          targetLanguage,
          originalTranscript: result.original_transcript,
          englishTranslation: result.whisper_english,
          finalTranslation: result.final_translation
        });
      }
    } catch (dbError) {
      console.error('Error saving translation to database:', dbError);
      // Don't fail the translation if DB save fails
    }

    return result;
  } catch (error) {
    console.error('Error translating audio:', error);
    if (error.message.includes('fetch')) {
      throw new Error('Translation service is not running. Please start the backend first.');
    }
    throw error;
  }
};

// Real video translation using Python backend
export const translateVideo = async (file, targetLanguage) => {
  try {
    // Create FormData to send to Python backend
    const formData = new FormData();
    formData.append('file', file);
    formData.append('target_lang', targetLanguage);
    
    // Call the Python backend
    const response = await fetch(`${BACKEND_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', errorText);
      throw new Error(`Translation failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();

    // Save translation to MongoDB if user is authenticated
    try {
      const currentUser = JSON.parse(localStorage.getItem('user'));
      if (currentUser) {
        const { saveTranslation } = require('./authService');
        await saveTranslation({
          originalFile: file.name,
          translatedFile: result.audio_file || result.video_file,
          originalLanguage: 'auto', // Whisper auto-detects the language
          targetLanguage,
          originalTranscript: result.original_transcript,
          englishTranslation: result.whisper_english,
          finalTranslation: result.final_translation
        });
      }
    } catch (dbError) {
      console.error('Error saving translation to database:', dbError);
      // Don't fail the translation if DB save fails
    }

    return result;
  } catch (error) {
    console.error('Error translating video:', error);
    if (error.message.includes('fetch')) {
      throw new Error('Translation service is not running. Please start the backend first.');
    }
    throw error;
  }
};

// Download translated file
export const downloadFile = async (filename) => {
  try {
    const response = await api.get(`/download/${filename}`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};

// Health check
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Error checking API health:', error);
    throw error;
  }
};

export default {
  getLanguages,
  translateAudio,
  translateVideo,
  downloadFile,
  healthCheck,
};
