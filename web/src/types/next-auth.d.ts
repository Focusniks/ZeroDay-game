import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      hatRank: string;
      name?: string | null;
      email?: string | null;
      createdAt?: string;
      accessToken?: string;
      reputation?: string;
    };
  }

  interface User {
    id: string;
    hatRank: string;
    name?: string | null;
    email?: string | null;
    createdAt?: string | Date;
    accessToken?: string;
    reputation?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    email?: string;
    hatRank?: string;
    createdAt?: string;
    accessToken?: string;
    reputation?: string;
  }
}

