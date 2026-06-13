import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  CheckboxCancelledError,
  type CheckboxItem,
  canEnterRawMode,
  type Key,
  type KeyReader,
  runCheckbox,
} from '../../../src/cli/prompts/checkbox.js';

const HARNESS_ITEMS: readonly CheckboxItem[] = [
  { id: 'claude-code', label: 'claude-code' },
  { id: 'opencode', label: 'opencode' },
  { id: 'codex', label: 'codex' },
  { id: 'cursor', label: 'cursor' },
  { id: 'github-copilot', label: 'github-copilot' },
];

const MESSAGE = 'Select harnesses to install (space to toggle, enter to confirm):';

const HIDE_CURSOR = '[?25l';
const SHOW_CURSOR = '[?25h';
const CLEAR_LINE = '[2K';

class CapturingStream extends Writable {
  readonly chunks: string[] = [];

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    callback();
  }

  captured(): string {
    return this.chunks.join('');
  }
}

class ScriptedKeyReader implements KeyReader {
  constructor(private readonly keys: readonly Key[]) {}

  async read(): Promise<Key> {
    const key = this.keys[this.#index];
    if (key === undefined) {
      throw new Error('ScriptedKeyReader exhausted');
    }
    this.#index += 1;
    return key;
  }

  #index = 0;
}

function extractFrames(output: string, lineCount: number): readonly string[] {
  const withoutCursor = output.replaceAll(HIDE_CURSOR, '').replaceAll(SHOW_CURSOR, '');
  const esc = HIDE_CURSOR.charAt(0);
  const moveUp = new RegExp(`${esc}\\[${lineCount}A`, 'g');
  const rawFrames = withoutCursor.split(moveUp).filter((frame) => frame.length > 0);
  return rawFrames.map((frame) => frame.replaceAll(CLEAR_LINE, ''));
}

describe('runCheckbox', () => {
  it('renders all items unchecked with the cursor on the first row and the message', async () => {
    const output = new CapturingStream();
    const reader = new ScriptedKeyReader(['space', 'enter']);

    await runCheckbox({
      items: HARNESS_ITEMS,
      message: MESSAGE,
      reader,
      output,
    });

    expect(output.captured().startsWith(HIDE_CURSOR)).toBe(true);

    const frames = extractFrames(output.captured(), HARNESS_ITEMS.length + 2);
    const firstFrame = frames[0];
    expect(firstFrame).toContain(MESSAGE);
    expect(firstFrame).toContain('> [ ] claude-code');
    expect(firstFrame).toContain('  [ ] opencode');
    expect(firstFrame).toContain('  [ ] codex');
    expect(firstFrame).toContain('  [ ] cursor');
    expect(firstFrame).toContain('  [ ] github-copilot');
  });

  it('toggles the cursor row with space and resolves to the checked id on enter', async () => {
    const output = new CapturingStream();
    const reader = new ScriptedKeyReader(['space', 'enter']);

    const result = await runCheckbox({
      items: HARNESS_ITEMS,
      message: MESSAGE,
      reader,
      output,
    });

    expect(result).toEqual(['claude-code']);

    const frames = extractFrames(output.captured(), HARNESS_ITEMS.length + 2);
    const preConfirmFrame = frames[frames.length - 1];
    expect(preConfirmFrame).toContain('> [x] claude-code');
    expect(preConfirmFrame).toContain('  [ ] opencode');
  });

  it('moves the cursor with wrap-around and toggles the focused row', async () => {
    const downResult = await runCheckbox({
      items: HARNESS_ITEMS,
      message: MESSAGE,
      reader: new ScriptedKeyReader(['down', 'space', 'enter']),
      output: new CapturingStream(),
    });
    expect(downResult).toEqual(['opencode']);

    const upResult = await runCheckbox({
      items: HARNESS_ITEMS,
      message: MESSAGE,
      reader: new ScriptedKeyReader(['up', 'space', 'enter']),
      output: new CapturingStream(),
    });
    expect(upResult).toEqual(['github-copilot']);
  });

  it('returns multi-selected ids in top-to-bottom display order', async () => {
    const result = await runCheckbox({
      items: HARNESS_ITEMS,
      message: MESSAGE,
      reader: new ScriptedKeyReader(['down', 'down', 'space', 'up', 'up', 'space', 'enter']),
      output: new CapturingStream(),
    });

    expect(result).toEqual(['claude-code', 'codex']);
  });

  it('re-prompts inline when enter is pressed with no selection', async () => {
    const output = new CapturingStream();
    const reader = new ScriptedKeyReader(['enter', 'space', 'enter']);

    const result = await runCheckbox({
      items: HARNESS_ITEMS,
      message: MESSAGE,
      reader,
      output,
    });

    expect(result).toEqual(['claude-code']);

    const frames = extractFrames(output.captured(), HARNESS_ITEMS.length + 2);
    const errorFrame = frames.find((frame) =>
      frame.includes('Please select at least one harness.'),
    );
    expect(errorFrame).toBeDefined();
  });

  it('rejects with CheckboxCancelledError and shows the cursor on abort', async () => {
    const output = new CapturingStream();

    await expect(
      runCheckbox({
        items: HARNESS_ITEMS,
        message: MESSAGE,
        reader: new ScriptedKeyReader(['cancel']),
        output,
      }),
    ).rejects.toThrow(CheckboxCancelledError);

    expect(output.captured()).toContain(SHOW_CURSOR);
  });
});

// canEnterRawMode only inspects isTTY and setRawMode, so a minimal fake stream
// is enough. The cast is isolated to this test helper.
function fakeReadStream(partial: {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => void;
}): NodeJS.ReadStream {
  return partial as unknown as NodeJS.ReadStream;
}

describe('canEnterRawMode', () => {
  it('returns true when the stream is a TTY with a callable setRawMode', () => {
    expect(canEnterRawMode(fakeReadStream({ isTTY: true, setRawMode: () => {} }))).toBe(true);
  });

  it('returns false when the stream lacks setRawMode', () => {
    expect(canEnterRawMode(fakeReadStream({ isTTY: true }))).toBe(false);
  });

  it('returns false when the stream is not a TTY', () => {
    expect(canEnterRawMode(fakeReadStream({ isTTY: false, setRawMode: () => {} }))).toBe(false);
  });
});
