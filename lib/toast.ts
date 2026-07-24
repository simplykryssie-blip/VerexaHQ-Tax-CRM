export type ToastVariant = "success" | "error";

export type ToastDetail = { message: string; variant: ToastVariant };

const EVENT_NAME = "verexa:toast";

function emit(detail: ToastDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(EVENT_NAME, { detail }));
}

export const toast = {
  success: (message: string) => emit({ message, variant: "success" }),
  error: (message: string) => emit({ message, variant: "error" }),
};

export const TOAST_EVENT_NAME = EVENT_NAME;
