/**
 * Public types for the BANGUAT integration. Decimal-as-string for rates per
 * `_THE_RULES.MD` Rule 8 (money math never touches IEEE-754).
 */

export interface BanguatRate {
  /// ISO date (YYYY-MM-DD) — converted from the BANGUAT `dd/mm/yyyy` format.
  date: string;
  /// GTQ per USD as a decimal string, exactly as published by BANGUAT.
  rateGtqPerUsd: string;
}

export class BanguatFetchError extends Error {
  override readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "BanguatFetchError";
    this.cause = cause;
  }
}

export class BanguatParseError extends Error {
  readonly responseSnippet: string;
  constructor(message: string, responseSnippet: string) {
    super(message);
    this.name = "BanguatParseError";
    // Truncate so logs don't explode on a 50KB error page.
    this.responseSnippet = responseSnippet.slice(0, 500);
  }
}
