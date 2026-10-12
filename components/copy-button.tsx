"use client";
import { ClipboardCopy } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "./toast";

export function CopyForDocButton({ markdown }: { markdown: string }) {
  const toast = useToast();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markdown);
          toast("Copied for Google Doc. Paste it into your notes.");
        } catch {
          toast("Copy failed: the browser blocked clipboard access. Select the text manually instead.", "error");
        }
      }}
    >
      <ClipboardCopy />
      Copy for Google Doc
    </Button>
  );
}
