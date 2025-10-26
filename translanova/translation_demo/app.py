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

# Auto-detect GPU
USE_GPU = torch.cuda.is_available()
MODEL_NAME = "large-v3" if USE_GPU else "small"
model = whisper.load_model(MODEL_NAME)

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

@flask_app.route('/languages', methods=['GET'])
def get_languages():
    return jsonify(lang_options)

@flask_app.route('/upload', methods=['POST'])
def upload_and_translate():
    try:
        print(" Received upload request")
        
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
        
        try:
            print(" Starting translation process...")
            
            # Step 1: Extract audio if video
            if is_video:
                print(" Extracting audio from video...")
                raw_audio = extract_audio(input_path)
            else:
                print(" Using audio file directly...")
                raw_audio = input_path
            
            # Step 2: Clean audio
            print(" Cleaning audio...")
            cleaned_audio = clean_audio(raw_audio)
            
            # Step 3: Whisper transcription (same language)
            print(" Transcribing original language...")
            original_transcript = whisper_transcribe(cleaned_audio)
            print(f" Original transcript: {original_transcript[:100]}...")
            
            # Step 4: Whisper English translation
            print("🇬🇧 Translating to English...")
            whisper_english = whisper_translate(cleaned_audio)
            print(f" English translation: {whisper_english[:100]}...")
            
            # Step 5: Google translation from English to target
            print(f" Translating to {target_lang}...")
            final_translation = translate_google(whisper_english, lang=target_lang)
            print(f" Final translation: {final_translation[:100]}...")
            

            # Step 6: TTS
            print(" Generating speech...")
            tts_path = tts(final_translation, lang=target_lang)
            print(f" TTS audio path: {tts_path}")
            tts_duration = get_duration(tts_path)
            print(f" TTS audio duration: {tts_duration}")

            # Step 7: Process result
            if is_video:
                print(" Processing video...")
                duration = get_duration(input_path)
                print(f" Original video duration: {duration}")
                synced_audio = match_audio_to_video(tts_path, duration)
                print(f" Synced audio path: {synced_audio}")
                print(f" Synced audio duration: {get_duration(synced_audio)}")
                final_output = merge_audio_video(input_path, synced_audio)
                print(f" Merged video output: {final_output}")
                output_filename = f"translated_video_{file_id}.mp4"
            else:
                print(" Processing audio...")
                final_output = tts_path
                output_filename = f"translated_audio_{file_id}.mp3"
            
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
            
            return jsonify({
                'success': True,
                'audio_file' if not is_video else 'video_file': output_filename,
                'original_transcript': original_transcript,
                'whisper_english': whisper_english,
                'final_translation': final_translation,
                'target_language': target_lang
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