import { NextResponse } from "next/server";
import FeedParser from "feedparser";
import https from "https";

interface Video {
  id: string;
  title: string;
  link: string;
  published: Date;
  description: string;
}

// Channel handle: @charleshoskinsoncrypto
const CHANNEL_HANDLE = "charleshoskinsoncrypto";
const CHANNEL_URL = `https://www.youtube.com/@${CHANNEL_HANDLE}`;

// Try multiple RSS URL formats
async function fetchVideosWithFallback(): Promise<Video[]> {
  const CHANNEL_ID = "UCiJiqEvUZxT6isIaXK7RXTg"; // @charleshoskinsoncrypto channel ID
  const rssUrls = [
    // Primary: Use the correct channel ID
    `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`,
    // Fallback: Try channel handle format (might work for some channels)
    `https://www.youtube.com/feeds/videos.xml?user=${CHANNEL_HANDLE}`,
  ];

  for (const url of rssUrls) {
    try {
      // Only try RSS feed URLs (first two)
      if (url.includes("feeds/videos.xml")) {
        const videos = await fetchVideosFromRSS(url);
        if (videos.length > 0) {
          return videos;
        }
      }
    } catch (error) {
      console.log(`Failed to fetch from ${url}, trying next...`);
      continue;
    }
  }

  throw new Error("All RSS feed attempts failed");
}

export async function GET() {
  try {
    // Use RSS feed to fetch videos
    const videos = await fetchVideosWithFallback();
    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch videos",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

function fetchVideosFromRSS(rssUrl: string): Promise<Video[]> {
  return new Promise((resolve, reject) => {
    const videos: Video[] = [];
    const req = https.get(rssUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Bad status code: ${res.statusCode}`));
        return;
      }

      const feedparser = new FeedParser({});

      res.pipe(feedparser);

      feedparser.on("error", (error: Error) => {
        reject(error);
      });

      feedparser.on("readable", function (this: FeedParser) {
        const stream = this;
        let item: any;

        while ((item = stream.read())) {
          // Extract video ID - try multiple methods
          // YouTube RSS feeds may have yt:videoId in the item
          const videoId =
            (item as any).yt_videoid ||
            extractVideoId(item.link) ||
            extractVideoId(item.guid);

          if (videoId) {
            videos.push({
              id: videoId,
              title: item.title || "Untitled",
              link: item.link || "",
              published: item.pubdate || new Date(),
              description: item.description || "",
            });
          }
        }
      });

      feedparser.on("end", () => {
        resolve(videos);
      });
    });

    req.on("error", (error) => {
      reject(error);
    });
  });
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}
