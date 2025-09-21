import Link from "next/link";

import { Button } from "@/components/ui/button";
import { 
  Music, 
  HeadphonesIcon, 
  Users, 
  Radio, 
  ListMusic, 
  ThumbsUp
} from "lucide-react";

export default function Home() {
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero section */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-background to-muted/30">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="inline-block rounded-lg bg-muted/80 px-3 py-1 text-sm backdrop-blur-sm">
              Introducing SyncTunes
            </div>
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
              Listen Together, In Perfect Sync
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
              Stream music synchronously with friends. Vote on songs, add your favorites,
              and enjoy a shared listening experience in real-time.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="h-12 px-6">
                <Link href="/streams">
                  <HeadphonesIcon className="mr-2 h-5 w-5" />
                  Join a Stream
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-6">
                <Link href="/dashboard">
                  <Radio className="mr-2 h-5 w-5" />
                  Host a Stream
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features section */}
      <section className="py-16 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-12">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Radio className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Host a Stream</h3>
              <p className="text-muted-foreground">
                Create your own music stream and invite friends to join. Control playback
                and moderate the queue as the host.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <ListMusic className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Add Songs</h3>
              <p className="text-muted-foreground">
                Add your favorite songs from YouTube, SoundCloud, or Spotify. Build a
                collaborative playlist together with other listeners.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <ThumbsUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Vote & Rank</h3>
              <p className="text-muted-foreground">
                Vote for your favorite tracks to move them up in the queue. The most popular
                songs play first, making it a truly democratic experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto max-w-[700px] text-muted-foreground">
              SyncTunes makes it easy to share music with friends in perfect synchronization.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-6 py-12 lg:grid-cols-3 lg:gap-12">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-primary bg-background text-lg font-bold">
                1
              </div>
              <h3 className="text-xl font-bold">Sign In</h3>
              <p className="text-muted-foreground">
                Create an account or sign in with Google to access all features.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-primary bg-background text-lg font-bold">
                2
              </div>
              <h3 className="text-xl font-bold">Create or Join</h3>
              <p className="text-muted-foreground">
                Host your own stream or join an existing one from the streams page.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-primary bg-background text-lg font-bold">
                3
              </div>
              <h3 className="text-xl font-bold">Listen & Participate</h3>
              <p className="text-muted-foreground">
                Add songs to the queue, vote for your favorites, and enjoy music together.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              Ready to Start Streaming?
            </h2>
            <p className="mx-auto max-w-[700px] text-muted-foreground">
              Join SyncTunes today and experience the joy of listening to music together.
            </p>
            <Button asChild size="lg" className="h-12 px-6 mt-4">
              <Link href="/login">
                <Users className="mr-2 h-5 w-5" />
                Sign Up Now
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}