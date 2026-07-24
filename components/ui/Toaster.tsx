"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOAST_EVENT_NAME, type ToastDetail } from "@/lib/toast";

type ToastItem = ToastDetail & { id: number };

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 0;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      const id = nextId++;
      setToasts((current) => [...current, { ...detail, id }]);
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 5000);
    };
    window.addEventListener(TOAST_EVENT_NAME, handler);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg sm:w-auto",
            item.variant === "success"
              ? "border-accent-200 bg-white text-foreground"
              : "border-red-200 bg-white text-foreground",
          )}
        >
          {item.variant === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          )}
          <p className="flex-1">{item.message}</p>
          <button
            onClick={() =>
              setToasts((current) => current.filter((t) => t.id !== item.id))
            }
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
