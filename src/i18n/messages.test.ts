import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

/** All dotted leaf paths of a message tree. */
function keysOf(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return prefix ? [prefix] : [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    keysOf(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("i18n message parity", () => {
  const enKeys = new Set(keysOf(en));
  const frKeys = new Set(keysOf(fr));

  it("fr.json covers every en.json key", () => {
    const missing = [...enKeys].filter((k) => !frKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("fr.json has no orphan keys", () => {
    const orphans = [...frKeys].filter((k) => !enKeys.has(k));
    expect(orphans).toEqual([]);
  });

  it("keeps empty-string values mirrored (intentional blank intros)", () => {
    const emptyEn = [...enKeys].filter((k) => leaf(en, k) === "");
    const emptyFr = [...frKeys].filter((k) => leaf(fr, k) === "");
    expect(emptyEn.sort()).toEqual(emptyFr.sort());
  });
});

function leaf(tree: unknown, path: string): unknown {
  let node: unknown = tree;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}
