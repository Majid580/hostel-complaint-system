"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/overlays";

export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  /** From the proxy, so next-themes' pre-paint script satisfies the CSP. */
  nonce?: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ classNames: { toast: "rounded-xl border-border" } }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
