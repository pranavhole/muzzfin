import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query
  )}`;

  try {
    const { data } = await axios.get(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      },
    });

    // Extract ytInitialData JSON
    const match = data.match(/var ytInitialData = (.*?);\s*<\/script>/);
    if (!match || match.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const json = JSON.parse(match[1]);

    // Navigate JSON structure to find videoRenderer items
    const contents =
      json.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    let results: { title: string; url: string }[] = [];

    for (const item of contents) {
      const video = item.videoRenderer;
      if (video?.videoId) {
        const title = video.title.runs[0].text;
        const url = `https://www.youtube.com/watch?v=${video.videoId}`;
        results.push({ title, url });
      }
    }

    // Filter for music-related results
    const songKeywords = /(official|music|lyrics|audio|song|video)/i;
    let songResults = results.filter((r) => songKeywords.test(r.title));

    if (songResults.length === 0) {
      songResults = results.slice(0, 5);
    }

    return NextResponse.json({ results: songResults.slice(0, 5) });
  } catch (err) {
    console.error("YouTube scrape error:", err);
    return NextResponse.json({ results: [] });
  }
}
