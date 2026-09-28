import { Chrome } from "@/components/chrome/Chrome";
import { SkeletonRows } from "@/components/state";

export default function CaseDetailLoading() {
  return (
    <Chrome crumb="Case detail">
      <div className="skeleton" style={{ height: 13, width: 200, marginBottom: 12 }}>&nbsp;</div>
      <div className="page-head">
        <div className="skeleton" style={{ height: 24, width: 320, marginBottom: 8 }}>&nbsp;</div>
        <div className="skeleton" style={{ height: 13, width: 380 }}>&nbsp;</div>
      </div>
      <SkeletonRows rows={5} cols={2} />
    </Chrome>
  );
}
