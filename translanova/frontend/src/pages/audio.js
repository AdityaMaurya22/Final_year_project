import React, { useState, useEffect, useRef } from 'react';
import '../styles/audio.css';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import NavButtons from '../components/NavButtons';
import audio_files from '../images/audio_upload_file.png';
import translationService from '../services/translationService';


const steps = [
  {
    title: 'Upload file',
    description: 'Click the "Choose file" button to import a recording from your device.',
  },
  {
    title: 'Translate audio',
    description: 'Choose the original language and the language of translation. Edit the translation to another language.',
  },
  {
    title: 'Save the project',
    description: 'Click the download button to download the translated audio file.',
  },
];

function Audio() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [languages, setLanguages] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [translationResult, setTranslationResult] = useState(null);
  const [error, setError] = useState(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState(null);
  const [translatedAudioUrl, setTranslatedAudioUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [translationTime, setTranslationTime] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [timingBreakdown, setTimingBreakdown] = useState(null);
  const fileInputRef = useRef(null);
  const originalAudioRef = useRef(null);
  const translatedAudioRef = useRef(null);

  // Load languages on component mount
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const langData = await translationService.getLanguages();
        setLanguages(langData);
      } catch (error) {
        console.error('Failed to load languages:', error);
        setError('Failed to load supported languages');
      }
    };
    loadLanguages();
  }, []);

  // Cleanup object URLs ONLY on component unmount (not on URL changes)
  useEffect(() => {
    return () => {
      if (originalAudioUrl) {
        URL.revokeObjectURL(originalAudioUrl);
      }
      if (translatedAudioUrl && translatedAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(translatedAudioUrl);
      }
    };
  }, []);

  // Sync audio playback between original and translated audio (simple, no auto-play)
  useEffect(() => {
    const originalAudio = originalAudioRef.current;
    const translatedAudio = translatedAudioRef.current;

    if (!originalAudio || !translatedAudio) return;

    const handleOriginalPause = () => { if (!translatedAudio.paused) translatedAudio.pause(); };
    const handleTranslatedPause = () => { if (!originalAudio.paused) originalAudio.pause(); };

    const handleOriginalSeeking = () => {
      try { if (!isNaN(translatedAudio.duration)) translatedAudio.currentTime = Math.min(originalAudio.currentTime, translatedAudio.duration - 0.01); } catch (e) {}
    };

    const handleTranslatedSeeking = () => {
      try { if (!isNaN(originalAudio.duration)) originalAudio.currentTime = Math.min(translatedAudio.currentTime, originalAudio.duration - 0.01); } catch (e) {}
    };

    originalAudio.addEventListener('pause', handleOriginalPause);
    originalAudio.addEventListener('seeking', handleOriginalSeeking);

    translatedAudio.addEventListener('pause', handleTranslatedPause);
    translatedAudio.addEventListener('seeking', handleTranslatedSeeking);

    const align = () => {
      try {
        if (!isNaN(originalAudio.duration) && !isNaN(translatedAudio.duration)) {
          const t = Math.min(originalAudio.currentTime || 0, translatedAudio.currentTime || 0);
          if (!isNaN(translatedAudio.duration)) translatedAudio.currentTime = t;
          if (!isNaN(originalAudio.duration)) originalAudio.currentTime = t;
        }
      } catch (e) {}
    };

    originalAudio.addEventListener('loadedmetadata', align);
    translatedAudio.addEventListener('loadedmetadata', align);

    return () => {
      originalAudio.removeEventListener('pause', handleOriginalPause);
      originalAudio.removeEventListener('seeking', handleOriginalSeeking);
      originalAudio.removeEventListener('loadedmetadata', align);

      translatedAudio.removeEventListener('pause', handleTranslatedPause);
      translatedAudio.removeEventListener('seeking', handleTranslatedSeeking);
      translatedAudio.removeEventListener('loadedmetadata', align);
    };
  }, []);

  // Load the translated audio when URL changes
  useEffect(() => {
    const a = translatedAudioRef.current;
    if (a && translatedAudioUrl) {
      try {
        a.load(); // Tell browser to reload the audio from new source
      } catch (e) {
        console.error('Error loading translated audio:', e);
      }
    }
  }, [translatedAudioUrl]);

  // Load the original audio when URL changes
  useEffect(() => {
    const a = originalAudioRef.current;
    if (a && originalAudioUrl) {
      try {
        a.load(); // Tell browser to reload the audio from new source
      } catch (e) {
        console.error('Error loading original audio:', e);
      }
    }
  }, [originalAudioUrl]);

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a)$/i)) {
      setError('Please select a valid audio file (MP3, WAV, M4A)');
      return;
    }

    // Clean up previous URLs
    if (originalAudioUrl) {
      URL.revokeObjectURL(originalAudioUrl);
    }
    if (translatedAudioUrl && translatedAudioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(translatedAudioUrl);
    }

    setSelectedFile(file);
    setError(null);
    setTranslationResult(null);
    setTranslatedAudioUrl(null);
    setTranslationTime(null);
    setAccuracy(null);
    setTimingBreakdown(null);
    setCurrentStep(1); // Reset to step 1
    
    // Create URL for preview
    const url = URL.createObjectURL(file);
    setOriginalAudioUrl(url);
    
    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleLanguageChange = (event) => {
    setSelectedLanguage(event.target.value);
  };

  const handleTranslate = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await translationService.translateAudio(selectedFile, selectedLanguage);
      setTranslationResult(result);
      
      // Extract and display timing and accuracy information
      if (result.translation_time) {
        setTranslationTime(result.translation_time);
      }
      if (result.accuracy) {
        setAccuracy(result.accuracy);
      }
      if (result.timing_breakdown) {
        setTimingBreakdown(result.timing_breakdown);
      }
      
      // Create URL for the translated audio file
      if (result.audio_file) {
        const translatedUrl = `http://localhost:8501/download/${result.audio_file}`;
        setTranslatedAudioUrl(translatedUrl);
      }
      
      setCurrentStep(3); // Move to final step
    } catch (error) {
      setError(error.response?.data?.error || 'Translation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (translationResult && translationResult.audio_file) {
      try {
        const blob = await translationService.downloadFile(translationResult.audio_file);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = translationResult.audio_file;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Download failed:', err);
        setError('Download failed. Please try again.');
      }
    }
  };

  const { title, description } = steps[currentStep - 1];

  return (
    <div className="audio">
      <section className="audio_sect1">
        <div className="container-fluid">
          <div className="sect1_heading text-center">
            <h1>Translate Audio</h1>
          </div>
        </div>
      </section>
      <section className="audio_sect2">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="audio_sect2_div1">
                <Card>
                  <h2>How to translate audio</h2>
                  <ProgressBar step={currentStep} />
                  <div className="content-wrapper">
                    <NavButtons onPrev={handlePrev} onNext={handleNext} />
                    <div className="step-content">
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="audio_sect3">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="audio_sect3_div1">
                <div className="audio_sect3_div2">
                  <h1>Upload File</h1>
                  <div className="file">
                    <div 
                      className={`file_upload ${isDragOver ? 'drag-over' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <img src={audio_files} alt="file_type"></img>
                      {isDragOver ? (
                        <p className="drag-text">Drop your audio file here!</p>
                      ) : (
                        <p>Click or Drag to Upload Audio File</p>
                      )}
                      <p className="file-hint">Supports MP3, WAV, M4A files</p>
                      <button 
                        type="button" 
                        className="choose-file-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Choose File
                      </button>
                      <input 
                        type="file" 
                        id="file-input"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="audio/*,.mp3,.wav,.m4a"
                        style={{ display: 'none' }}
                      />
                      {selectedFile && (
                        <div className="file-info">
                          <p>Selected: {selectedFile.name}</p>
                          <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="audio_sect4">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="audio_sect4_div1">
                <div className="audio_sect4_div2">
                  <div className="row">
                    <div className="col-lg-6 text-center my-4">
                      <h2>Original audio</h2>
                      {originalAudioUrl ? (
                        <audio ref={originalAudioRef} controls className="sect4_audio">
                          <source src={originalAudioUrl} type="audio/mpeg" />
                          Your browser does not support the audio tag.
                        </audio>
                      ) : (
                        <div className="no-audio">No audio file selected</div>
                      )}
                    </div>
                    <div className="col-lg-6 text-center my-4">
                      <h2>Translated audio</h2>
                      {translatedAudioUrl ? (
                        <audio ref={translatedAudioRef} controls className="sect4_audio">
                          <source src={translatedAudioUrl} type="audio/mpeg" />
                          Your browser does not support the audio tag.
                        </audio>
                      ) : (
                        <div className="no-audio">Translation not available</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="audio_sect4_lang text-center">
                  <h1>Select Language To Translate</h1>
                  <select 
                    value={selectedLanguage} 
                    onChange={handleLanguageChange}
                    className="language-select"
                  >
                    {Object.entries(languages).map(([name, code]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={handleTranslate}
                    disabled={!selectedFile || isLoading}
                    className="translate-btn"
                  >
                    {isLoading ? 'Translating...' : 'Translate Audio'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="audio_sect5 text-center">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              {/* Translation Metrics Display */}
              {translationTime && (
                <div className="audio_metrics_display">
                  <h2>Translation Complete ✓</h2>
                  <div className="metrics-summary">
                    <div className="summary-item">
                      <p className="summary-label">Total Time</p>
                      <p className="summary-value">{translationTime}s</p>
                    </div>
                    <div className="summary-divider"></div>
                    <div className="summary-item">
                      <p className="summary-label">Quality Score</p>
                      <p className="summary-value">{accuracy?.overall}%</p>
                    </div>
                  </div>
                  {/* only show total time and quality score as requested */}
                </div>
              )}
              
              <button 
                className="audio_download_btn"
                onClick={handleDownload}
                disabled={!translationResult}
              >
                Download Translated Audio
              </button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Error Display */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}    
    </div>
  );
}

export default Audio;