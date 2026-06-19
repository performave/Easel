/** Best-effort extraction of a human-readable message from an unknown error. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const maybeMessage = Reflect.get(error, "message");
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
    const maybeError = Reflect.get(error, "error");
    if (typeof maybeError === "string" && maybeError.trim()) return maybeError;
    const maybeRaw = Reflect.get(error, "raw");
    if (typeof maybeRaw === "string" && maybeRaw.trim()) return maybeRaw;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/** Canvas returns 404 when clearing a nickname that was never set — treat as a no-op. */
export function isNoNicknameToClearError(message: string): boolean {
  return message.includes("canvas error 404") && message.includes("no nickname exists for course");
}
