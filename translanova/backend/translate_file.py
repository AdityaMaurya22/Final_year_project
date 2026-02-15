#!/usr/bin/env python3
"""
Simple translation script that processes files and returns translated versions.
This script can be called from the React frontend.
"""

import os
import sys
import tempfile
import whisper
from deep_translator import GoogleTranslator
from gtts import gTTS
import pyttsx3
import ffmpeg
import torch
import json
import uuid
from pathlib import Path
import traceback

# Set UTF-8 encoding for Windows
if sys.platform.startswith('win'):
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())

# Auto-detect GPU
USE_GPU = torch.cuda.is_available()
MODEL_NAME = "large-v3" if USE_GPU else "small"
print(f"Loading Whisper model: {MODEL_NAME} (GPU: {USE_GPU})")
model = whisper.load_model(MODEL_NAME)

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

def translate_file(input_file, target_language="hi"):
    """Main translation function"""
    try:
        print(f"Processing: {input_file}")
        print(f"Target language: {target_language}")
        
        # Check if it's video or audio
        is_video = input_file.lower().endswith((".mp4", ".mov", ".mkv"))
        
        # Step 1: Extract audio if video
        raw_audio = extract_audio(input_file) if is_video else input_file
        print("Audio extracted")

        # Step 2: Clean audio
        cleaned_audio = clean_audio(raw_audio)
        print("Audio cleaned")

        # Step 3: Whisper transcription (same language)
        print("Transcribing original language...")
        original_transcript = whisper_transcribe(cleaned_audio)
        print(f"Original: {original_transcript[:100].encode('ascii', 'ignore').decode('ascii')}...")

        # Step 4: Whisper English translation
        print("Translating to English...")
        whisper_english = whisper_translate(cleaned_audio)
        print(f"English: {whisper_english[:100].encode('ascii', 'ignore').decode('ascii')}...")

        # Step 5: Google translation from English to target
        print(f"Translating to {target_language}...")
        final_translation = translate_google(whisper_english, lang=target_language)
        print(f"Final: {final_translation[:100].encode('ascii', 'ignore').decode('ascii')}...")

        # Step 6: TTS
        print("Generating speech...")
        tts_path = tts(final_translation, lang=target_language)

        # Step 7: Process result
        if is_video:
            print("Processing video...")
            duration = get_duration(input_file)
            synced_audio = match_audio_to_video(tts_path, duration)
            final_output = merge_audio_video(input_file, synced_audio)
            output_filename = f"translated_video_{uuid.uuid4().hex[:8]}.mp4"
        else:
            final_output = tts_path
            output_filename = f"translated_audio_{uuid.uuid4().hex[:8]}.mp3"

        # Move to translated_files directory
        os.makedirs("translated_files", exist_ok=True)
        final_path = os.path.join("translated_files", output_filename)
        os.rename(final_output, final_path)
        print(f"Translation complete: {output_filename}")

        # Cleanup temp files
        if os.path.exists(input_file):
            os.remove(input_file)
        if raw_audio != input_file:
            os.remove(raw_audio)
        os.remove(cleaned_audio)
        if is_video:
            os.remove(synced_audio)

        return {
            'success': True,
            'audio_file' if not is_video else 'video_file': output_filename,
            'original_transcript': original_transcript,
            'whisper_english': whisper_english,
            'final_translation': final_translation,
            'target_language': target_language
        }

    except Exception as e:
        tb = traceback.format_exc()
        print(f"Error: {e}")
        print(tb)
        return {'success': False, 'error': str(e), 'traceback': tb}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python translate_file.py <input_file> [target_language]")
        print("Example: python translate_file.py audio.mp3 hi")
        sys.exit(1)
    
    input_file = sys.argv[1]
    target_language = sys.argv[2] if len(sys.argv) > 2 else "hi"
    
    if not os.path.exists(input_file):
        print(f"File not found: {input_file}")
        sys.exit(1)
    
    result = translate_file(input_file, target_language)
    print("\n" + "="*50)
    print("RESULT:")
    print(json.dumps(result, indent=2))
