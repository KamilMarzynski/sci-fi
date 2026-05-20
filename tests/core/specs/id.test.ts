import { describe, expect, it } from "vitest";
import { formatFeatureId } from "../../../src/core/specs/id.js";

describe("formatFeatureId", () => {
  it("pads single-digit numbers to four digits", () => {
    expect(formatFeatureId(1)).toBe("FEAT-0001");
  });

  it("returns the maximum four-digit number unpadded", () => {
    expect(formatFeatureId(9999)).toBe("FEAT-9999");
  });

  it("does not pad five-digit numbers", () => {
    expect(formatFeatureId(10000)).toBe("FEAT-10000");
  });
});
