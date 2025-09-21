import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Toaster } from "@/components/ui/toaster";
import Providers from '@/components/provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SyncTunes - Synchronous Music Streaming',
  description: 'Listen to music together with friends, vote on songs, and enjoy in real-time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
      <Providers >
        <ThemeProvider>
          <AuthProvider>
            
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-grow ml-4 mr-4">
                {children}
              </main>
              <Footer />
            </div>
            <Toaster />
         
          </AuthProvider>
        </ThemeProvider>
      </Providers>
      </body>
    </html>
  );
}