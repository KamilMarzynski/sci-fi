import { Command } from "commander";
import { cwd } from "node:process";
import { scaffoldInit } from "../../core/init/scaffold.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize specflow in the current repository")
    .action(async () => {
      await scaffoldInit({ projectRoot: cwd() });
    });
}
