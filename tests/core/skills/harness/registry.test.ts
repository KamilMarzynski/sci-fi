import { describe, expect, it } from "vitest";
import {
  HarnessNotImplementedError,
  InvalidHarnessError,
} from "../../../../src/core/skills/harness/adapter.js";
import { getAdapter } from "../../../../src/core/skills/harness/registry.js";

describe("getAdapter", () => {
  it("throws InvalidHarnessError for an unknown harness id", () => {
    expect(() => getAdapter("nope" as never)).toThrowError(InvalidHarnessError);
  });

  it("throws HarnessNotImplementedError for opencode", () => {
    expect(() => getAdapter("opencode")).toThrowError(
      HarnessNotImplementedError,
    );
  });

  it("throws HarnessNotImplementedError for codex", () => {
    expect(() => getAdapter("codex")).toThrowError(HarnessNotImplementedError);
  });

  it("throws HarnessNotImplementedError for cursor", () => {
    expect(() => getAdapter("cursor")).toThrowError(HarnessNotImplementedError);
  });

  it("throws HarnessNotImplementedError for agents-md", () => {
    expect(() => getAdapter("agents-md")).toThrowError(
      HarnessNotImplementedError,
    );
  });

  it("throws HarnessNotImplementedError for claude-code until Task 6 registers it", () => {
    expect(() => getAdapter("claude-code")).toThrowError(
      HarnessNotImplementedError,
    );
  });
});
