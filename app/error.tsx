"use client";

import { Chrome } from "@/components/chrome/Chrome";
import { PageError } from "@/components/state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Chrome crumb="">
      <PageError title="Something went wrong" error={error} />
      <button onClick={() => reset()} className="btn-secondary" style={{ marginTop: 16 }}>
        Try again
      </button>
    </Chrome>
  );
}
