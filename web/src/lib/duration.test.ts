import { describe, it, expect } from "vitest";
import { parseDuration, formatDuration } from "./duration";

describe("parseDuration", () => {
  it.each([
    ["1d", 480],
    ["2h30m", 150],
    ["1.5h", 90],
    ["90", 90],
    ["1d 2h", 600],
    ["0m", 0],
    ["2h", 120],
    ["15m", 15],
  ])("parses %s -> %i", (input, expected) => {
    expect(parseDuration(input as string)).toBe(expected);
  });

  it.each(["", "abc", "1y", "1d junk", "   "])("rejects %s", (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});

describe("formatDuration", () => {
  it.each([
    [480, "1d"],
    [150, "2h 30m"],
    [90, "1h 30m"],
    [0, "0m"],
    [600, "1d 2h"],
  ])("formats %i -> %s", (mins, expected) => {
    expect(formatDuration(mins as number)).toBe(expected);
  });
});
