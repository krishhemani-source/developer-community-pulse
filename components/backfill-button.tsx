"use client";
// "Build 4-week history": processes one past week per request, oldest first, so each request
// stays inside Vercel's time limit. Shows a progress bar and the live stage of the current week.
import { History, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { StageProgress } from "./stage-progress";
import { useToast } from "./toast";
import { Button } from "./ui/button";

interface BackfillResponse {
  ok: boolean;
  message?: string;
  done?: boolean;
  planned?: number;
  remaining?: number;
  ranWeek?: string | null;
  status?: string;
  anchor?: string;
}

export function BackfillButton({ variant = "primary" }: { variant?: "primary" | "outline" }) {
  const router = useRouter();
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [completed, setCompleted] = useState(0);
  const [stage, setStage] = useState("queued");
  const stagePoll = useRef<ReturnType<typeof setInterval> | null>(null);

  function startStagePolling() {
    stagePoll.current = setInterval(async () => {
      try {
        const res = await fetch("/api/runs/latest", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { status: string; stage: string };
          if (data.status === "running") setStage(data.stage);
        }
      } catch {
        // ignore and keep polling
      }
    }, 2000);
  }

  async function build() {
    setRunning(true);
    setCompleted(0);
    setTotal(null);
    startStagePolling();
    let anchor: string | undefined;
    let done = 0;
    try {
      // One week per request. Stops when the server says history is complete.
      for (let guard = 0; guard < 6; guard++) {
        setStage("queued");
        const res = await fetch("/api/pipeline/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anchor }),
        });
        const data = (await res.json().catch(() => ({ ok: false, message: `Server returned ${res.status}` }))) as BackfillResponse;
        if (!data.ok) {
          toast(data.message ?? "History build stopped. Check the run log.", "error");
          break;
        }
        anchor = data.anchor;
        if (data.planned !== undefined) setTotal((t) => t ?? data.planned!);
        if (data.ranWeek) {
          done++;
          setCompleted(done);
          if (data.status === "failed") {
            toast(`The week starting ${data.ranWeek} failed. See the run log for the reason.`, "error");
            break;
          }
        }
        if (data.done) {
          toast(done > 0 ? `Built ${done} weeks of history.` : "History is already complete.");
          break;
        }
      }
    } catch (err) {
      toast(`History build stopped: ${err instanceof Error ? err.message : "network error"}. Run it again to continue.`, "error");
    } finally {
      if (stagePoll.current) clearInterval(stagePoll.current);
      setRunning(false);
      router.refresh();
    }
  }

  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <Button onClick={build} disabled={running} variant={variant} className="self-start">
        {running ? <Loader2 className="animate-spin" /> : <History />}
        {running ? "Building history" : "Build 4-week history"}
      </Button>
      {running && (
        <div aria-live="polite" className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total ?? 4}
            aria-valuenow={completed}
            aria-label="Weeks built"
            className="h-1.5 w-full overflow-hidden rounded-sm bg-rule"
          >
            <div className="h-full bg-ink transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="tabular text-sm text-muted">
            {total ? `Week ${Math.min(completed + 1, total)} of ${total}` : "Planning weeks"} · each week takes up to five minutes
          </p>
          <StageProgress stage={stage} showSending={false} />
        </div>
      )}
    </div>
  );
}
