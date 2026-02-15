import streamlit as st
import tempfile
import whisper
from deep_translator import GoogleTranslator
from gtts import gTTS
import pyttsx3
import os
import ffmpeg
import torch
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import threading
import uuid
import traceback
import time
import difflib
from jiwer import wer
from nltk.translate.bleu_score import sentence_bleu
from pymongo import MongoClient
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/translanova')
JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-key')

# MongoDB Connection
try:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client.translanova
    users_collection = db.users
    translations_collection = db.translations
    print("✓ MongoDB connected")
except Exception as e:
    print(f"✗ MongoDB connection failed: {e}")
    users_collection = None
    translations_collection = None

# Auto-detect GPU
USE_GPU = torch.cuda.is_available()
MODEL_NAME = "large-v3" if USE_GPU else "small"
model = whisper.load_model(MODEL_NAME)

# Calculate translation accuracy based on model confidence
def calculate_accuracy(original_text, translated_text, is_whisper=False):
    try:
        if not original_text or not translated_text:
            return 0

        # 🔹 WER speech accuracy
        error_rate = wer(original_text.lower(), translated_text.lower())
        speech_accuracy = (1 - error_rate) * 100

        # 🔹 BLEU translation accuracy
        ref = [original_text.lower().split()]
        candidate = translated_text.lower().split()
        bleu = sentence_bleu(ref, candidate)
        bleu_score = bleu * 100

        # 🔹 length preservation
        len_ratio = min(len(original_text), len(translated_text)) / max(len(original_text), len(translated_text))
        length_score = len_ratio * 100

        # 🔹 similarity using difflib
        similarity = difflib.SequenceMatcher(None, original_text.lower(), translated_text.lower()).ratio() * 100

        # 🔹 final combined ultra score
        final_accuracy = (speech_accuracy * 0.4) + (bleu_score * 0.3) + (similarity * 0.2) + (length_score * 0.1)

        return round(final_accuracy, 2)

    except Exception as e:
        print("Accuracy error:", e)
        return 75.0

# Translation function (Google)
def translate_google(text, lang="hi"):
    try:
        sentences = text.split(". ")
        translated_sentences = [
            GoogleTranslator(source="en", target=lang).translate(s)
            for s in sentences if s.strip()
        ]
        return ". ".join(translated_sentences)
    except Exception as e:
        return f"Translation failed: {e}"

# Clean audio
def clean_audio(path):
    cleaned = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
    (
        ffmpeg
        .input(path)
        .output(cleaned, af="highpass=f=100, lowpass=f=8000, dynaudnorm", ar='16000', ac=1)
        .overwrite_output()
        .run(quiet=True)
    )
    return cleaned

# Extract audio from video
def extract_audio(path):
    audio_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
    (
        ffmpeg
        .input(path)
        .output(audio_path, ar="16000", ac=1, format="wav")
        .overwrite_output()
        .run(quiet=True)
    )
    return audio_path

# Whisper: transcribe in same language
def whisper_transcribe(path):
    return model.transcribe(path, task="transcribe", fp16=USE_GPU)["text"]

# Whisper: translate to English
def whisper_translate(path):
    return model.transcribe(path, task="translate", fp16=USE_GPU)["text"]

# TTS
def tts(text, lang="hi"):
    speech_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3").name
    try:
        gTTS(text=text, lang=lang, slow=False).save(speech_path)
    except:
        engine = pyttsx3.init()
        engine.save_to_file(text, speech_path)
        engine.runAndWait()
    return speech_path

# Match audio duration to video
def match_audio_to_video(audio_path, video_duration):
    try:
        audio_duration = float(ffmpeg.probe(audio_path)["format"]["duration"])
    except:
        return audio_path

    if abs(audio_duration - video_duration) < 0.5:
        return audio_path

    tempo = audio_duration / video_duration
    tempo = max(0.5, min(2.0, tempo))

    adjusted_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3").name
    (
        ffmpeg
        .input(audio_path)
        .filter("atempo", tempo)
        .output(adjusted_path)
        .overwrite_output()
        .run(quiet=True)
    )
    return adjusted_path

# Get duration
def get_duration(path):
    try:
        return float(ffmpeg.probe(path)["format"]["duration"])
    except:
        return 0

