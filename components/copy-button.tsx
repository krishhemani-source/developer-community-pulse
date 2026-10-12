"use client";
import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { useToast } from "./toast";

export function CopyForDocButton({ markdown }: { markdown: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markdown);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          toast("Copied for Google Doc. Paste it into your notes.");
        } catch {
          toast("Copy failed: the browser blocked clipboard access. Select the text manually instead.", "error");
        }
      }}
    >
      {copied ? <Check className="sf-fade-in" /> : <ClipboardCopy />}
      {copied ? "Copied" : "Copy for Google Doc"}
    </Button>
  );
}
