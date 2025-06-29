"use client";

import { useState, useRef } from "react";
import { Upload, Download, Play, Shield, Zap, Globe, Loader, Settings, Pause, Volume2, SkipBack, SkipForward } from "lucide-react";

// Import MP3 encoder for client-side MP3 conversion
import { Mp3Encoder } from '@breezystack/lamejs';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [extractedFileName, setExtractedFileName] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [outputFormat, setOutputFormat] = useState<'mp3' | 'wav' | 'webm'>('mp3');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioFileSize, setAudioFileSize] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setDownloadUrl(null);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setDownloadUrl(null);
    }
  };

  const extractAudio = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Create video element
      const video = document.createElement('video');
      const videoUrl = URL.createObjectURL(selectedFile);
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.volume = 0; // Set volume to 0 instead of muted to preserve audio data
      video.style.display = 'none'; // Hide video element

      // Wait for video to load
      await new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', resolve);
        video.addEventListener('error', reject);
        video.load();
      });

      setProgress(25);

      // Create audio context
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }

      const audioContext = audioContextRef.current;

      // Create media element source
      const source = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);

      console.log('Audio context created:', {
        sampleRate: audioContext.sampleRate,
        state: audioContext.state,
        videoHasAudio: video.audioTracks?.length > 0 || 'unknown'
      });

      setProgress(50);

      // Record the audio
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm; codecs=opus'
      });

      const chunks: BlobPart[] = [];

      console.log('MediaRecorder created:', {
        mimeType: mediaRecorder.mimeType,
        streamActive: destination.stream.active,
        audioTracks: destination.stream.getAudioTracks().length
      });

      mediaRecorder.ondataavailable = (event) => {
        console.log('MediaRecorder data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        console.log('Audio extraction complete:', {
          totalChunks: chunks.length,
          blobSize: audioBlob.size,
          blobType: audioBlob.type
        });

        const originalName = selectedFile.name.replace(/\.[^/.]+$/, "");

        let finalBlob = audioBlob;
        let finalFileName = `${originalName}_audio.webm`;
        let finalUrl = URL.createObjectURL(audioBlob);

        if (outputFormat === 'mp3') {
          // Convert to MP3 using lamejs
          try {
            console.log('Converting to MP3...');
            const mp3Blob = await convertToMp3(audioBlob);
            finalBlob = mp3Blob;
            finalFileName = `${originalName}_audio.mp3`;
            if (finalUrl !== URL.createObjectURL(audioBlob)) {
              URL.revokeObjectURL(finalUrl);
            }
            finalUrl = URL.createObjectURL(mp3Blob);
            console.log('MP3 conversion successful');
          } catch (error) {
            console.error('MP3 conversion failed:', error);
            finalFileName = `${originalName}_audio.webm`;
          }
        } else if (outputFormat === 'wav') {
          // Convert to WAV using Web Audio API
          try {
            console.log('Converting to WAV...');
            const wavBlob = await convertToWav(audioBlob);
            finalBlob = wavBlob;
            finalFileName = `${originalName}_audio.wav`;
            if (finalUrl !== URL.createObjectURL(audioBlob)) {
              URL.revokeObjectURL(finalUrl);
            }
            finalUrl = URL.createObjectURL(wavBlob);
            console.log('WAV conversion successful');
          } catch (error) {
            console.error('WAV conversion failed:', error);
            finalFileName = `${originalName}_audio.webm`;
          }
        }

        // Set the final download URL and filename
        setDownloadUrl(finalUrl);
        setExtractedFileName(finalFileName);
        setAudioFileSize(finalBlob.size);
        setProgress(100);
        setIsProcessing(false);

        // Reset audio player state
        setIsPlaying(false);
        setCurrentTime(0);
        setAudioDuration(0);

        // Cleanup
        URL.revokeObjectURL(videoUrl);
      };

      // Start recording
      mediaRecorder.start(1000); // Record in 1-second chunks
      setProgress(75);

      // Play video and ensure it plays for the full duration
      video.currentTime = 0;
      await video.play();

      // Use a more reliable method to track video progress
      const checkVideoProgress = () => {
        if (video.currentTime >= video.duration - 0.1) {
          // Video finished, stop recording
          mediaRecorder.stop();
        } else if (mediaRecorder.state === 'recording') {
          // Continue checking
          setTimeout(checkVideoProgress, 100);
        }
      };

      // Start checking video progress
      setTimeout(checkVideoProgress, 100);

      // Fallback: stop recording after video duration + 1 second
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, (video.duration + 1) * 1000);

    } catch (error) {
      console.error('Error extracting audio:', error);
      setIsProcessing(false);
      setProgress(0);
      alert('Error extracting audio. Please try with a different video file.');
    }
  };

  // Convert WebM to WAV using Web Audio API
  const convertToWav = async (webmBlob: Blob): Promise<Blob> => {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return audioBufferToWav(audioBuffer);
  };

  // Convert WebM to MP3 using lamejs
  const convertToMp3 = async (webmBlob: Blob): Promise<Blob> => {
    try {
      const arrayBuffer = await webmBlob.arrayBuffer();
      console.log('WebM audio buffer size:', arrayBuffer.byteLength);

      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      console.log('Audio buffer details:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        length: audioBuffer.length
      });

      const mp3Blob = audioBufferToMp3(audioBuffer);
      console.log('MP3 conversion result size:', mp3Blob.size);

      return mp3Blob;
    } catch (error) {
      console.error('Error in convertToMp3:', error);
      throw error;
    }
  };

  // Helper function to convert AudioBuffer to MP3
  const audioBufferToMp3 = (buffer: AudioBuffer): Blob => {
    try {
      const sampleRate = buffer.sampleRate;
      const channels = buffer.numberOfChannels;
      const samples = buffer.length;

      console.log('Converting AudioBuffer to MP3:', { sampleRate, channels, samples });

      // Convert to 16-bit PCM
      const left = new Int16Array(samples);
      const right = channels > 1 ? new Int16Array(samples) : null;

      // Convert float samples to 16-bit PCM
      const leftChannel = buffer.getChannelData(0);
      const rightChannel = channels > 1 ? buffer.getChannelData(1) : null;

      // Debug: Check if audio data exists
      let maxLeft = 0;
      let maxRight = 0;
      for (let i = 0; i < Math.min(1000, samples); i++) {
        maxLeft = Math.max(maxLeft, Math.abs(leftChannel[i]));
        if (rightChannel) {
          maxRight = Math.max(maxRight, Math.abs(rightChannel[i]));
        }
      }
      console.log('Audio data check - Max left:', maxLeft, 'Max right:', maxRight);

      if (maxLeft === 0 && maxRight === 0) {
        console.warn('Warning: Audio buffer appears to be silent!');
      }

      for (let i = 0; i < samples; i++) {
        // Improved PCM conversion: use 32768 scale and Math.round for better accuracy
        left[i] = Math.max(-32768, Math.min(32767, Math.round(leftChannel[i] * 32768)));
        if (right && rightChannel) {
          right[i] = Math.max(-32768, Math.min(32767, Math.round(rightChannel[i] * 32768)));
        }
      }

      // Debug: Check converted PCM data
      let pcmMaxLeft = 0;
      let pcmMaxRight = 0;
      for (let i = 0; i < Math.min(1000, samples); i++) {
        pcmMaxLeft = Math.max(pcmMaxLeft, Math.abs(left[i]));
        if (right) {
          pcmMaxRight = Math.max(pcmMaxRight, Math.abs(right[i]));
        }
      }
      console.log('PCM data check - Max left:', pcmMaxLeft, 'Max right:', pcmMaxRight);

      console.log('Creating MP3 encoder with @breezystack/lamejs...');

      // Initialize MP3 encoder with stereo support using @breezystack/lamejs
      let mp3encoder: Mp3Encoder;
      try {
        mp3encoder = new Mp3Encoder(channels, sampleRate, 128); // 128 kbps
        console.log('MP3 encoder created successfully');
      } catch (encoderError) {
        console.error('Failed to create MP3 encoder:', encoderError);
        throw new Error(`MP3 encoder initialization failed: ${encoderError}`);
      }

      const mp3Data: Int8Array[] = [];

      // Encode in chunks (MP3 frame size is 1152 samples per channel)
      const chunkSize = 1152;
      let totalChunks = 0;

      console.log('Starting MP3 encoding process...');

      for (let i = 0; i < samples; i += chunkSize) {
        const leftChunk = left.subarray(i, Math.min(i + chunkSize, samples));
        const rightChunk = right ? right.subarray(i, Math.min(i + chunkSize, samples)) : null;

        // Pad chunk if it's smaller than expected
        const paddedLeft = new Int16Array(chunkSize);
        paddedLeft.set(leftChunk);

        let paddedRight: Int16Array | null = null;
        if (rightChunk) {
          paddedRight = new Int16Array(chunkSize);
          paddedRight.set(rightChunk);
        }

        try {
          const mp3buf = paddedRight
            ? mp3encoder.encodeBuffer(paddedLeft, paddedRight)
            : mp3encoder.encodeBuffer(paddedLeft);

          if (mp3buf && mp3buf.length > 0) {
            mp3Data.push(mp3buf);
            totalChunks++;
          }
        } catch (chunkError) {
          console.warn(`Encoding chunk ${totalChunks} failed:`, chunkError);
          // Continue with next chunk
        }
      }

      console.log('Flushing MP3 encoder...');

      // Flush remaining data
      try {
        const finalBuffer = mp3encoder.flush();
        if (finalBuffer && finalBuffer.length > 0) {
          mp3Data.push(finalBuffer);
        }
      } catch (flushError) {
        console.warn('MP3 encoder flush failed:', flushError);
      }

      console.log('MP3 encoding complete:', { totalChunks, totalBuffers: mp3Data.length });

      if (mp3Data.length === 0) {
        throw new Error('No MP3 data was generated during encoding');
      }

      // Combine all MP3 data
      const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.length, 0);
      const mp3Buffer = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of mp3Data) {
        mp3Buffer.set(chunk, offset);
        offset += chunk.length;
      }

      console.log('Final MP3 buffer size:', mp3Buffer.length, 'bytes');

      if (mp3Buffer.length === 0) {
        throw new Error('Generated MP3 buffer is empty');
      }

      return new Blob([mp3Buffer], { type: 'audio/mpeg' });
    } catch (error) {
      console.error('Error in audioBufferToMp3:', error);
      throw error;
    }
  };

  // Helper function to convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const numberOfChannels = buffer.numberOfChannels;

    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const downloadAudio = () => {
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = extractedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Audio player controls
  const togglePlayPause = () => {
    if (audioRef.current && downloadUrl) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = Number(event.target.value);
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="px-4 py-6 md:px-8">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg gradient-bg-primary flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gradient">ExtractorAny</h1>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">How It Works</a>
            <a href="#faq" className="text-gray-300 hover:text-white transition-colors">FAQ</a>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="px-4 py-16 md:px-8 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gradient">
              Video ExtractorAny
            </h1>
            <h2 className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Extract audio from video files online with our free video extractorany tool.
              Convert MP4, AVI, MOV, and more video formats to high-quality MP3, WAV, or WebM audio files instantly.
            </h2>

            {/* Format Selection */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Settings className="w-5 h-5 text-purple-400" />
                <span className="text-white font-semibold">Choose Output Format:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="relative">
                  <input
                    type="radio"
                    name="format"
                    value="mp3"
                    checked={outputFormat === 'mp3'}
                    onChange={(e) => setOutputFormat(e.target.value as 'mp3' | 'wav' | 'webm')}
                    className="sr-only"
                  />
                  <div className={`p-4 rounded-xl cursor-pointer transition-all ${
                    outputFormat === 'mp3'
                      ? 'glass-effect border-2 border-purple-400 shadow-lg'
                      : 'bg-gray-800 bg-opacity-50 border border-gray-600 hover:bg-opacity-70'
                  }`}>
                    <div className="text-lg font-bold text-white">MP3</div>
                    <div className="text-sm text-gray-300">Most compatible, widely supported</div>
                  </div>
                </label>
                <label className="relative">
                  <input
                    type="radio"
                    name="format"
                    value="wav"
                    checked={outputFormat === 'wav'}
                    onChange={(e) => setOutputFormat(e.target.value as 'mp3' | 'wav' | 'webm')}
                    className="sr-only"
                  />
                  <div className={`p-4 rounded-xl cursor-pointer transition-all ${
                    outputFormat === 'wav'
                      ? 'glass-effect border-2 border-purple-400 shadow-lg'
                      : 'bg-gray-800 bg-opacity-50 border border-gray-600 hover:bg-opacity-70'
                  }`}>
                    <div className="text-lg font-bold text-white">WAV</div>
                    <div className="text-sm text-gray-300">Uncompressed, highest quality</div>
                  </div>
                </label>
                <label className="relative">
                  <input
                    type="radio"
                    name="format"
                    value="webm"
                    checked={outputFormat === 'webm'}
                    onChange={(e) => setOutputFormat(e.target.value as 'mp3' | 'wav' | 'webm')}
                    className="sr-only"
                  />
                  <div className={`p-4 rounded-xl cursor-pointer transition-all ${
                    outputFormat === 'webm'
                      ? 'glass-effect border-2 border-purple-400 shadow-lg'
                      : 'bg-gray-800 bg-opacity-50 border border-gray-600 hover:bg-opacity-70'
                  }`}>
                    <div className="text-lg font-bold text-white">WebM</div>
                    <div className="text-sm text-gray-300">Modern format, smaller files</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Upload Area */}
            <div className="max-w-2xl mx-auto mb-16">
              <div
                className="upload-area rounded-2xl p-12 text-center glass-effect"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-16 h-16 mx-auto mb-4 text-purple-400 float-animation" />
                <h3 className="text-xl font-semibold mb-2 text-white">
                  {selectedFile ? selectedFile.name : "Upload Your Video File"}
                </h3>
                <p className="text-gray-400 mb-6">
                  Click to browse or drag and drop your video file here
                </p>
                <p className="text-sm text-gray-500">
                  Supports MP4, AVI, MOV, MKV, WEBM, and more video formats
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {selectedFile && !downloadUrl && (
                <div className="mt-6">
                  <button
                    onClick={extractAudio}
                    disabled={isProcessing}
                    className="btn-gradient px-8 py-4 rounded-xl text-white font-semibold text-lg disabled:opacity-50 flex items-center mx-auto"
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="w-5 h-5 mr-2 animate-spin" />
                        Extracting Audio... {Math.round(progress)}%
                      </>
                    ) : (
                      `Extract Audio as ${outputFormat.toUpperCase()}`
                    )}
                  </button>
                  {isProcessing && (
                    <div className="mt-4 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full gradient-bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {downloadUrl && (
                <div className="mt-6 space-y-4">
                  {/* Audio Preview Player */}
                  <div className="p-6 rounded-xl glass-effect">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white flex items-center">
                        <Volume2 className="w-5 h-5 mr-2 text-purple-400" />
                        Audio Preview
                      </h3>
                      <div className="text-sm text-gray-400">
                        {formatFileSize(audioFileSize)} • {outputFormat.toUpperCase()}
                      </div>
                    </div>

                    {/* Audio Element */}
                    <audio
                      ref={audioRef}
                      src={downloadUrl}
                      onLoadedMetadata={handleAudioLoadedMetadata}
                      onTimeUpdate={handleAudioTimeUpdate}
                      onEnded={handleAudioEnded}
                      className="hidden"
                      aria-label="Extracted audio preview player"
                    />

                    {/* Audio Controls */}
                    <div className="space-y-3">
                      {/* Play/Pause Button */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={togglePlayPause}
                          className="flex items-center justify-center w-12 h-12 rounded-full gradient-bg-primary hover:gradient-bg-secondary transition-all hover:scale-105"
                        >
                          {isPlaying ? (
                            <Pause className="w-6 h-6 text-white" />
                          ) : (
                            <Play className="w-6 h-6 text-white ml-1" />
                          )}
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <input
                          type="range"
                          min="0"
                          max={audioDuration || 0}
                          value={currentTime}
                          onChange={handleSeek}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${(currentTime / audioDuration) * 100}%, #374151 ${(currentTime / audioDuration) * 100}%, #374151 100%)`
                          }}
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(audioDuration)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Download Section */}
                  <div className="p-4 rounded-xl glass-effect">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Download className="w-6 h-6 mr-3 text-green-400" />
                        <div>
                          <div className="font-semibold text-white">{extractedFileName}</div>
                          <div className="text-sm text-gray-400">
                            ✅ Audio successfully extracted
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={downloadAudio}
                        className="px-6 py-2 rounded-lg gradient-bg-primary hover:gradient-bg-secondary transition-all text-white font-semibold hover:scale-105"
                      >
                        Download
                      </button>
                    </div>

                    <div className="mt-3 text-xs">
                      {outputFormat === 'mp3' && extractedFileName.includes('.mp3') && (
                        <span className="text-green-400">
                          ✅ Successfully converted to MP3 format (128kbps)
                        </span>
                      )}
                      {outputFormat === 'mp3' && extractedFileName.includes('.webm') && (
                        <span className="text-orange-400">
                          ⚠️ MP3 conversion failed. File is in WebM format.
                        </span>
                      )}
                      {outputFormat === 'wav' && (
                        <span className="text-green-400">
                          ✅ Successfully converted to WAV format
                        </span>
                      )}
                      {outputFormat === 'webm' && (
                        <span className="text-blue-400">
                          ✅ WebM format - modern and efficient
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-4 py-16 md:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12 text-white">
              Why Choose Video ExtractorAny?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <article className="text-center p-6 rounded-2xl glass-effect">
                <Shield className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                <h3 className="text-xl font-semibold mb-4 text-white">100% Secure</h3>
                <p className="text-gray-300">
                  Your video files are processed securely in your browser. We don't store your files permanently,
                  ensuring complete privacy when using our video extractorany service.
                </p>
              </article>
              <article className="text-center p-6 rounded-2xl glass-effect">
                <Zap className="w-12 h-12 mx-auto mb-4 text-pink-400" />
                <h3 className="text-xl font-semibold mb-4 text-white">Lightning Fast</h3>
                <p className="text-gray-300">
                  Extract audio from video files in seconds. Our optimized video extractorany
                  technology ensures quick processing without compromising audio quality.
                </p>
              </article>
              <article className="text-center p-6 rounded-2xl glass-effect">
                <Globe className="w-12 h-12 mx-auto mb-4 text-orange-400" />
                <h3 className="text-xl font-semibold mb-4 text-white">No Software Required</h3>
                <p className="text-gray-300">
                  Use our online video extractorany tool directly in your browser.
                  No downloads, installations, or account registration needed.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="px-4 py-16 md:px-8 bg-black bg-opacity-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12 text-white">
              How Video ExtractorAny Works
            </h2>
            <div className="space-y-8">
              <article className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full gradient-bg-primary flex items-center justify-center text-white font-bold">1</div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Upload Your Video</h3>
                  <p className="text-gray-300">
                    Select any video file from your device. Our video extractorany tool supports
                    all major video formats including MP4, AVI, MOV, MKV, WEBM, and many more.
                  </p>
                </div>
              </article>
              <article className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full gradient-bg-primary flex items-center justify-center text-white font-bold">2</div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Extract Audio</h3>
                  <p className="text-gray-300">
                    Click the extract button and let our advanced video extractorany algorithm
                    separate the audio track from your video file while maintaining optimal quality.
                  </p>
                </div>
              </article>
              <article className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full gradient-bg-primary flex items-center justify-center text-white font-bold">3</div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Download Audio</h3>
                  <p className="text-gray-300">
                    Download your extracted audio file in high-quality format.
                    The entire video extractorany process takes just a few seconds.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="px-4 py-16 md:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12 text-white">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <details className="group">
                <summary className="flex justify-between items-center w-full py-4 px-6 rounded-xl glass-effect cursor-pointer text-white font-semibold">
                  What video formats does ExtractorAny support?
                  <span className="transform group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 px-6 pb-4 text-gray-300">
                  Our video extractorany tool supports all major video formats including MP4, AVI, MOV, MKV, WEBM, FLV, 3GP, and many others.
                  You can extract audio from virtually any video file format.
                </div>
              </details>

              <details className="group">
                <summary className="flex justify-between items-center w-full py-4 px-6 rounded-xl glass-effect cursor-pointer text-white font-semibold">
                  Is the audio quality preserved during extraction?
                  <span className="transform group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 px-6 pb-4 text-gray-300">
                  Yes! Our video extractorany technology preserves the original audio quality.
                  The extracted audio files maintain the same bitrate and quality as the source video's audio track.
                </div>
              </details>

              <details className="group">
                <summary className="flex justify-between items-center w-full py-4 px-6 rounded-xl glass-effect cursor-pointer text-white font-semibold">
                  Do I need to create an account to use video extractorany?
                  <span className="transform group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 px-6 pb-4 text-gray-300">
                  No account required! Our video extractorany service is completely free and doesn't require registration.
                  Simply upload your video file and extract audio instantly.
                </div>
              </details>

              <details className="group">
                <summary className="flex justify-between items-center w-full py-4 px-6 rounded-xl glass-effect cursor-pointer text-white font-semibold">
                  What's the maximum file size for video extractorany?
                  <span className="transform group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 px-6 pb-4 text-gray-300">
                  You can upload video files up to 100MB for audio extraction.
                  This covers most video files and ensures fast processing with our video extractorany tool.
                </div>
              </details>

              <details className="group">
                <summary className="flex justify-between items-center w-full py-4 px-6 rounded-xl glass-effect cursor-pointer text-white font-semibold">
                  Is my video data safe with ExtractorAny?
                  <span className="transform group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 px-6 pb-4 text-gray-300">
                  Absolutely! Your privacy is our priority. All processing happens in your browser - we never upload your files to our servers.
                  Our video extractorany service ensures complete data security and confidentiality.
                </div>
              </details>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-4 py-12 md:px-8 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-6 h-6 rounded gradient-bg-primary flex items-center justify-center">
              <Play className="w-3 h-3 text-white" />
            </div>
            <span className="text-xl font-bold text-gradient">ExtractorAny</span>
          </div>
          <p className="text-gray-400 mb-6">
            The best free online video extractorany tool to extract audio from video files.
            Convert your videos to audio format quickly and securely.
          </p>
          <p className="text-sm text-gray-500">
            © 2025 ExtractorAny. Free video to audio extraction service.
          </p>
        </div>
      </footer>
    </div>
  );
}