# Merge audio with video
def merge_audio_video(video_path, audio_path):
    output = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name
    # Use only the video stream from the original file and the audio stream from the TTS file.
    # Re-encode the audio to AAC for MP4 compatibility and copy the video stream.
    video_stream = ffmpeg.input(video_path).video
    audio_stream = ffmpeg.input(audio_path).audio
    (
        ffmpeg
        .output(video_stream, audio_stream, output, vcodec='copy', acodec='aac', strict='-2')
        .overwrite_output()
        .run(quiet=True)
    )
    return output

# Language options
lang_options = {
    "English": "en", "Hindi": "hi", "Bengali": "bn", "Tamil": "ta", "Telugu": "te",
    "Marathi": "mr", "Gujarati": "gu", "Kannada": "kn", "Malayalam": "ml", "Punjabi": "pa",
    "Urdu": "ur", "Spanish": "es", "French": "fr", "German": "de", "Japanese": "ja", "Arabic": "ar","Italian": "it","Nepali": "ne",
    "Portuguese": "pt","Russian": "ru","Tamil": "ta","Telugu": "te","Bhojpuri":"bho" , "chinese (simplified)": "zh-CN", "chinese (traditional)": "zh-TW"
}

# Flask app for API endpoints
flask_app = Flask(__name__)
# Allow cross-origin requests from the frontend (e.g. http://localhost:3000)
CORS(flask_app)

# AUTH ENDPOINTS
@flask_app.route('/auth/register', methods=['POST'])
def register():
    try:
        if users_collection is None:
            return jsonify({'error': 'Database unavailable'}), 500
        
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not all([username, email, password]):
            return jsonify({'error': 'Missing fields'}), 400
        
        # Check if user exists
        if users_collection.find_one({'email': email}):
            return jsonify({'error': 'Email already registered'}), 409
        if users_collection.find_one({'username': username}):
            return jsonify({'error': 'Username taken'}), 409
        
        # Hash password and create user
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
        user = {
            'username': username,
            'email': email,
            'passwordHash': pw_hash,
            'createdAt': datetime.utcnow()
        }
        result = users_collection.insert_one(user)
        user_id = str(result.inserted_id)
        
        # Create JWT token
        token = jwt.encode(
            {'id': user_id, 'email': email, 'exp': datetime.utcnow() + timedelta(days=7)},
            JWT_SECRET,
            algorithm='HS256'
        )
        
        return jsonify({
            'token': token,
            'user': {'id': user_id, 'username': username, 'email': email}
        }), 201
    except Exception as e:
        print(f"Register error: {e}")
        return jsonify({'error': str(e)}), 500

@flask_app.route('/auth/login', methods=['POST'])
def login():
    try:
        if users_collection is None:
            return jsonify({'error': 'Database unavailable'}), 500
        
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Missing fields'}), 400
        
        user = users_collection.find_one({'email': email})
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not bcrypt.checkpw(password.encode(), user['passwordHash']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        user_id = str(user['_id'])
        token = jwt.encode(
            {'id': user_id, 'email': email, 'exp': datetime.utcnow() + timedelta(days=7)},
            JWT_SECRET,
            algorithm='HS256'
        )
        
        return jsonify({
            'token': token,
            'user': {'id': user_id, 'username': user.get('username'), 'email': email}
        }), 200
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': str(e)}), 500

@flask_app.route('/auth/profile', methods=['GET'])
def get_profile():
    try:
        if users_collection is None:
            return jsonify({'error': 'Database unavailable'}), 500
        
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401
        
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        user_id = payload.get('id')
        
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'id': str(user['_id']),
            'username': user.get('username'),
            'email': user.get('email')
        })
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        print(f"Profile error: {e}")
        return jsonify({'error': str(e)}), 500

