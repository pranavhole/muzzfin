import { Stream, Song, User } from "@/lib/types";
import axios from 'axios'
// Mock users
export const mockUsers: User[] = [
  {
    id: "user-1",
    name: "Demo User",
    email: "demo@example.com",
    image: "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=1",
  },
  {
    id: "user-2",
    name: "Jane Smith",
    email: "jane@example.com",
    image: "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=1",
  },
  {
    id: "user-3",
    name: "Alex Johnson",
    email: "alex@example.com",
    image: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=1",
  },
];

// Mock songs
export const mockSongs: Song[] = [
  {
    id: "song-1",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    url: "https://example.com/song1.mp3",
    thumbnail: "https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=200",
    addedBy: "user-2",
    votes: 15,
    duration: 367,
    addedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
  },
  {
    id: "song-2",
    title: "Shape of You",
    artist: "Ed Sheeran",
    url: "https://example.com/song2.mp3",
    thumbnail: "https://images.pexels.com/photos/1047442/pexels-photo-1047442.jpeg?auto=compress&cs=tinysrgb&w=200",
    addedBy: "user-3",
    votes: 8,
    duration: 234,
    addedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
  },
  {
    id: "song-3",
    title: "Dance Monkey",
    artist: "Tones and I",
    url: "https://example.com/song3.mp3",
    thumbnail: "https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=200",
    addedBy: "user-1",
    votes: 12,
    duration: 256,
    addedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
  },
  {
    id: "song-4",
    title: "Blinding Lights",
    artist: "The Weeknd",
    url: "https://example.com/song4.mp3",
    thumbnail: "https://images.pexels.com/photos/1540406/pexels-photo-1540406.jpeg?auto=compress&cs=tinysrgb&w=200",
    addedBy: "user-2",
    votes: 7,
    duration: 203,
    addedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 mins ago
  },
  {
    id: "song-5",
    title: "Bad Guy",
    artist: "Billie Eilish",
    url: "https://example.com/song5.mp3",
    thumbnail: "https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg?auto=compress&cs=tinysrgb&w=200",
    addedBy: "user-3",
    votes: 5,
    duration: 194,
    addedAt: new Date().toISOString(), // Just now
  },
];

// Mock streams
export const mockStreams: Stream[] = [
  {
    id: "stream-1",
    title: "Friday Night Party Mix",
    hostId: "user-1",
    isActive: true,
    currentSong: mockSongs[0],
    queue: [mockSongs[1], mockSongs[2], mockSongs[3], mockSongs[4]],
    listeners: 124,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
  {
    id: "stream-2",
    title: "Chill Beats & Lo-Fi",
    hostId: "user-2",
    isActive: true,
    currentSong: mockSongs[2],
    queue: [mockSongs[3], mockSongs[4], mockSongs[0]],
    listeners: 87,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
  },
  {
    id: "stream-3",
    title: "Rock Classics",
    hostId: "user-3",
    isActive: false,
    currentSong: null,
    queue: [mockSongs[0], mockSongs[4]],
    listeners: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
];

// Helper functions to simulate API calls
export function getStreams(): Promise<Stream[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockStreams);
    }, 500);
  });
}

export function getStream(id: string): Promise<Stream | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const stream = mockStreams.find((s) => s.id === id) || null;
      resolve(stream);
    }, 500);
  });
}

export function getAllStreamIds(): Promise<string[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockStreams.map((stream) => stream.id));
    }, 300);
  });
}

export function createStream(title: string, hostId: string): Promise<Stream> {
  return new Promise(async (resolve) => {
    //  const res = await axios.post()
  });
}

export function addSongToStream(streamId: string, songUrl: string, userId: string): Promise<Song> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // This would normally fetch metadata from the URL
      const newSong: Song = {
        id: `song-${Date.now()}`,
        title: `New Song ${Math.floor(Math.random() * 100)}`,
        artist: `Artist ${Math.floor(Math.random() * 50)}`,
        url: songUrl,
        thumbnail: `https://images.pexels.com/photos/${1000000 + Math.floor(Math.random() * 1000)}/pexels-photo-${1000000 + Math.floor(Math.random() * 1000)}.jpeg?auto=compress&cs=tinysrgb&w=200`,
        addedBy: userId,
        votes: 1,
        duration: 180 + Math.floor(Math.random() * 180),
        addedAt: new Date().toISOString(),
      };
      
      const stream = mockStreams.find((s) => s.id === streamId);
      if (stream) {
        stream.queue.push(newSong);
      }
      
      resolve(newSong);
    }, 1000);
  });
}

export  function  voteSong(streamId: string, songId: string): Promise<void> {
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const stream = mockStreams.find((s) => s.id === streamId);
      if (stream) {
        const song = stream.queue.find((s) => s.id === songId);
        if (song) {
          song.votes += 1;
          // Sort queue by votes
          stream.queue.sort((a, b) => b.votes - a.votes);
        }
      }
      resolve();
    }, 300);
  });
}

export function removeSong(streamId: string, songId: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const stream = mockStreams.find((s) => s.id === streamId);
      if (stream) {
        stream.queue = stream.queue.filter((s) => s.id !== songId);
      }
      resolve();
    }, 300);
  });
}

export function nextSong(streamId: string): Promise<Song | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const stream = mockStreams.find((s) => s.id === streamId);
      if (stream && stream.queue.length > 0) {
        // Get the song with the most votes
        stream.queue.sort((a, b) => b.votes - a.votes);
        const nextSong = stream.queue.shift() || null;
        stream.currentSong = nextSong;
        resolve(nextSong);
      } else if (stream) {
        stream.currentSong = null;
        resolve(null);
      } else {
        resolve(null);
      }
    }, 500);
  });
}