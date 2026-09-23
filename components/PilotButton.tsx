"use client";

import { usePilot } from "@/components/PilotProvider";

type PilotButtonProps = {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function PilotButton({ children, className = "button button-dark", ariaLabel }: PilotButtonProps) {
  const { openPilot } = usePilot();
  return (
    <button type="button" className={className} onClick={openPilot} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
