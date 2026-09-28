import { Chrome } from "@/components/chrome/Chrome";
import { SkeletonRows } from "@/components/state";

export default function WorkbenchLoading() {
  return (
    <Chrome crumb="Trace workbench">
      <div className="page-head">
        <div className="skeleton" style={{ height: 24, width: 340, marginBottom: 8 }}>&nbsp;</div>
        <div className="skeleton" style={{ height: 13, width: 260 }}>&nbsp;</div>
      </div>
      <div className="skeleton" style={{ height: 520, width: "100%", marginBottom: 24 }}>&nbsp;</div>
      <SkeletonRows rows={4} cols={2} />
    </Chrome>
  );
}
