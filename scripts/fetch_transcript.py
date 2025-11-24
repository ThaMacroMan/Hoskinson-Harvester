#!/usr/bin/env python3
"""
Python script to fetch YouTube video transcripts using youtube-transcript-api
Called from Next.js API route
"""
import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi

def fetch_transcript(video_id: str):
    """Fetch transcript for a given YouTube video ID"""
    try:
        # Create API instance and fetch transcript
        # The new API uses instance methods, not static methods
        ytt_api = YouTubeTranscriptApi()
        fetched_transcript = ytt_api.fetch(video_id)
        
        # Format the transcript data
        # The new API returns a FetchedTranscript object with snippets
        entries = []
        full_text = []
        
        for snippet in fetched_transcript:
            entries.append({
                "text": snippet.text,
                "start": snippet.start if hasattr(snippet, 'start') else 0,
                "duration": snippet.duration if hasattr(snippet, 'duration') else 0
            })
            full_text.append(snippet.text)
        
        return {
            "success": True,
            "videoId": video_id,
            "transcript": " ".join(full_text),
            "entries": entries
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "videoId": video_id
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Video ID is required"
        }))
        sys.exit(1)
    
    video_id = sys.argv[1]
    result = fetch_transcript(video_id)
    print(json.dumps(result))

