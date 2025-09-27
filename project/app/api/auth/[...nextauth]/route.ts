// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import axios from "axios";

const NEXTAUTH_URL =
  process.env.NEXTAUTH_URL ?? "https://muzzy.pranavhole.space";
const SERVER_URL =
  process.env.SERVER_URL ??
  "https://muzzfin-production.up.railway.app";

// ---- Extend NextAuth types ----
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      lastSeen: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      token?: string | null;
    };
  }

  interface User {
    id: string;
  }

  interface JWT {
    id?: string;
    token?: string;
  }
}

// ---- NextAuth configuration ----
const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // ---- JWT callback: store DB id + backend token ----
    async jwt({ token, account, user }) {
      if (account && user) {
        try {
          let backendUser;

          // 1️⃣ Try GET /users/:email
          try {
            const getRes = await axios.get(`${SERVER_URL}/api/v1/users/${user.email}`);
            backendUser = getRes.data.user;
          } catch (getErr: any) {
            if (getErr.response?.status !== 404) {
              console.error("❌ GET /users failed:", getErr.message);
            }
          }

          // 2️⃣ If GET fails or user not found, POST /users
          if (!backendUser) {
            const postRes = await axios.post(`${SERVER_URL}/api/v1/users`, {
              name: user.name ?? "",
              email: user.email ?? "",
              image: user.image ?? "",
              lastSeen: new Date().toISOString(),
            });
            backendUser = postRes.data.user;
          }

          // Store id and backend token in JWT
          if (backendUser?.id) {
            token.id = backendUser.id;
            token.token = backendUser.token ?? token.token;
          }
        } catch (err: any) {
          console.error("❌ Backend sync failed:", {
            message: err.message,
            status: err.response?.status,
            data: err.response?.data,
          });
        }
      }
      return token;
    },

    // ---- Session callback: map JWT to Session, update lastSeen ----
    async session({ session, token }) {
      const fallbackUser = {
        id: "unknown",
        name: session.user?.name ?? "Anonymous",
        email: session.user?.email ?? "unknown@example.com",
        image: session.user?.image ?? null,
        lastSeen: new Date().toISOString(),
        token: null,
      };

      if (!token.id) {
        console.warn("⚠️ No token.id found. Returning fallback session.");
        return { ...session, user: fallbackUser };
      }

      // Optional: update lastSeen
      try {
        await axios.post(`${SERVER_URL}/api/v1/users/lastSeen`, {
          id: token.id,
          lastSeen: new Date().toISOString(),
        });
      } catch (err) {
        console.error("⚠️ Failed to update lastSeen:", err);
      }

      return {
        ...session,
        user: {
          id: token.id as string,
          name: session.user?.name ?? "Anonymous",
          email: session.user?.email ?? "unknown@example.com",
          image: session.user?.image ?? null,
          lastSeen: new Date().toISOString(),
          token: token.token ?? null,
        },
      };
    },

    // ---- Redirect callback ----
    async redirect({ url, baseUrl }) {
      if (url.includes("/api/auth/error") || url.includes("/login")) {
        return `${baseUrl}/login`;
      }
      if (url.startsWith(baseUrl)) return url;
      return NEXTAUTH_URL;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? "fallback_secret",
};

// ---- Export handlers for App Router ----
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
