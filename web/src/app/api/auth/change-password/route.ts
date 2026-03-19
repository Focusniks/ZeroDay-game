import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const runtime = "nodejs";
const backendBaseUrl = process.env.BACKEND_HTTP_URL ?? "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
      newPasswordConfirm?: string;
    };

    const currentPassword = body?.currentPassword?.toString() ?? "";
    const newPassword = body?.newPassword?.toString() ?? "";
    const newPasswordConfirm = body?.newPasswordConfirm?.toString() ?? "";

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "New password is too short" }, { status: 400 });
    }
    if (newPassword !== newPasswordConfirm) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    const accessToken = (token as any)?.accessToken as string | undefined;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${backendBaseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !data?.ok) {
      return NextResponse.json({ error: data?.error ?? "Password update failed" }, { status: response.status });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

