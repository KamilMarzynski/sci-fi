import { describe, expect, it } from "vitest";
import { formatFixId } from "../../../src/core/fixes/id.js";

describe("formatFixId", () => {
  it("pads single digits to four places", () => {
    expect(formatFixId(1)).toBe("FIX-0001");
  });

  it("pads two digit numbers", () => {
    expect(formatFixId(42)).toBe("FIX-0042");
  });

  it("does not truncate large numbers", () => {
    expect(formatFixId(10000)).toBe("FIX-10000");
  });
});
