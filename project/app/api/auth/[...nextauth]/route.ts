// pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import axios from "axios";

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

export const authOptions: NextAuthOptions = {
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
          // 🔎 Try to fetch user by email first
          const existingUser = await axios.get(
            `${process.env.SERVER_URL}/api/v1/users/${user.email}`
          );

          if (existingUser.data?.user) {
            token.id = existingUser.data.user.id;
          } else {
            // 🆕 If not found, create new user
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
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
