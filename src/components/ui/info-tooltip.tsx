"use client";

/**
 * (i) hover/focus tooltip for explaining a derived metric.
 *
 * Used next to numeric values whose math isn't obvious from context (e.g.
 * IRR on /forecast — per `feedback_literal_labels_when_multiple_values`,
 * the LITERAL number must carry its own explanation).
 *
 * Built on @base-ui/react/tooltip — keyboard-accessible (focusable trigger,
 * Escape closes), portaled (escapes overflow-hidden parents), and uses
 * `aria-describedby` automatically.
 */

import { Tooltip } from "@base-ui/react/tooltip";
import type * as React from "react";

import { cn } from "@/lib/utils";

export interface InfoTooltipProps {
  /// Accessible name for the trigger button (e.g. "How is this calculated?").
  label: string;
  /// Rich content rendered inside the popup. Keep concise — narrative + a
  /// 1–2 line formula. The popup max-width is ~24rem.
  children: React.ReactNode;
  className?: string;
}

export function InfoTooltip({ label, children, className }: InfoTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        aria-label={label}
        className={cn(
          "border-foreground/20 text-foreground/60 hover:bg-foreground/5 hover:text-foreground focus-visible:ring-foreground/40 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border align-middle text-[10px] font-semibold leading-none focus:outline-none focus-visible:ring-2",
          className,
        )}
      >
        i
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup className="border-foreground/10 bg-popover text-popover-foreground z-50 max-w-[24rem] rounded-lg border p-3 text-xs leading-relaxed shadow-md">
            {children}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
