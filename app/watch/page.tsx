import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { PageError } from "@/components/state";
import { WatchTable } from "@/components/watch/WatchTable";
import { listWatches, checkWatchNow } from "@/lib/api/watchlist";
import { ApiError } from "@/lib/api/server";

async function checkNow(formData: FormData) {
  "use server";
  const watchId = String(formData.get("watch_id") ?? "");
  try {
    await checkWatchNow(watchId);
  } catch {
    // The table reloads anyway; a failed check surfaces on the detail page.
  }
  redirect("/watch");
}

export default async function WatchPage() {
  let watches;
  try {
    watches = (await listWatches()).watches;
  } catch (err) {
    return (
      <Chrome crumb="Watchlist">
        <PageError title="Could not load watchlist" error={err} />
      </Chrome>
    );
  }
  const active = watches.filter((w) => w.status === "active").length;

  return (
    <Chrome crumb="Watchlist">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Watchlist</h1>
            <p className="page-sub">{watches.length} watch{watches.length === 1 ? "" : "es"} · {active} active</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="endpoint-chip">POST /watchlist</span>
            <Link href="/watch/new" className="btn-primary">+ New watch</Link>
          </div>
        </div>
      </div>
      <WatchTable watches={watches} checkNow={checkNow} />
    </Chrome>
  );
}
