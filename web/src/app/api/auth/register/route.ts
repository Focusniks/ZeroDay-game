import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  void req;
  return NextResponse.json(
    { error: "Registration is disabled on this site. Use unified account provisioning." },
    { status: 403 }
  );
}

