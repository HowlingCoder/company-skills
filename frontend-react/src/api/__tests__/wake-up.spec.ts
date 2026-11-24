import { describe, expect, it } from "vitest";
import { HttpError } from "../http";
import { shouldRetryWakeUp } from "../wake-up";

const status = (code: number) => new HttpError(`failed: ${code}`, code, undefined);

describe("shouldRetryWakeUp", () => {
  it("retries gateway errors and requests without an answer", () => {
    expect(shouldRetryWakeUp(0, status(502))).toBe(true);
    expect(shouldRetryWakeUp(0, status(503))).toBe(true);
    expect(shouldRetryWakeUp(0, status(504))).toBe(true);
    expect(shouldRetryWakeUp(0, new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does not retry other errors", () => {
    expect(shouldRetryWakeUp(0, status(500))).toBe(false);
    expect(shouldRetryWakeUp(0, status(422))).toBe(false);
    expect(shouldRetryWakeUp(0, new Error("boom"))).toBe(false);
  });

  it("gives up after 2 minutes: 24 retries 5 seconds apart", () => {
    expect(shouldRetryWakeUp(23, status(502))).toBe(true);
    expect(shouldRetryWakeUp(24, status(502))).toBe(false);
  });
});
