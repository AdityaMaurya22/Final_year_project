#!/usr/bin/env python3
"""
Simple Flask server for translation that handles everything directly.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import whisper
from deep_translator import GoogleTranslator
from gtts import gTTS
import pyttsx3
import ffmpeg
import torch
import uuid
import json

# Set UTF-8 encoding for Windows
import sys
if sys.platform.startswith('win'):
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())

# Auto-detect GPU
USE_GPU = torch.cuda.is_available()
MODEL_NAME = "large-v3" if USE_GPU else "small"
print(f"Loading Whisper model: {MODEL_NAME} (GPU: {USE_GPU})")
model = whisper.load_model(MODEL_NAME)

# Language options
lang_options = {
    "English": "en", "Hindi": "hi", "Bengali": "bn", "Tamil": "ta", "Telugu": "te",
    "Marathi": "mr", "Gujarati": "gu", "Kannada": "kn", "Malayalam": "ml", "Punjabi": "pa",
    "Urdu": "ur", "Spanish": "es", "French": "fr", "German": "de", "Japanese": "ja", 
    "Arabic": "ar", "Italian": "it", "Nepali": "ne", "Portuguese": "pt", "Russian": "ru",
    "Bhojpuri": "bho", "Chinese (Simplified)": "zh-CN", "Chinese (Traditional)": "zh-TW"
}

# Translation function (Google)
def translate_google(text, lang="hi"):
    try:
        # Clean the text to avoid Unicode issues
        text = text.encode('ascii', 'ignore').decode('ascii')
        
        sentences = text.split(". ")
        translated_sentences = []
        
        for s in sentences:
            if s.strip():
                try:
                    translated = GoogleTranslator(source="en", target=lang).translate(s)
                    # Clean the translated text
                    translated = translated.encode('ascii', 'ignore').decode('ascii')
                    translated_sentences.append(translated)
                except Exception as e:
                    # If translation fails, use original text
                    translated_sentences.append(s)
        
        return ". ".join(translated_sentences)
    except Exception as e:
        # Return original text if translation fails
        return text

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
        # Clean text for TTS
        clean_text = text.encode('ascii', 'ignore').decode('ascii')
        if not clean_text.strip():
            clean_text = "Translation completed"
        
        gTTS(text=clean_text, lang=lang, slow=False).save(speech_path)
    except Exception as e:
        try:
            engine = pyttsx3.init()
            clean_text = text.encode('ascii', 'ignore').decode('ascii')
            if not clean_text.strip():
                clean_text = "Translation completed"
            engine.save_to_file(clean_text, speech_path)
            engine.runAndWait()
        except:
            # Create a silent audio file if TTS fails
            import subprocess
            subprocess.run(['ffmpeg', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-t', '1', speech_path], 
                         capture_output=True, check=False)
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
    video = ffmpeg.input(video_path).video
    audio = ffmpeg.input(audio_path).audio
    (
        ffmpeg
        .output(video, audio, output, c='copy')
        .global_args("-shortest")
        .overwrite_output()
        .run(quiet=True)
    )
    return output

# Flask app
app = Flask(__name__)
CORS(app)

@app.route('/languages', methods=['GET'])
def get_languages():
    return jsonify(lang_options)

@app.route('/upload', methods=['POST'])
def upload_and_translate():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        target_lang = request.form.get('target_lang', 'hi')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        print(f"Processing: {file.filename}")
        print(f"Target language: {target_lang}")
        
        # Save uploaded file
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        input_path = f"temp_{file_id}{file_extension}"
        file.save(input_path)
        
        # Check if it's video or audio
        is_video = file.filename.lower().endswith((".mp4", ".mov", ".mkv"))
        
        try:
            # Step 1: Extract audio if video
            if is_video:
                print("Extracting audio from video...")
                raw_audio = extract_audio(input_path)
            else:
                print("Using audio file directly...")
                raw_audio = input_path
            
            # Step 2: Clean audio
            print("Cleaning audio...")
            cleaned_audio = clean_audio(raw_audio)
            
            # Step 3: Whisper transcription (same language)
            print("Transcribing original language...")
            original_transcript = whisper_transcribe(cleaned_audio)
            print(f"Original: {original_transcript[:100].encode('ascii', 'ignore').decode('ascii')}...")
            
            # Step 4: Whisper English translation
            print("Translating to English...")
            whisper_english = whisper_translate(cleaned_audio)
            print(f"English: {whisper_english[:100].encode('ascii', 'ignore').decode('ascii')}...")
            
            # Step 5: Google translation from English to target
            print(f"Translating to {target_lang}...")
            final_translation = translate_google(whisper_english, lang=target_lang)
            print(f"Final: {final_translation[:100].encode('ascii', 'ignore').decode('ascii')}...")
            
            # Step 6: TTS
            print("Generating speech...")
            tts_path = tts(final_translation, lang=target_lang)
            
            # Step 7: Process result
            if is_video:
                print("Processing video...")
                duration = get_duration(input_path)
                synced_audio = match_audio_to_video(tts_path, duration)
                final_output = merge_audio_video(input_path, synced_audio)
                output_filename = f"translated_video_{file_id}.mp4"
            else:
                print("Processing audio...")
                final_output = tts_path
                output_filename = f"translated_audio_{file_id}.mp3"
            
            # Move to translated_files directory
            os.makedirs("translated_files", exist_ok=True)
            final_path = os.path.join("translated_files", output_filename)
            os.rename(final_output, final_path)
            print(f"Translation complete: {output_filename}")
            
            # Cleanup temp files
            if os.path.exists(input_path):
                os.remove(input_path)
            if raw_audio != input_path:
                os.remove(raw_audio)
            os.remove(cleaned_audio)
            if is_video:
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
            print(f"Translation error: {str(e)}")
            # Cleanup on error
            if os.path.exists(input_path):
                os.remove(input_path)
            return jsonify({'error': f'Translation failed: {str(e)}'}), 500
            
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    try:
        file_path = os.path.join("translated_files", filename)
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True)
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'OK',
        'message': 'Translation server is running',
        'languages_available': len(lang_options)
    })

if __name__ == "__main__":
    print("Translanova Translation Server")
    print("=====================================")
    print("Server running on http://localhost:8501")
    print("=====================================")
    app.run(host='0.0.0.0', port=8501, debug=False)

