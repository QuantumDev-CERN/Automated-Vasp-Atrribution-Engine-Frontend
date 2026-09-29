import { NextResponse } from "next/server";
import { getRecentTransactions } from "@/lib/api/graph";
import { ApiError } from "@/lib/api/server";

/**
 * GET /api/v1/cases/{caseId}/graph/transactions?limit=N&offset=M — thin
 * server-side proxy so client components can page recent transactions
 * without the API key.
 */
export async function GET(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? "4") || 4));
  const offset = Math.max(0, Number(sp.get("offset") ?? "0") || 0);
  try {
    const txs = await getRecentTransactions(caseId, limit, offset);
    return NextResponse.json(txs);
  } catch (err) {
    const status = err instanceof ApiError && err.status ? err.status : 502;
    return NextResponse.json({ error: "recent transactions lookup failed" }, { status });
  }
}