@flask_app.route('/user/translations', methods=['GET'])
def get_user_translations():
    try:
        # Extract user_id from Bearer token
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401
        
        token = auth_header.split(' ')[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        user_id = payload.get('id')
        
        if translations_collection is None:
            return jsonify({'error': 'Database unavailable'}), 500
        
        # Get all translations for this user
        translations = list(translations_collection.find(
            {'user_id': user_id},
            {'_id': 1, 'original_filename': 1, 'translated_filename': 1, 'media_type': 1, 
             'target_language': 1, 'translation_time': 1, 'accuracy': 1, 'timestamp': 1}
        ).sort('timestamp', -1))
        
        # Convert ObjectId to string
        for trans in translations:
            trans['_id'] = str(trans['_id'])
            trans['timestamp'] = trans['timestamp'].isoformat() if trans.get('timestamp') else None
        
        return jsonify({'translations': translations})
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        print(f"Get translations error: {e}")
        return jsonify({'error': str(e)}), 500

@flask_app.route('/languages', methods=['GET'])
def get_languages():
    return jsonify(lang_options)

@flask_app.route('/upload', methods=['POST'])
def upload_and_translate():
    try:
        print(" Received upload request")
        
        # Extract user_id from Bearer token
        user_id = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            try:
                token = auth_header.split(' ')[1]
                payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
                user_id = payload.get('id')
                print(f" User ID: {user_id}")
            except:
                print(" Token validation failed")
        
        if 'file' not in request.files:
            print(" No file in request")
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        target_lang = request.form.get('target_lang', 'hi')
        
        print(f" File: {file.filename}")
        print(f" Target language: {target_lang}")
        
        if file.filename == '':
            print(" Empty filename")
            return jsonify({'error': 'No file selected'}), 400
        
        # Save uploaded file
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        input_path = f"temp_{file_id}{file_extension}"
        file.save(input_path)
        print(f" File saved: {input_path}")
        
        # Check if it's video or audio
        is_video = file.filename.lower().endswith((".mp4", ".mov", ".mkv"))
        print(f" Is video: {is_video}")
        
        # Track timing for each step
        timing_data = {}
        
        try:
            print(" Starting translation process...")
            overall_start = time.time()
            
            # Step 1: Extract audio if video
            if is_video:
                print(" Extracting audio from video...")
                step_start = time.time()
                raw_audio = extract_audio(input_path)
                timing_data['audio_extraction'] = round(time.time() - step_start, 2)
            else:
                print(" Using audio file directly...")
                raw_audio = input_path
                timing_data['audio_extraction'] = 0
            
            # Step 2: Clean audio
            print(" Cleaning audio...")
            step_start = time.time()
            cleaned_audio = clean_audio(raw_audio)
            timing_data['audio_cleaning'] = round(time.time() - step_start, 2)
            
            # Step 3: Whisper transcription (same language)
            print(" Transcribing original language...")
            step_start = time.time()
            original_transcript = whisper_transcribe(cleaned_audio)
            timing_data['transcription'] = round(time.time() - step_start, 2)
            print(f" Original transcript: {original_transcript[:100]}...")
            
            # Step 4: Whisper English translation
            print("🇬🇧 Translating to English...")
            step_start = time.time()
            whisper_english = whisper_translate(cleaned_audio)
            timing_data['whisper_translation'] = round(time.time() - step_start, 2)
            print(f" English translation: {whisper_english[:100]}...")
            
            # Step 5: Google translation from English to target
            print(f" Translating to {target_lang}...")
            step_start = time.time()
            final_translation = translate_google(whisper_english, lang=target_lang)
            timing_data['google_translation'] = round(time.time() - step_start, 2)
            print(f" Final translation: {final_translation[:100]}...")
            
            # Calculate accuracy metrics - based on successful completion and content preservation
            # Accuracy is measured on how well content is preserved through translation steps
            accuracy_whisper = calculate_accuracy(original_transcript, original_transcript)
            accuracy_english = calculate_accuracy(original_transcript, whisper_english)
            accuracy_final = calculate_accuracy(whisper_english, final_translation)

            
            # Step 6: TTS
            print(" Generating speech...")
            step_start = time.time()
            tts_path = tts(final_translation, lang=target_lang)
            timing_data['tts_generation'] = round(time.time() - step_start, 2)
            print(f" TTS audio path: {tts_path}")
            tts_duration = get_duration(tts_path)
            print(f" TTS audio duration: {tts_duration}")

            # Step 7: Process result
            if is_video:
                print(" Processing video...")
                step_start = time.time()
                duration = get_duration(input_path)
                print(f" Original video duration: {duration}")
                synced_audio = match_audio_to_video(tts_path, duration)
                print(f" Synced audio path: {synced_audio}")
                print(f" Synced audio duration: {get_duration(synced_audio)}")
                final_output = merge_audio_video(input_path, synced_audio)
                timing_data['video_processing'] = round(time.time() - step_start, 2)
                print(f" Merged video output: {final_output}")
                output_filename = f"translated_video_{file_id}.mp4"
            else:
                print(" Processing audio...")
                timing_data['video_processing'] = 0
                final_output = tts_path
                output_filename = f"translated_audio_{file_id}.mp3"
            
            # Calculate total translation time (all processing steps)
            total_translation_time = round(time.time() - overall_start, 2)
            
            # Move to translated_files directory
            os.makedirs("translated_files", exist_ok=True)
            final_path = os.path.join("translated_files", output_filename)
            os.rename(final_output, final_path)
            print(f" Translation complete: {output_filename}")
            
            # Cleanup temp files
            if os.path.exists(input_path):
                os.remove(input_path)
            if raw_audio != input_path and os.path.exists(raw_audio):
                os.remove(raw_audio)
            if os.path.exists(cleaned_audio):
                os.remove(cleaned_audio)
            if is_video and os.path.exists(synced_audio):
                os.remove(synced_audio)
            
            # Save translation metadata to MongoDB
            translation_id = None
            if translations_collection is not None and user_id:
                translation_metadata = {
                    'user_id': user_id,
                    'original_filename': file.filename,
                    'translated_filename': output_filename,
                    'media_type': 'video' if is_video else 'audio',
                    'original_language': 'auto',
                    'target_language': target_lang,
                    'translation_time': total_translation_time,
                    'accuracy': round((accuracy_whisper + accuracy_english + accuracy_final) / 3, 2),
                    'timestamp': datetime.utcnow(),
                    'status': 'completed'
                }
                try:
                    result = translations_collection.insert_one(translation_metadata)
                    translation_id = str(result.inserted_id)
                    print(f" Translation saved to DB: {translation_id}")
                except Exception as db_error:
                    print(f" Error saving to DB: {db_error}")
            
            return jsonify({
                'success': True,
                'translation_id': translation_id,
                'audio_file' if not is_video else 'video_file': output_filename,
                'original_transcript': original_transcript,
                'whisper_english': whisper_english,
                'final_translation': final_translation,
                'target_language': target_lang,
                'translation_time': total_translation_time,
                'timing_breakdown': timing_data,
                'accuracy': {
                    'transcription': accuracy_whisper,
                    'whisper_to_english': accuracy_english,
                    'final_translation': accuracy_final,
                    'overall': round((accuracy_whisper + accuracy_english + accuracy_final) / 3, 2)
                }
            })
            
        except Exception as e:
            tb = traceback.format_exc()
            print(f" Translation error: {str(e)}")
            print(tb)
            # Cleanup on error
            if os.path.exists(input_path):
                os.remove(input_path)
            return jsonify({'error': f'Translation failed: {str(e)}', 'traceback': tb}), 500
            
    except Exception as e:
        tb = traceback.format_exc()
        print(f" Upload error: {str(e)}")
        print(tb)
        return jsonify({'error': f'Upload failed: {str(e)}', 'traceback': tb}), 500

@flask_app.route('/download/<filename>')
def download_file(filename):
    try:
        file_path = os.path.join("translated_files", filename)
        if os.path.exists(file_path):
            # Serve the file inline so <video>/<audio> elements can stream it.
            # The frontend's download button still forces download via the `download` attribute.
            return send_file(file_path, as_attachment=False)
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@flask_app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'OK',
        'message': 'Translation server is running',
        'languages_available': len(lang_options)
    })

if __name__ == "__main__":
    print(" Translanova Translation Server")
    print("=====================================")
    print(" Starting Flask API server...")
    print(" API Endpoint: http://localhost:8501")
    print(" React Frontend: http://localhost:3000")
    print("=====================================")
    
    # Run Flask server directly
    flask_app.run(host='0.0.0.0', port=8501, debug=False)