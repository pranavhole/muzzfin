// context/AuthContext.tsx
"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { AuthState, User } from "@/lib/types";
import axios from "axios";

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const user = session?.user
    ? {
        id: (session.user as any).id ?? "", // type override if needed
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        image: session.user.image ?? "",
        lastSeen: session.user.lastSeen ?? "",
      }
    : null;

  const isAuthenticated = !!session;
  const isLoading = status === "loading";
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateLastSeen = async () => {
      try {
        await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/lastSeen`,{ id: user?.id, lastSeen: new Date().toISOString() });
      } catch (error) {
        console.error("Failed to update lastSeen:", error);
      }
    };

    updateLastSeen();

    const intervalId = setInterval(updateLastSeen, 30000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);


  const login = async () => {
    await signIn("google",{callbackUrl:"/dashboard"}); // or your preferred provider
  };

  const logout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <AuthContext.Provider
      value={{
        user: user
          ? {
              ...user,
              lastSeen:
                typeof user.lastSeen === "string"
                  ? new Date(user.lastSeen)
                  : user.lastSeen,
            }
          : null,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
