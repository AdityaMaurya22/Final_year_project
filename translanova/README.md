# Translanova - Audio & Video Translation App

Clean project structure with **Backend** and **Frontend** separated.

## Folder Structure

```
translanova/
├── backend/          # Flask Python backend (API server)
│   ├── app.py       # Main Flask application
│   ├── requirements.txt
│   ├── models/      # ML models (Whisper)
│   ├── services/    # Transcription and translation services
│   ├── utils/       # Utility functions
│   ├── uploads/     # Uploaded files storage
│   └── translated_files/  # Generated translated media
│
└── frontend/        # React frontend (web UI)
    ├── src/         # React components and pages
    ├── public/      # Static assets
    ├── package.json
    └── package-lock.json
```

## Setup Instructions

### 1. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Run Flask API server (runs on http://localhost:8501)
python app.py
```

### 2. Frontend Setup

```bash
# In a new terminal, navigate to frontend folder
cd frontend

# Install Node.js dependencies
npm install

# Start React development server (runs on http://localhost:3000)
npm start
```

## API Endpoints

The backend API runs on `http://localhost:8501` with CORS enabled.

- `POST /upload` - Upload and translate audio/video files
- `GET /download/<filename>` - Download translated media
- `GET /languages` - Get supported languages

## Technologies Used

- **Backend**: Flask, Whisper (OpenAI), GoogleTranslator, gTTS, FFmpeg
- **Frontend**: React, Axios, Bootstrap
- **Audio/Video Processing**: FFmpeg, pyttsx3, gTTS

## Running the Application

1. Start the **backend** first (Flask server must be running)
2. Start the **frontend** second (React dev server)
3. Open browser to `http://localhost:3000`
4. Upload audio/video, select target language, and translate!

---

**Note**: Ensure both backend and frontend are running simultaneously for the app to work properly.
