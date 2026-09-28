import { Chrome } from "@/components/chrome/Chrome";
import { SkeletonRows } from "@/components/state";

export default function Loading() {
  return (
    <Chrome crumb="">
      <div className="page-head">
        <div className="skeleton" style={{ height: 24, width: 280, marginBottom: 8 }}>&nbsp;</div>
        <div className="skeleton" style={{ height: 13, width: 200 }}>&nbsp;</div>
      </div>
      <SkeletonRows />
    </Chrome>
  );
}
