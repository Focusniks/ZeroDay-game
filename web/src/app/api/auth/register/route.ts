import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      password?: string;
      passwordConfirm?: string;
      hatRank?: string;
    };

    const name = body?.name?.toString().trim();
    const password = body?.password?.toString();
    const passwordConfirm = body?.passwordConfirm?.toString();
    const hatRankRaw = (body?.hatRank ?? "Gray Hat").toString();

    const allowedHatRanks = ["White Hat", "Gray Hat", "Black Hat"] as const;
    const hatRank = allowedHatRanks.includes(hatRankRaw as any)
      ? (hatRankRaw as (typeof allowedHatRanks)[number])
      : "Gray Hat";

    if (!name || name.length < 3) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 });
    }
    if (!passwordConfirm || passwordConfirm !== password) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "Name already exists" }, { status: 409 });
    }

    const passwordHash = await hash(password, 10);

    await prisma.user.create({
      data: {
        name,
        hatRank,
        passwordHash,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

