// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import axios from "axios";

const NEXTAUTH_URL = process.env.NEXTAUTH_URL ??"https://muzzy.pranavhole.space";
declare module "next-auth" {
  interface Session {
    user: {
      id: string; // DB id
      lastSeen: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
  }

  interface JWT {
    id?: string; // DB id
  }
}

// Internal auth options (not exported)
const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        try {
          // Try to fetch user by email from backend
          const existingUser = await axios.get(
            `${process.env.SERVER_URL}/api/v1/users/${user.email}`
          );

          if (existingUser.data?.user) {
            token.id = existingUser.data.user.id;
          } else {
            // Create new user if not found
            const res = await axios.post(
              `${process.env.SERVER_URL}/api/v1/users`,
              {
                name: user.name ?? "",
                email: user.email ?? "",
                image: user.image ?? "",
                lastSeen: new Date().toISOString(),
              }
            );
            token.id = res.data.user.id;
          }
        } catch (err) {
          console.error("Error syncing with backend:", err);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string; // always DB id
        session.user.lastSeen = new Date().toISOString();
      }
      return session;
    },
      async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      return NEXTAUTH_URL;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? "fallback_secret",
};

// App Router expects HTTP method exports
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
