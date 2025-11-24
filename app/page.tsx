"use client";

import { useState, useEffect } from "react";

interface Video {
  id: string;
  title: string;
  link: string;
  published: Date;
  description: string;
}

interface Transcript { 
  videoId: string;
  transcript: string;
  entries: Array<{ text: string; start: number; duration: number }>;
}

interface Quotes {
  quotes: string[];
}

interface QuoteSettings {
  model: "gpt-5-nano" | "gpt-5-mini" | "gpt-5.1";
  numQuotes: number;
  pickiness: number; // 1-10 scale: 1 = include regular quotes, 10 = only exceptional quotes
}

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualVideoUrl, setManualVideoUrl] = useState("");
  const [loadingManualVideo, setLoadingManualVideo] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [quotes, setQuotes] = useState<string[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<
    "transcript" | "quotes" | null
  >(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [processedVideos, setProcessedVideos] = useState<Set<string>>(
    new Set()
  );
  const [apiLogs, setApiLogs] = useState<{
    request?: any;
    response?: any;
    error?: string;
  } | null>(null);
  const [settings, setSettings] = useState<QuoteSettings>({
    model: "gpt-5-nano",
    numQuotes: 8,
    pickiness: 5, // Default: balanced
  });

  useEffect(() => {
    fetchVideos();
    // Load processed videos from localStorage
    const stored = localStorage.getItem("processedVideos");
    if (stored) {
      setProcessedVideos(new Set(JSON.parse(stored)));
    }
    // Load settings from localStorage
    const storedSettings = localStorage.getItem("quoteSettings");
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        // Ensure all required fields are present with defaults
        setSettings({
          model: parsed.model || "gpt-5-nano",
          numQuotes: parsed.numQuotes || 8,
          pickiness: parsed.pickiness ?? 5, // Use nullish coalescing to handle undefined/null
        });
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    }
  }, []);

  useEffect(() => {
    // Save processed videos to localStorage
    if (processedVideos.size > 0) {
      localStorage.setItem(
        "processedVideos",
        JSON.stringify(Array.from(processedVideos))
      );
    }
  }, [processedVideos]);

  useEffect(() => {
    // Save settings to localStorage
    localStorage.setItem("quoteSettings", JSON.stringify(settings));
  }, [settings]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/videos");
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setVideos(data.videos || []);
      }
    } catch (err) {
      setError("Failed to fetch videos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^&\s]+)/,
      /youtube\.com\/v\/([^&\s]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const handleManualVideo = async () => {
    if (!manualVideoUrl.trim()) {
      setError("Please enter a YouTube video URL");
      return;
    }

    const videoId = extractVideoId(manualVideoUrl.trim());
    if (!videoId) {
      setError("Invalid YouTube URL. Please enter a valid YouTube video link.");
      return;
    }

    setLoadingManualVideo(true);
    setError(null);

    try {
      // Check if video already exists in list
      const existingVideo = videos.find((v) => v.id === videoId);
      if (existingVideo) {
        // Video already in list, just select it
        fetchTranscript(existingVideo);
        setManualVideoUrl("");
        setLoadingManualVideo(false);
        return;
      }

      // Create a video object from the URL
      // We'll fetch basic info, but for now just create a minimal object
      const newVideo: Video = {
        id: videoId,
        title: `Video ${videoId}`, // Will be updated when transcript loads
        link: `https://www.youtube.com/watch?v=${videoId}`,
        published: new Date(),
        description: "",
      };

      // Add to videos list
      setVideos((prev) => [newVideo, ...prev]);

      // Automatically fetch transcript
      await fetchTranscript(newVideo);
      setManualVideoUrl("");
    } catch (err) {
      setError("Failed to process video URL");
      console.error(err);
    } finally {
      setLoadingManualVideo(false);
    }
  };

  const fetchTranscript = async (video: Video) => {
    setSelectedVideo(video);
    setLoadingTranscript(true);
    setTranscript(null);
    setQuotes([]);
    setError(null);

    try {
      const response = await fetch(`/api/transcript?videoId=${video.id}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setTranscript(data);
        // Mark video as processed
        setProcessedVideos((prev) => new Set([...prev, video.id]));
        // Automatically extract quotes after transcript loads
        if (data.transcript) {
          extractQuotes(data.transcript);
        }
      }
    } catch (err) {
      setError("Failed to fetch transcript");
      console.error(err);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const extractQuotes = async (transcriptText: string) => {
    setLoadingQuotes(true);
    setQuotes([]);
    setApiLogs(null);

    try {
      const requestBody = {
        transcript: transcriptText,
        settings: settings,
      };

      // Log request
      const requestLog = {
        model: settings.model,
        numQuotes: settings.numQuotes,
        pickiness: settings.pickiness,
        transcriptLength: transcriptText.length,
        transcriptPreview: transcriptText.substring(0, 200) + "...",
      };

      setApiLogs({ request: requestLog });

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.error) {
        console.error("Error extracting quotes:", data.error);
        setApiLogs((prev) => ({
          ...prev,
          error: data.error || "Unknown error",
        }));
      } else {
        setQuotes(data.quotes || []);
        // Log response
        setApiLogs((prev) => ({
          ...prev,
          response: {
            quotesCount: data.quotes?.length || 0,
            quotes: data.quotes,
            usage: data.usage,
            model: data.model,
            duration: data.duration,
          },
        }));
      }
    } catch (err: any) {
      console.error("Failed to extract quotes:", err);
      setApiLogs((prev) => ({
        ...prev,
        error: err.message || "Failed to extract quotes",
      }));
    } finally {
      setLoadingQuotes(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const copyToClipboard = async (
    text: string,
    type: "transcript" | "quotes"
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const copyTranscript = () => {
    if (transcript) {
      copyToClipboard(transcript.transcript, "transcript");
    }
  };

  const copyQuotes = () => {
    if (quotes.length > 0) {
      const quotesText = quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n\n");
      copyToClipboard(quotesText, "quotes");
    }
  };

  const exportToFile = async (exportQuotesOnly = false) => {
    if (!transcript || !selectedVideo) return;

    setExportSuccess(false);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId: transcript.videoId,
          title: selectedVideo.title,
          transcript: exportQuotesOnly ? "" : transcript.transcript,
          quotes: quotes,
          published: formatDate(selectedVideo.published),
          quotesOnly: exportQuotesOnly,
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error("Error exporting:", data.error);
        alert(`Failed to export: ${data.error}`);
      } else {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to export:", err);
      alert("Failed to export file");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-8 relative">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Hoskinson Harvester™
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Automated pipeline for Charles Hoskinson videos and transcripts
              </p>
            </div>
          </div>
        </header>

        {/* Settings Controls - Always Visible */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Model:
              </span>
              <button
                onClick={() =>
                  setSettings({ ...settings, model: "gpt-5-nano" })
                }
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.model === "gpt-5-nano"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                GPT-5 Nano
              </button>
              <button
                onClick={() =>
                  setSettings({ ...settings, model: "gpt-5-mini" })
                }
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.model === "gpt-5-mini"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                GPT-5 Mini
              </button>
              <button
                onClick={() => setSettings({ ...settings, model: "gpt-5.1" })}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  settings.model === "gpt-5.1"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                GPT-5.1
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Quotes: {settings.numQuotes}
              </span>
              <input
                type="range"
                min="3"
                max="15"
                value={settings.numQuotes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    numQuotes: parseInt(e.target.value),
                  })
                }
                className="w-24"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Pickiness: {settings.pickiness}/10
              </span>
              <input
                type="range"
                min="1"
                max="10"
                value={settings.pickiness ?? 5}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    pickiness: parseInt(e.target.value),
                  })
                }
                className="w-32"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {(settings.pickiness ?? 5) <= 3
                  ? "More quotes"
                  : (settings.pickiness ?? 5) <= 7
                  ? "Balanced"
                  : "Only exceptional"}
              </span>
            </div>

            {transcript && (
              <button
                onClick={() => {
                  if (transcript) {
                    extractQuotes(transcript.transcript);
                  }
                }}
                disabled={loadingQuotes}
                className="ml-auto px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingQuotes ? "Extracting..." : "Re-extract Quotes"}
              </button>
            )}

            {/* API Logs Dropdown */}
            {apiLogs && (
              <details className="ml-auto cursor-pointer">
                <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  OpenAI API Logs
                </summary>
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                  {apiLogs.request && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                        Request:
                      </h4>
                      <pre className="text-xs bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
                        {JSON.stringify(apiLogs.request, null, 2)}
                      </pre>
                    </div>
                  )}
                  {apiLogs.response && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                        Response:
                      </h4>
                      <pre className="text-xs bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(apiLogs.response, null, 2)}
                      </pre>
                    </div>
                  )}
                  {apiLogs.error && (
                    <div>
                      <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                        Error:
                      </h4>
                      <pre className="text-xs bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800 overflow-x-auto">
                        {apiLogs.error}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Videos List */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Videos
                </h2>
                <a
                  href="https://www.youtube.com/@charleshoskinsoncrypto"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  title="View Charles Hoskinson's YouTube Channel"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  Channel
                </a>
              </div>
              <button
                onClick={fetchVideos}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {/* Manual Video URL Input */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add Video Manually
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualVideoUrl}
                  onChange={(e) => setManualVideoUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loadingManualVideo) {
                      handleManualVideo();
                    }
                  }}
                  placeholder="Paste YouTube video URL..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleManualVideo}
                  disabled={loadingManualVideo || !manualVideoUrl.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingManualVideo ? "Loading..." : "Add"}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Paste any YouTube video URL to process it
              </p>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                Loading videos...
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                No videos found
              </div>
            ) : (
              <div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {videos.map((video) => (
                    <div
                      key={video.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all relative ${
                        selectedVideo?.id === video.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                      onClick={() => fetchTranscript(video)}
                    >
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {video.title}
                      </h3>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(video.published)}
                        </p>
                        {processedVideos.has(video.id) && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                            Processed
                          </span>
                        )}
                      </div>
                      <a
                        href={video.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                      >
                        Watch on YouTube →
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Transcript Display */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Transcript
              </h2>
              {transcript && (
                <div className="flex gap-2">
                  <button
                    onClick={copyTranscript}
                    className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-1"
                    title="Copy transcript"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    {copySuccess === "transcript" ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      exportToFile(false);
                    }}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1"
                    title="Export to markdown file"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {exportSuccess ? "Exported!" : "Export"}
                  </button>
                </div>
              )}
            </div>

            {loadingTranscript ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                Loading transcript...
              </div>
            ) : transcript ? (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-h-[600px] overflow-y-auto">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {selectedVideo?.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Video ID: {transcript.videoId}
                  </p>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {transcript.transcript}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {transcript.entries.length} transcript entries
                  </p>
                </div>
              </div>
            ) : selectedVideo ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                Click on a video to load its transcript
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                Select a video to view its transcript
              </div>
            )}
          </div>

          {/* Quotes Display */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Powerful Quotes
              </h2>
              {quotes.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={copyQuotes}
                    className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-1"
                    title="Copy quotes"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    {copySuccess === "quotes" ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      exportToFile(true);
                    }}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1"
                    title="Export quotes to markdown file"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {exportSuccess ? "Exported!" : "Export"}
                  </button>
                </div>
              )}
            </div>

            {loadingQuotes ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                Extracting quotes...
              </div>
            ) : quotes.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {quotes.map((quote, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 border-l-4 border-blue-500 dark:border-blue-400 p-4 rounded-r-lg shadow-sm"
                  >
                    <p className="text-gray-700 dark:text-gray-300 italic leading-relaxed">
                      "{quote}"
                    </p>
                  </div>
                ))}
              </div>
            ) : transcript ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                {loadingQuotes
                  ? "Extracting quotes..."
                  : "No quotes extracted yet"}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                Quotes will appear here after transcript loads
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
