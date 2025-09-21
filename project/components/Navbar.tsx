"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Music, Home, Radio, LogIn } from "lucide-react";
import { useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <header className="pl-4 pr-4 sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Music className="h-6 w-6" />
            <span className="font-bold text-xl hidden sm:inline-block">SyncTunes</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 ml-6">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/') ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Home
            </Link>
            {isAuthenticated && (
              <>
                <Link 
                  href="/dashboard" 
                  className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/dashboard') ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  Dashboard
                </Link>
                <Link 
                  href="/streams" 
                  className={`text-sm font-medium transition-colors hover:text-primary ${isActive('/streams') ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  Streams
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.image} alt={user?.name} />
                    <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/streams">Streams</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href="/login" className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}