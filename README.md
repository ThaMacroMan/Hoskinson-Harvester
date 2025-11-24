# Hoskinson Harvester™

An automated Next.js application that scrapes Charles Hoskinson's YouTube videos and fetches their transcripts using the Python `youtube-transcript-api` library.

## Features

- 📺 Automatically fetches videos from Charles Hoskinson's YouTube channel via RSS feed
- 📝 Retrieves transcripts for any video (supports both manual and auto-generated subtitles)
- 💬 **AI-powered quote extraction** - Automatically extracts the most powerful quotes using GPT-4o-mini
- 💾 Tracks processed videos in browser localStorage
- 🎨 Clean, modern UI with dark mode support
- ⚡ Fast and reliable transcript fetching

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.8+ (for transcript fetching)
- **OpenAI API Key** (for quote extraction)
- A terminal/command line

## Setup Instructions

### 1. Install Node.js Dependencies

```bash
npm install
```

This installs all the Next.js dependencies including React, TypeScript, Tailwind CSS, etc.

### 2. Set Up Python Environment

The app uses a Python virtual environment to fetch YouTube transcripts. Set it up:

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
# venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

**Note:** The virtual environment only needs to be activated during setup. The Next.js app will automatically use the Python interpreter from `venv/bin/python3` when fetching transcripts.

### 3. Verify Python Script

Make sure the Python script is executable:

```bash
chmod +x scripts/fetch_transcript.py
```

### 4. Set Up OpenAI API Key

Create a `.env.local` file in the root directory:

```bash
# Create .env.local file
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env.local
```

Replace `your_openai_api_key_here` with your actual OpenAI API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys).

**Note:** The `.env.local` file is gitignored and won't be committed to version control.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

1. **Video Fetching**: Uses YouTube RSS feeds to get the latest videos from Charles Hoskinson's channel (`@charleshoskinsoncrypto`)
2. **Transcript Fetching**: When you click on a video, the app:
   - Calls the Next.js API route (`/api/transcript`)
   - Executes a Python script that uses `youtube-transcript-api`
   - Returns the transcript as JSON
   - Displays it in the UI
3. **Quote Extraction**: After the transcript loads, the app automatically:
   - Sends the transcript to OpenAI GPT-4o-mini
   - Extracts 5-10 of the most powerful, memorable quotes
   - Displays them in a dedicated quotes panel

## Project Structure

```
hoskinscraper/
├── app/
│   ├── api/
│   │   ├── videos/route.ts      # Fetches videos from YouTube RSS
│   │   ├── transcript/route.ts  # Calls Python script for transcripts
│   │   └── quotes/route.ts       # Extracts quotes using OpenAI
│   └── page.tsx                  # Main UI component
├── scripts/
│   └── fetch_transcript.py       # Python script for transcript fetching
├── venv/                         # Python virtual environment (gitignored)
├── requirements.txt              # Python dependencies
└── package.json                  # Node.js dependencies
```

## Troubleshooting

### Python Script Not Found

If you get errors about the Python script not being found:

- Make sure `venv/` directory exists and has `bin/python3` (or `Scripts/python.exe` on Windows)
- Verify `scripts/fetch_transcript.py` exists and is executable

### Transcript Fetching Fails

- Ensure the virtual environment is set up: `python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
- Check that `youtube-transcript-api` is installed: `pip list | grep youtube-transcript-api`
- Some videos may not have transcripts available

### Quote Extraction Not Working

- Verify your OpenAI API key is set in `.env.local`: `OPENAI_API_KEY=sk-...`
- Check that the API key is valid and has credits
- Ensure the transcript has loaded successfully before quotes can be extracted
- Check the browser console for any error messages

### Channel ID Issues

If videos aren't loading, the channel ID might need updating:

- Edit `app/api/videos/route.ts`
- Update the `CHANNEL_ID` constant with the correct YouTube channel ID

## Development

- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Transcript API**: Python `youtube-transcript-api` (v1.2.3+)

## License

MIT
# Hoskinson-Harvester
