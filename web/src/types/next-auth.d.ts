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
    };
  }

  interface User {
    id: string;
    hatRank: string;
    name?: string | null;
    email?: string | null;
    createdAt?: string | Date;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    hatRank?: string;
    createdAt?: string;
  }
}

