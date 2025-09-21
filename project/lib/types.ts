export type User = {
  id: string;
  name: string;
  email: string;
  image?: string;
  lastSeen: Date;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail?: string;
  addedBy: string;
  _count?: {
    votedBy: number;
  };
  duration: number;
  addedAt: string;
};

export type Stream = {
  id: string;
  title: string;
  hostId: string;
  isActive: boolean;
  currentSong: Song | null;
  queue: Song[];
  listeners: number;
  createdAt: string;
};

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};