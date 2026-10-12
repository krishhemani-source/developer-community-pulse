"use client";
// "Run now" with live stage progress. Polls /api/runs/[id] every 2 seconds while a run is going.
import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { runNowAction } from "@/app/actions";
import { StageProgress } from "./stage-progress";
import { useToast } from "./toast";
import { Button } from "./ui/button";

export interface RunSummary {
  id: number;
  status: "running" | "success" | "partial" | "failed";
  stage: string;
  trigger: string;
  error: string | null;
}

const STATUS_TEXT = { success: "finished", partial: "finished with warnings", failed: "failed" } as const;

export function RunControls({ initialRun }: { initialRun: RunSummary | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [run, setRun] = useState<RunSummary | null>(initialRun?.status === "running" ? initialRun : null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(
    (id: number) => {
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/runs/${id}`, { cache: "no-store" });
          if (!res.ok) return;
          const data = (await res.json()) as RunSummary;
          setRun(data);
          if (data.status !== "running") {
            if (timer.current) clearInterval(timer.current);
            timer.current = null;
            const verb = STATUS_TEXT[data.status];
            if (data.status === "failed") toast(`Run ${verb}: ${data.error ?? "see the run log"}`, "error");
            else toast(`Run ${verb}. The brief is updated.`);
            setRun(null);
            router.refresh();
          }
        } catch {
          // Network blip: keep polling.
        }
      }, 2000);
    },
    [router, toast],
  );

  useEffect(() => {
    if (initialRun?.status === "running") poll(initialRun.id);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [initialRun, poll]);

  const busy = pending || run !== null;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        onClick={() =>
          startTransition(async () => {
            const result = await runNowAction();
            if (!result.ok) {
              toast(result.message, "error");
              return;
            }
            toast("Run started. Collecting posts now.");
            setRun({ id: result.runId, status: "running", stage: "queued", trigger: "manual", error: null });
            poll(result.runId);
          })
        }
        disabled={busy}
        aria-describedby={run ? "run-progress" : undefined}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Play />}
        {busy ? "Running" : "Run now"}
      </Button>
      {run && (
        <div id="run-progress" aria-live="polite">
          <StageProgress stage={run.stage} showSending={run.trigger !== "backfill"} />
        </div>
      )}
    </div>
  );
}
