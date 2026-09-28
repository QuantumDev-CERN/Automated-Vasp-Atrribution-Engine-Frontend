import { Chrome } from "@/components/chrome/Chrome";
import { NotFound } from "@/components/state";

export default function NotFoundPage() {
  return (
    <Chrome crumb="">
      <NotFound what="page" />
    </Chrome>
  );
}
