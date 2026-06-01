import { describe, expect, it } from "vitest";
import { assertSafeSlug, slugify } from "../../src/core/slugify.js";

describe("slugify", () => {
  it("lowercases input", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces non-alphanumeric sequences with a single hyphen", () => {
    expect(slugify("foo   bar")).toBe("foo-bar");
    expect(slugify("foo...bar")).toBe("foo-bar");
    expect(slugify("foo_bar")).toBe("foo-bar");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("-hello-")).toBe("hello");
    expect(slugify("!!!start")).toBe("start");
  });

  it("returns empty string for input with only special chars", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("assertSafeSlug", () => {
  it("accepts valid kebab-case slugs", () => {
    expect(() => assertSafeSlug("user-auth", "test")).not.toThrow();
    expect(() => assertSafeSlug("a", "test")).not.toThrow();
    expect(() => assertSafeSlug("abc123-def456", "test")).not.toThrow();
  });

  it("rejects path traversal attempts", () => {
    expect(() => assertSafeSlug("../etc/passwd", "feature slug")).toThrow(
      'Invalid feature slug "../etc/passwd"',
    );
    expect(() => assertSafeSlug("..\\windows", "feature slug")).toThrow(
      'Invalid feature slug "..\\windows"',
    );
    expect(() => assertSafeSlug("../../tmp/evil", "feature slug")).toThrow(
      'Invalid feature slug "../../tmp/evil"',
    );
    expect(() => assertSafeSlug("./config", "feature slug")).toThrow(
      'Invalid feature slug "./config"',
    );
  });

  it("rejects absolute paths", () => {
    expect(() => assertSafeSlug("/etc/passwd", "feature slug")).toThrow();
    expect(() => assertSafeSlug("C:\\Windows", "feature slug")).toThrow();
  });

  it("rejects slugs with spaces", () => {
    expect(() => assertSafeSlug("my feature", "feature slug")).toThrow();
  });

  it("rejects slugs with special characters", () => {
    expect(() => assertSafeSlug("foo@bar", "feature slug")).toThrow();
    expect(() => assertSafeSlug("foo;rm", "feature slug")).toThrow();
    expect(() => assertSafeSlug("foo$bar", "feature slug")).toThrow();
    expect(() => assertSafeSlug("foo`bar", "feature slug")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => assertSafeSlug("", "feature slug")).toThrow();
  });
});
