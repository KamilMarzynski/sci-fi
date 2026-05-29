import type { SkillBundle } from "../types.js";

export type HarnessId =
  | "claude-code"
  | "opencode"
  | "codex"
  | "cursor"
  | "agents-md";

export const KNOWN_HARNESS_IDS: readonly HarnessId[] = [
  "claude-code",
  "opencode",
  "codex",
  "cursor",
  "agents-md",
];

export interface HarnessAdapter {
  readonly id: HarnessId;
  install(
    bundles: readonly SkillBundle[],
    projectRoot: string,
  ): Promise<void>;
}

export class InvalidHarnessError extends Error {
  constructor(value: string) {
    super(
      `Unknown harness "${value}". Expected one of: ${KNOWN_HARNESS_IDS.join(
        ", ",
      )}.`,
    );
    this.name = "InvalidHarnessError";
  }
}

export class HarnessNotImplementedError extends Error {
  constructor(public readonly harness: HarnessId) {
    super(
      `Harness "${harness}" is not implemented yet. Track progress at https://github.com/KamilMarzynski/spec-flow/issues.`,
    );
    this.name = "HarnessNotImplementedError";
  }
}

export function isHarnessId(value: string): value is HarnessId {
  return (KNOWN_HARNESS_IDS as readonly string[]).includes(value);
}
