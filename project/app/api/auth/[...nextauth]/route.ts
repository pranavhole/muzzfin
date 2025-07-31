// pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import axios from "axios";

declare module "next-auth" {
  interface Session {
    user: {
      lastSeen: string;
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        // user signed in first time, populate token id
        token.id = token.sub;

        try {
          // Use ISO date string for consistency and serialization
          await axios.post(`${process.env.SERVER_URL}/api/v1/auth`, {
            id: token.sub,
            name: user.name ?? "",
            email: user.email ?? "",
            image: user.image ?? "",
            lastSeen: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Error syncing with Express backend:", err);
        }
      }
      // Always return token
      return token;
    },

    async session({ session, token }) {
      if (session.user && token?.sub) {
        session.user = {
          ...session.user,
          id: token.sub,
          lastSeen: new Date().toISOString(),
        };
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };