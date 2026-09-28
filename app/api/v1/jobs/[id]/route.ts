import { NextResponse } from "next/server";
import { getJob } from "@/lib/api/jobs";
import { ApiError } from "@/lib/api/server";

/**
 * GET /api/v1/jobs/{id} — thin server-side proxy so client components can
 * poll trace status without ever seeing the API key.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const job = await getJob(id);
    return NextResponse.json(job);
  } catch (err) {
    const status = err instanceof ApiError && err.status ? err.status : 502;
    return NextResponse.json({ error: "job lookup failed" }, { status });
  }
}
