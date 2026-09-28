import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { PageError } from "@/components/state";
import { WatchDetailTabs } from "@/components/watch/WatchDetailTabs";
import { getWatch, listAlerts, setWatchStatus, removeWatch, checkWatchNow } from "@/lib/api/watchlist";
import { ApiError } from "@/lib/api/server";
import { shortAddr } from "@/lib/format";

async function toggleStatus(formData: FormData) {
  "use server";
  const watchId = String(formData.get("watch_id") ?? "");
  const to = String(formData.get("to") ?? "paused") as "active" | "paused";
  await setWatchStatus(watchId, to);
  redirect(`/watch/${encodeURIComponent(watchId)}`);
}

async function deleteWatch(formData: FormData) {
  "use server";
  const watchId = String(formData.get("watch_id") ?? "");
  await removeWatch(watchId);
  redirect("/watch");
}

async function runCheck(formData: FormData) {
  "use server";
  const watchId = String(formData.get("watch_id") ?? "");
  try {
    await checkWatchNow(watchId);
    redirect(`/watch/${encodeURIComponent(watchId)}?checked=1`);
  } catch (err) {
    const msg = err instanceof ApiError ? `api-${err.status}` : "failed";
    redirect(`/watch/${encodeURIComponent(watchId)}?error=${encodeURIComponent(msg)}`);
  }
}

export default async function WatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; checked?: string; error?: string }>;
}) {
  const { id } = await params;
  const qs = await searchParams;

  let watch;
  try {
    watch = await getWatch(id);
  } catch (err) {
    if (err instanceof ApiError && err.notFound) notFound();
    return (
      <Chrome crumb={`Watchlist › ${id.slice(0, 8)}`}>
        <PageError title="Could not load watch" error={err} />
      </Chrome>
    );
  }
  const alerts = await listAlerts(id).catch(() => null);
  const shortId = id.length > 8 ? id.slice(0, 8) : id;

  return (
    <Chrome crumb={`Watchlist › ${shortId}`}>
      <p className="crumb">Watchlist › {shortId}</p>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">{shortId} — {watch.label || "Untitled watch"}</h1>
            <p className="page-sub">
              Target {shortAddr(watch.address)} · {watch.chain} · {watch.status}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <form action={toggleStatus}>
              <input type="hidden" name="watch_id" value={id} />
              <input type="hidden" name="to" value={watch.status === "active" ? "paused" : "active"} />
              <button type="submit" className="btn-secondary">
                {watch.status === "active" ? "Pause" : "Resume"}
              </button>
            </form>
            <form action={deleteWatch}>
              <input type="hidden" name="watch_id" value={id} />
              <button type="submit" className="btn-secondary">Delete</button>
            </form>
            <span className="endpoint-chip">POST /watchlist/{`{watch_id}`}/check</span>
            <form action={runCheck}>
              <input type="hidden" name="watch_id" value={id} />
              <button type="submit" className="btn-primary">Run check now</button>
            </form>
          </div>
        </div>
        {qs.checked ? <p style={{ fontSize: 12, color: "var(--ok-text)", marginTop: 8 }}>Check cycle completed.</p> : null}
        {qs.error ? <p style={{ fontSize: 12, color: "var(--signal)", marginTop: 8 }}>Check failed ({qs.error}).</p> : null}
      </div>
      <WatchDetailTabs
        initialTab={qs.tab ?? "overview"}
        watch={watch}
        alerts={alerts?.alerts ?? null}
      />
    </Chrome>
  );
}
