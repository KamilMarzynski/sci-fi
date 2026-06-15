import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import type { ReadStream } from 'node:tty';
import { describe, expect, it } from 'vitest';
import {
  CheckboxCancelledError,
  type CheckboxItem,
  canEnterRawMode,
  createStdinKeyReader,
  type Key,
  type KeyReader,
  promptHarnesses,
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

  it('toggles a checked row back off when space is pressed again', async () => {
    const result = await runCheckbox({
      items: HARNESS_ITEMS,
      message: MESSAGE,
      reader: new ScriptedKeyReader(['space', 'space', 'down', 'space', 'enter']),
      output: new CapturingStream(),
    });

    expect(result).toEqual(['opencode']);
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

  it('returns false when probing setRawMode(true) throws', () => {
    expect(
      canEnterRawMode(
        fakeReadStream({
          isTTY: true,
          setRawMode: (_mode: boolean) => {
            throw new Error('Raw mode unsupported');
          },
        }),
      ),
    ).toBe(false);
  });

  it('returns false when probing setRawMode(false) throws', () => {
    expect(
      canEnterRawMode(
        fakeReadStream({
          isTTY: true,
          setRawMode: (mode: boolean) => {
            if (mode) return;
            throw new Error('Cannot restore cooked mode');
          },
        }),
      ),
    ).toBe(false);
  });
});

// A fake TTY ReadStream: emitKeypressEvents attaches to it, and tests drive it
// by emitting 'keypress' events directly. The cast is isolated to this helper.
class FakeTtyStream extends EventEmitter {
  rawMode = false;
  paused = false;
  setRawMode(mode: boolean): this {
    this.rawMode = mode;
    return this;
  }
  pause(): this {
    this.paused = true;
    return this;
  }
  resume(): this {
    this.paused = false;
    return this;
  }
}

function fakeTty(): FakeTtyStream {
  return new FakeTtyStream();
}

function asReadStream(stream: FakeTtyStream): ReadStream {
  return stream as unknown as ReadStream;
}

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('createStdinKeyReader', () => {
  it('enters raw mode on creation', () => {
    const input = fakeTty();
    const reader = createStdinKeyReader(asReadStream(input));
    expect(input.rawMode).toBe(true);
    reader.close();
  });

  it('queues keypresses that arrive before a read and drains them in order', async () => {
    const input = fakeTty();
    const reader = createStdinKeyReader(asReadStream(input));

    input.emit('keypress', '', { name: 'up' });
    input.emit('keypress', '', { name: 'down' });

    expect(await reader.read()).toBe('up');
    expect(await reader.read()).toBe('down');
    reader.close();
  });

  it('resolves a pending read when the next keypress arrives', async () => {
    const input = fakeTty();
    const reader = createStdinKeyReader(asReadStream(input));

    const pending = reader.read();
    input.emit('keypress', ' ', { name: 'space' });

    expect(await pending).toBe('space');
    reader.close();
  });

  it('maps every recognized key sequence and ignores unknown keys', async () => {
    const input = fakeTty();
    const reader = createStdinKeyReader(asReadStream(input));

    input.emit('keypress', '', { name: 'x' }); // unknown — ignored, not queued
    input.emit('keypress', '', { name: 'up' });
    input.emit('keypress', '', { name: 'down' });
    input.emit('keypress', ' ', { name: 'space' });
    input.emit('keypress', ' ', { sequence: ' ' });
    input.emit('keypress', '\r', { name: 'return' });
    input.emit('keypress', '\n', { name: 'enter' });
    input.emit('keypress', '', { name: 'escape' });
    input.emit('keypress', '', { ctrl: true, name: 'c' });

    const collected: Key[] = [];
    for (let i = 0; i < 8; i += 1) {
      collected.push(await reader.read());
    }

    expect(collected).toEqual([
      'up',
      'down',
      'space',
      'space',
      'enter',
      'enter',
      'cancel',
      'cancel',
    ]);
    reader.close();
  });

  it('detaches and restores cooked mode on close', () => {
    const input = fakeTty();
    const reader = createStdinKeyReader(asReadStream(input));

    reader.close();

    expect(input.rawMode).toBe(false);
    expect(input.paused).toBe(true);
    expect(input.listenerCount('keypress')).toBe(0);
  });

  it('closes safely when the stream no longer exposes setRawMode', () => {
    const input = fakeTty();
    const reader = createStdinKeyReader(asReadStream(input));

    // Simulate a stream that loses setRawMode before close runs.
    (input as { setRawMode?: unknown }).setRawMode = undefined;

    expect(() => reader.close()).not.toThrow();
    expect(input.paused).toBe(true);
  });
});

describe('promptHarnesses', () => {
  it('drives the checkbox via the injected stdin and resolves selected ids', async () => {
    const input = fakeTty();
    const output = new CapturingStream();

    const pending = promptHarnesses(['claude-code', 'opencode'], asReadStream(input), output);

    await tick();
    input.emit('keypress', '', { name: 'down' });
    await tick();
    input.emit('keypress', ' ', { name: 'space' });
    await tick();
    input.emit('keypress', '\r', { name: 'return' });

    expect(await pending).toEqual(['opencode']);
    expect(input.rawMode).toBe(false); // reader.close() restored cooked mode
  });
});
