import { stdin, stdout } from 'node:process';
import { emitKeypressEvents } from 'node:readline';
import type { Writable } from 'node:stream';
import type { ReadStream } from 'node:tty';
import type { HarnessId } from '../../core/skills/harness/adapter.js';

export type Key = 'up' | 'down' | 'space' | 'enter' | 'cancel';

export interface KeyReader {
  read(): Promise<Key>;
}

export interface CheckboxItem {
  readonly id: string;
  readonly label: string;
}

const HIDE_CURSOR = '[?25l';
const SHOW_CURSOR = '[?25h';
const CLEAR_LINE = '[2K';

export class CheckboxCancelledError extends Error {
  constructor() {
    super('Harness selection cancelled.');
    this.name = 'CheckboxCancelledError';
  }
}

export function canEnterRawMode(input: NodeJS.ReadStream): boolean {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return false;
  }

  try {
    input.setRawMode(true);
    input.setRawMode(false);
    return true;
  } catch {
    return false;
  }
}

interface FrameOptions {
  readonly message: string;
  readonly items: readonly CheckboxItem[];
  readonly cursor: number;
  readonly checked: ReadonlySet<number>;
  readonly error: string | undefined;
}

function buildFrame(options: FrameOptions): string {
  const rows = options.items.map((item, index) => {
    const cursorMarker = index === options.cursor ? '>' : ' ';
    const box = options.checked.has(index) ? '[x]' : '[ ]';
    return `  ${cursorMarker} ${box} ${item.label}`;
  });
  const errorLine = options.error !== undefined ? `  ${options.error}` : '';
  return `${[options.message, ...rows, errorLine].join('\n')}\n`;
}

function itemAt(items: readonly CheckboxItem[], index: number): CheckboxItem {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Invariant violated: no item at index ${index}`);
  }
  return item;
}

interface RenderFrameOptions {
  readonly output: Writable;
  readonly frame: string;
  readonly lineCount: number;
  readonly first: boolean;
}

function renderFrame(options: RenderFrameOptions): void {
  if (options.first) {
    options.output.write(HIDE_CURSOR + options.frame);
    return;
  }

  const lines = options.frame.split('\n').slice(0, -1);
  const moveUp = `[${options.lineCount}A`;
  const output = `${moveUp}${lines.map((line) => CLEAR_LINE + line).join('\n')}\n`;
  options.output.write(output);
}

export async function runCheckbox(options: {
  readonly items: readonly CheckboxItem[];
  readonly message: string;
  readonly reader: KeyReader;
  readonly output: Writable;
}): Promise<readonly string[]> {
  const { items, message, reader, output } = options;
  let cursor = 0;
  const checked = new Set<number>();
  let error: string | undefined;
  let firstRender = true;
  const lineCount = items.length + 2;

  function render(): void {
    const frame = buildFrame({ message, items, cursor, checked, error });
    renderFrame({ output, frame, lineCount, first: firstRender });
    firstRender = false;
  }

  render();

  while (true) {
    const key = await reader.read();

    if (key === 'up') {
      cursor = (cursor - 1 + items.length) % items.length;
      error = undefined;
    } else if (key === 'down') {
      cursor = (cursor + 1) % items.length;
      error = undefined;
    } else if (key === 'space') {
      if (checked.has(cursor)) {
        checked.delete(cursor);
      } else {
        checked.add(cursor);
      }
      error = undefined;
    } else if (key === 'enter') {
      if (checked.size > 0) {
        output.write(SHOW_CURSOR);
        const selected = Array.from(checked)
          .sort((a, b) => a - b)
          .map((index) => itemAt(items, index));
        return selected.map((item) => item.id);
      }
      error = 'Please select at least one harness.';
    } else if (key === 'cancel') {
      output.write(SHOW_CURSOR);
      throw new CheckboxCancelledError();
    }

    render();
  }
}

interface RawKeypress {
  readonly sequence?: string;
  readonly name?: string;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
}

function mapKeypress(key: RawKeypress): Key | undefined {
  if (key.ctrl === true && key.name === 'c') return 'cancel';
  if (key.name === 'escape') return 'cancel';
  if (key.name === 'up') return 'up';
  if (key.name === 'down') return 'down';
  if (key.name === 'space' || key.sequence === ' ') return 'space';
  if (key.name === 'return' || key.name === 'enter') return 'enter';
  return undefined;
}

export function createStdinKeyReader(input: ReadStream): KeyReader & { close(): void } {
  emitKeypressEvents(input);
  input.setRawMode(true);

  const queue: Key[] = [];
  let resolveNext: ((key: Key) => void) | undefined;

  function onKeypress(_str: string, key: RawKeypress): void {
    const mapped = mapKeypress(key);
    if (mapped === undefined) return;

    if (resolveNext !== undefined) {
      const resolve = resolveNext;
      resolveNext = undefined;
      resolve(mapped);
      return;
    }

    queue.push(mapped);
  }

  input.on('keypress', onKeypress);

  return {
    read(): Promise<Key> {
      if (queue.length > 0) {
        const key = queue.shift();
        if (key !== undefined) {
          return Promise.resolve(key);
        }
      }
      return new Promise((resolve) => {
        resolveNext = resolve;
      });
    },
    close(): void {
      if (typeof input.setRawMode === 'function') {
        input.setRawMode(false);
      }
      input.removeListener('keypress', onKeypress);
      input.pause();
    },
  };
}

export async function promptHarnesses(choices: readonly HarnessId[]): Promise<readonly string[]> {
  const items: CheckboxItem[] = choices.map((id) => ({ id, label: id }));
  const reader = createStdinKeyReader(stdin);
  try {
    return await runCheckbox({
      items,
      message: 'Select harnesses to install (space to toggle, enter to confirm):',
      reader,
      output: stdout,
    });
  } finally {
    reader.close();
  }
}
