"use client";
import { Printer } from "lucide-react";
import { Button } from "./ui/button";

/** Opens the browser's print dialog; the print stylesheet shows just the brief, ready to save as PDF. */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer />
      Save as PDF
    </Button>
  );
}
