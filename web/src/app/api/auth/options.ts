import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const runtime = "nodejs";

const backendBaseUrl = process.env.BACKEND_HTTP_URL ?? "http://127.0.0.1:8000";

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

        const response = await fetch(`${backendBaseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login: name,
            password,
          }),
        });

        if (!response.ok) return null;

        const data = (await response.json()) as {
          ok?: boolean;
          token?: string;
          user?: {
            id: string;
            username: string;
            email: string;
            reputation?: number;
            created_at?: string;
            createdAt?: string;
          };
        };
        if (!data?.ok || !data?.user || !data?.token) return null;

        return {
          id: data.user.id,
          name: data.user.username,
          email: data.user.email,
          hatRank: "Gray Hat",
          createdAt: data.user.createdAt ?? data.user.created_at ?? new Date().toISOString(),
          accessToken: data.token,
          reputation: String(data.user.reputation ?? 0),
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
        token.email = (user as any).email as string;
        token.hatRank = (user as any).hatRank as string;
        token.createdAt = (user as any).createdAt as string;
        token.accessToken = (user as any).accessToken as string;
        token.reputation = (user as any).reputation as string;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string;
        session.user.hatRank = (token.hatRank ?? "") as string;
        session.user.name = (token.name ?? session.user.name) as string | undefined;
        session.user.email = (token.email ?? session.user.email) as string | undefined;
        // Keep ISO string in session to avoid Date serialization issues in client
        (session.user as any).createdAt = (token.createdAt ?? "") as string;
        (session.user as any).accessToken = (token.accessToken ?? "") as string;
        (session.user as any).reputation = (token.reputation ?? "0") as string;
      }

      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

