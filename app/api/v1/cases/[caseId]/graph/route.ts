import { NextResponse } from "next/server";
import { getGraphTopology } from "@/lib/api/graph";
import { ApiError } from "@/lib/api/server";

/**
 * GET /api/v1/cases/{caseId}/graph?max_edges=N — thin server-side proxy so
 * client components can change the visible edge budget without the API key.
 */
export async function GET(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const maxEdges = Number(new URL(req.url).searchParams.get("max_edges") ?? "2000") || 2000;
  try {
    const topo = await getGraphTopology(caseId, 500, maxEdges);
    return NextResponse.json(topo);
  } catch (err) {
    const status = err instanceof ApiError && err.status ? err.status : 502;
    return NextResponse.json({ error: "graph topology lookup failed" }, { status });
  }
}
