import { prisma } from "@/lib/prisma";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

export const runtime = "nodejs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        name: { label: "Nickname", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const name = credentials?.name?.toString().trim();
        const password = credentials?.password?.toString();

        if (!name || !password) return null;

        const user = await prisma.user.findUnique({
          where: { name },
        });

        if (!user) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          hatRank: user.hatRank,
          createdAt: user.createdAt.toISOString(),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` exists only on first login
      if (user) {
        token.id = (user as any).id as string;
        token.name = (user as any).name as string;
        token.hatRank = (user as any).hatRank as string;
        token.createdAt = (user as any).createdAt as string;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string;
        session.user.hatRank = (token.hatRank ?? "") as string;
        session.user.name = (token.name ?? session.user.name) as string | undefined;
        // Keep ISO string in session to avoid Date serialization issues in client
        (session.user as any).createdAt = (token.createdAt ?? "") as string;
      }

      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

