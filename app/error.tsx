"use client";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ErrorState
        title="This page failed to load"
        message={error.message || "An unexpected server error occurred."}
        action="Try again. If it keeps failing, check the run log or the Vercel function logs."
      />
      <Button variant="outline" className="self-start" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
