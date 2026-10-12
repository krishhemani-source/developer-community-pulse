// shadcn/ui Input and Textarea, restyled to our tokens.
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border border-rule bg-surface px-3 text-sm text-ink placeholder:text-muted/70 aria-[invalid=true]:border-rising",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("min-h-16 w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
