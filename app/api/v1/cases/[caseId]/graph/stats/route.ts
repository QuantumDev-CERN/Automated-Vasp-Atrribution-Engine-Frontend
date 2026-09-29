import { NextResponse } from "next/server";
import { getGraphStats } from "@/lib/api/graph";
import { ApiError } from "@/lib/api/server";

/**
 * GET /api/v1/cases/{caseId}/graph/stats?days=N — thin server-side proxy so
 * client components can switch the activity range without the API key.
 * days=0 means lifetime.
 */
export async function GET(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const days = new URL(req.url).searchParams.get("days") ?? "30";
  try {
    const stats = await getGraphStats(caseId, Number(days) || 0);
    return NextResponse.json(stats);
  } catch (err) {
    const status = err instanceof ApiError && err.status ? err.status : 502;
    return NextResponse.json({ error: "graph stats lookup failed" }, { status });
  }
}
