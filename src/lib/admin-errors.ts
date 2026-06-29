export interface StructuredAdminError {
  stage: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export function structuredAdminError(
  error: unknown,
  stage: string,
  fallback = "Admin action failed.",
): StructuredAdminError {
  if (!error || typeof error !== "object") {
    return { stage, message: String(error || fallback) };
  }

  const maybe = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  return {
    stage,
    message: maybe.message || fallback,
    code: maybe.code,
    details: maybe.details,
    hint: maybe.hint,
  };
}

export function adminErrorMessage(
  error: unknown,
  stage: string,
  fallback = "Admin action failed.",
) {
  return structuredAdminError(error, stage, fallback).message;
}
