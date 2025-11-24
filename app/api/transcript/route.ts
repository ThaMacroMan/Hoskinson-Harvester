import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json(
      { error: "videoId parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Get the path to the Python script
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "fetch_transcript.py"
    );
    const venvPython = path.join(process.cwd(), "venv", "bin", "python3");

    // Execute Python script with video ID
    const { stdout, stderr } = await execAsync(
      `"${venvPython}" "${scriptPath}" "${videoId}"`
    );

    if (stderr) {
      console.error("Python script stderr:", stderr);
    }

    // Parse JSON response from Python script
    const result = JSON.parse(stdout);

    if (!result.success) {
      // Handle specific error cases
      if (
        result.error?.includes("No transcripts were found") ||
        result.error?.includes("TranscriptsDisabled") ||
        result.error?.includes("NoTranscriptFound")
      ) {
        return NextResponse.json(
          { error: "No transcript available for this video" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch transcript", details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      videoId: result.videoId,
      transcript: result.transcript,
      entries: result.entries,
    });
  } catch (error: any) {
    console.error(`Error fetching transcript for ${videoId}:`, error);

    // Handle JSON parse errors
    if (
      error.message?.includes("Unexpected token") ||
      error.message?.includes("JSON")
    ) {
      return NextResponse.json(
        {
          error: "Failed to parse transcript response",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch transcript", details: error.message },
      { status: 500 }
    );
  }
}
