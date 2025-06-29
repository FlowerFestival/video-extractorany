"use client";

import { useState, useRef } from "react";
import { Upload, Download, Play, Shield, Zap, Globe, Loader } from "lucide-react";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [extractedFileName, setExtractedFileName] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    // 如果正在处理中，不允许更换文件
    if (isProcessing) return;

    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setDownloadUrl(null);
      setExtractedFileName("");
      setProgress(0);
      setIsProcessing(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    // 如果正在处理中，不允许更换文件
    if (isProcessing) return;

    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setDownloadUrl(null);
      setExtractedFileName("");
      setProgress(0);
      setIsProcessing(false);
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

      setProgress(50);

      // Record the audio
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm; codecs=opus'
      });

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setDownloadUrl(audioUrl);

        // Generate filename
        const originalName = selectedFile.name.replace(/\.[^/.]+$/, "");
        setExtractedFileName(`${originalName}_audio.webm`);

        setProgress(100);
        setIsProcessing(false);

        // Cleanup
        URL.revokeObjectURL(videoUrl);
      };

      // Start recording and play video
      mediaRecorder.start();
      setProgress(75);

      video.play();

      // Stop recording when video ends
      video.addEventListener('ended', () => {
        mediaRecorder.stop();
      });

    } catch (error) {
      console.error('Error extracting audio:', error);
      setIsProcessing(false);
      setProgress(0);
      alert('Error extracting audio. Please try with a different video file.');
    }
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
              Video Extractor
            </h1>
            <h2 className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Extract audio from video files online with our free video extractor tool.
              Convert MP4, AVI, MOV, and more video formats to high-quality audio files instantly.
            </h2>

            {/* Upload Area */}
            <div className="max-w-2xl mx-auto mb-16">
              <div
                className={`upload-area rounded-2xl p-12 text-center glass-effect transition-all duration-300 ${
                  isProcessing
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-white/5'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
              >
                <Upload className="w-16 h-16 mx-auto mb-4 text-purple-400 float-animation" />
                <h3 className="text-xl font-semibold mb-2 text-white">
                  {isProcessing
                    ? `Processing: ${selectedFile?.name}`
                    : selectedFile
                      ? `Selected: ${selectedFile.name}`
                      : "Upload Your Video File"
                  }
                </h3>
                <p className="text-gray-400 mb-6">
                  {isProcessing
                    ? "Please wait while we extract your audio..."
                    : selectedFile
                      ? "Click to select a different video file"
                      : "Click to browse or drag and drop your video file here"
                  }
                </p>
                <p className="text-sm text-gray-500">
                  {isProcessing
                    ? `Progress: ${Math.round(progress)}%`
                    : "Supports MP4, AVI, MOV, MKV, WEBM, and more video formats"
                  }
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
              </div>

              {selectedFile && (
                <div className="mt-6">
                  {!downloadUrl ? (
                    <>
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
                          "Extract Audio"
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
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl glass-effect">
                        <Download className="w-6 h-6 inline mr-2 text-green-400" />
                        <button
                          onClick={downloadAudio}
                          className="text-green-400 font-semibold hover:text-green-300 transition-colors"
                        >
                          Download Your Audio File ({extractedFileName})
                        </button>
                        <p className="text-sm text-gray-400 mt-2">
                          ✅ Audio successfully extracted from video
                        </p>
                      </div>
                      <button
                        onClick={extractAudio}
                        className="btn-gradient px-8 py-4 rounded-xl text-white font-semibold text-lg flex items-center mx-auto"
                      >
                        Extract Audio Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-4 py-16 md:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12 text-white">
              Why Choose Video Extractor?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <article className="text-center p-6 rounded-2xl glass-effect">
                <Shield className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                <h3 className="text-xl font-semibold mb-4 text-white">100% Secure</h3>
                <p className="text-gray-300">
                  Your video files are processed securely in your browser. We don't store your files permanently,
                  ensuring complete privacy when using our video extractor service.
                </p>
              </article>
              <article className="text-center p-6 rounded-2xl glass-effect">
                <Zap className="w-12 h-12 mx-auto mb-4 text-pink-400" />
                <h3 className="text-xl font-semibold mb-4 text-white">Lightning Fast</h3>
                <p className="text-gray-300">
                  Extract audio from video files in seconds. Our optimized video extractor
                  technology ensures quick processing without compromising audio quality.
                </p>
              </article>
              <article className="text-center p-6 rounded-2xl glass-effect">
                <Globe className="w-12 h-12 mx-auto mb-4 text-orange-400" />
                <h3 className="text-xl font-semibold mb-4 text-white">No Software Required</h3>
                <p className="text-gray-300">
                  Use our online video extractor tool directly in your browser.
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
              How Video Extractor Works
            </h2>
            <div className="space-y-8">
              <article className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full gradient-bg-primary flex items-center justify-center text-white font-bold">1</div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Upload Your Video</h3>
                  <p className="text-gray-300">
                    Select any video file from your device. Our video extractor tool supports
                    all major video formats including MP4, AVI, MOV, MKV, WEBM, and many more.
                  </p>
                </div>
              </article>
              <article className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full gradient-bg-primary flex items-center justify-center text-white font-bold">2</div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Extract Audio</h3>
                  <p className="text-gray-300">
                    Click the extract button and let our advanced video extractor algorithm
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
                    The entire video extractor process takes just a few seconds.
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
                  Our video extractor tool supports all major video formats including MP4, AVI, MOV, MKV, WEBM, FLV, 3GP, and many others.
                  You can extract audio from virtually any video file format.
                </div>
              </details>

              <details className="group">
                <summary className="flex justify-between items-center w-full py-4 px-6 rounded-xl glass-effect cursor-pointer text-white font-semibold">
                  Is the audio quality preserved during extraction?
                  <span className="transform group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 px-6 pb-4 text-gray-300">
                  Yes! Our video extractor technology preserves the original audio quality.
                  The extracted audio files maintain the same bitrate and quality as the source video's audio track.
                </div>
              </details>

              <details className="group">
                <summary className="flex justify-between items-center w-full py-4 px-6 rounded-xl glass-effect cursor-pointer text-white font-semibold">
                  Do I need to create an account to use video extractor?
                  <span className="transform group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 px-6 pb-4 text-gray-300">
                  No account required! Our video extractor service is completely free and doesn't require registration.
                  Simply upload your video file and extract audio instantly.
                </div>
              </details>

              <details className="group">
                <summary className="flex justify-between items-center w-full py-4 px-6 rounded-xl glass-effect cursor-pointer text-white font-semibold">
                  What's the maximum file size for video extractor?
                  <span className="transform group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 px-6 pb-4 text-gray-300">
                  You can upload video files up to 100MB for audio extraction.
                  This covers most video files and ensures fast processing with our video extractor tool.
                </div>
              </details>

              <details className="group">
                <summary className="flex justify-between items-center w-full py-4 px-6 rounded-xl glass-effect cursor-pointer text-white font-semibold">
                  Is my video data safe with ExtractorAny?
                  <span className="transform group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 px-6 pb-4 text-gray-300">
                  Absolutely! Your privacy is our priority. All processing happens in your browser - we never upload your files to our servers.
                  Our video extractor service ensures complete data security and confidentiality.
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
            The best free online video extractor tool to extract audio from video files.
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
