import React, { useState, useEffect, useRef } from 'react';
import '../styles/video.css';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import NavButtons from '../components/NavButtons';
import video_files from '../images/audio_upload_file.png';
import translationService from '../services/translationService';


const steps = [
  {
    title: 'Upload file',
    description: 'Click the "Choose file" button to import a recording from your device.',
  },
  {
    title: 'Translate Video',
    description: 'Choose the original language and the language of translation. Edit the translation to another language.',
  },
  {
    title: 'Save the project',
    description: 'Click the download button to download the translated audio file.',
  },
];

function Video() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [languages, setLanguages] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [translationResult, setTranslationResult] = useState(null);
  const [error, setError] = useState(null);
  const [originalVideoUrl, setOriginalVideoUrl] = useState(null);
  const [translatedVideoUrl, setTranslatedVideoUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [translationTime, setTranslationTime] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [timingBreakdown, setTimingBreakdown] = useState(null);
  const [originalDuration, setOriginalDuration] = useState(null);
  const [translatedDuration, setTranslatedDuration] = useState(null);
  const fileInputRef = useRef(null);
  const originalVideoRef = useRef(null);
  const translatedVideoRef = useRef(null);
  

  const formatTime = (s) => {
    if (!s && s !== 0) return '--:--';
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

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
      if (originalVideoUrl) {
        URL.revokeObjectURL(originalVideoUrl);
      }
      if (translatedVideoUrl && translatedVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(translatedVideoUrl);
      }
    };
  }, []);

  // Sync video playback between original and translated videos (simple, no auto-play)
  useEffect(() => {
    const originalVideo = originalVideoRef.current;
    const translatedVideo = translatedVideoRef.current;

    if (!originalVideo || !translatedVideo) return;

    const handleOriginalPause = () => { if (!translatedVideo.paused) translatedVideo.pause(); };
    const handleTranslatedPause = () => { if (!originalVideo.paused) originalVideo.pause(); };

    const handleOriginalSeeking = () => {
      try { if (!isNaN(translatedVideo.duration)) translatedVideo.currentTime = Math.min(originalVideo.currentTime, translatedVideo.duration - 0.01); } catch (e) {}
    };

    const handleTranslatedSeeking = () => {
      try { if (!isNaN(originalVideo.duration)) originalVideo.currentTime = Math.min(translatedVideo.currentTime, originalVideo.duration - 0.01); } catch (e) {}
    };

    originalVideo.addEventListener('pause', handleOriginalPause);
    originalVideo.addEventListener('seeking', handleOriginalSeeking);

    translatedVideo.addEventListener('pause', handleTranslatedPause);
    translatedVideo.addEventListener('seeking', handleTranslatedSeeking);

    // Align starting position when metadata is loaded
    const align = () => {
      try {
        if (!isNaN(originalVideo.duration) && !isNaN(translatedVideo.duration)) {
          const t = Math.min(originalVideo.currentTime || 0, translatedVideo.currentTime || 0);
          if (!isNaN(translatedVideo.duration)) translatedVideo.currentTime = t;
          if (!isNaN(originalVideo.duration)) originalVideo.currentTime = t;
          // record durations for display
          setOriginalDuration(originalVideo.duration);
          setTranslatedDuration(translatedVideo.duration);
        }
      } catch (e) {}
    };

    const onOrigMeta = () => { setOriginalDuration(originalVideo.duration); align(); };
    const onTransMeta = () => { setTranslatedDuration(translatedVideo.duration); align(); };
    originalVideo.addEventListener('loadedmetadata', onOrigMeta);
    translatedVideo.addEventListener('loadedmetadata', onTransMeta);

    return () => {
      originalVideo.removeEventListener('pause', handleOriginalPause);
      originalVideo.removeEventListener('seeking', handleOriginalSeeking);
      originalVideo.removeEventListener('loadedmetadata', onOrigMeta);

      translatedVideo.removeEventListener('pause', handleTranslatedPause);
      translatedVideo.removeEventListener('seeking', handleTranslatedSeeking);
      translatedVideo.removeEventListener('loadedmetadata', onTransMeta);
    };
  }, []);

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
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|mkv|avi)$/i)) {
      setError('Please select a valid video file (MP4, MOV, MKV, AVI)');
      return;
    }

    // Clean up previous URLs
    if (originalVideoUrl) {
      URL.revokeObjectURL(originalVideoUrl);
    }
    if (translatedVideoUrl && translatedVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(translatedVideoUrl);
    }

    setSelectedFile(file);
    setError(null);
    setTranslationResult(null);
    setTranslatedVideoUrl(null);
    setOriginalDuration(null);
    setTranslatedDuration(null);
    
    // Create URL for preview
    const url = URL.createObjectURL(file);
    setOriginalVideoUrl(url);
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
      const result = await translationService.translateVideo(selectedFile, selectedLanguage);
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
      
      // Create URL for the translated video file
      if (result.video_file) {
        const translatedUrl = `http://localhost:8501/download/${result.video_file}`;
        setTranslatedVideoUrl(translatedUrl);
        setTranslatedDuration(null);
      }
      
      setCurrentStep(3); // Move to final step
    } catch (error) {
      setError(error.response?.data?.error || 'Translation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (translationResult && translationResult.video_file) {
      // Download the translated file from Python backend
      const link = document.createElement('a');
      link.href = `http://localhost:8501/download/${translationResult.video_file}`;
      link.download = translationResult.video_file;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const { title, description } = steps[currentStep - 1];

  return (
    <div className="video">
      <section className="video_sect1">
        <div className="container-fluid">
          <div className="sect1_heading text-center">
            <h1>Translate Video</h1>
          </div>
        </div>
      </section>
      <section className="video_sect2">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="vid_sect2_div1">
                <Card>
                  <h2>How to translate video</h2>
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
      <section className="video_sect3">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="vid_sect3_div1">
                <div className="vid_sect3_div2">
                  <h1>Upload File</h1>
                  <div className="file">
                    <div 
                      className={`file_upload ${isDragOver ? 'drag-over' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <img src={video_files} alt="file_type"></img>
                      {isDragOver ? (
                        <p className="drag-text">Drop your video file here!</p>
                      ) : (
                        <p>Click or Drag to Upload Video File</p>
                      )}
                      <p className="file-hint">Supports MP4, MOV, MKV, AVI files</p>
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
                        accept="video/*,.mp4,.mov,.mkv,.avi"
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
      <section className="video_sect4">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="vid_sect4_div1">
                <div className="vid_sect4_div2">
                  <div className="row">
                    <div className="col-lg-6 text-center my-4">
                      <h2>Original Video</h2>
                        {originalVideoUrl ? (
                          <>
                            <video ref={originalVideoRef} controls className="sect4_video">
                              <source src={originalVideoUrl} type="video/mp4" />
                              Your browser does not support the video tag.
                            </video>
                            <div className="media-duration">Duration: {originalDuration ? formatTime(originalDuration) : '--:--'}</div>
                          </>
                        ) : (
                          <div className="no-video">No video file selected</div>
                        )}
                    </div>
                    <div className="col-lg-6 text-center my-4">
                      <h2>Translated Video</h2>
                      {translatedVideoUrl ? (
                        <>
                          <video ref={translatedVideoRef} controls className="sect4_video">
                            <source src={translatedVideoUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                          <div className="media-duration">Duration: {translatedDuration ? formatTime(translatedDuration) : '--:--'}</div>
                        </>
                      ) : (
                        <div className="no-video">Translation not available</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="vid_sect4_lang text-center">
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
                    {isLoading ? 'Translating...' : 'Translate Video'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="video_sect5 text-center">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              {/* Translation Metrics Display */}
              {translationTime && (
                <div className="video_metrics_display">
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
                className="video_download_btn"
                onClick={handleDownload}
                disabled={!translationResult}
              >
                Download Translated Video
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

export default Video;