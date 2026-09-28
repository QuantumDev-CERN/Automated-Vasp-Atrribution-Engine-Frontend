import { TopBar } from "./TopBar";
import { SideNav } from "./SideNav";
import { StatusBar } from "./StatusBar";

/**
 * App frame: top bar (per-page breadcrumb) / side rail + page / status bar.
 * Every page renders inside Chrome with its own crumb.
 */
export function Chrome({ crumb, children }: { crumb: string; children: React.ReactNode }) {
  return (
    <div className="app-frame">
      <TopBar crumb={crumb} />
      <div className="app-main">
        <SideNav />
        <main className="page">{children}</main>
      </div>
      <StatusBar />
    </div>
  );
}
