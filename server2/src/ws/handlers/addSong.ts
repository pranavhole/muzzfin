export function getYouTubeVideoId(url: string): string | null {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export interface YouTubeMetadata {
  title: string;
  artist: string;
  thumbnail: string;
  duration: number; // duration is 0 because oEmbed doesn't provide it
}

export async function getYouTubeMetadata(videoId: string): Promise<YouTubeMetadata> {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

  const response = await fetch(oEmbedUrl);
  if (!response.ok) throw new Error(`Failed to fetch metadata for video ID: ${videoId}`);

  const data = (await response.json()) as {
    title: string;
    author_name: string;
    thumbnail_url: string;
  };

  return {
    title: data.title,
    artist: data.author_name,
    thumbnail: data.thumbnail_url,
    duration: 0, 
  };
}
