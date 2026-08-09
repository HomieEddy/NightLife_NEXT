import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  DEMO_GROUPS,
  HOUSE_RULES,
  WALKTHROUGH,
  demoKeys,
  featureAnchorId,
} from "./demo-guide-content";

const DEMO_MESSAGES = { en: en.demo, fr: fr.demo } as const;

function keyExists(locale: "en" | "fr", path: string): boolean {
  // Resolve dotted paths against the demo subtree (walkthrough ids and
  // feature anchors are hyphenated, never dotted).
  const parts = path.split(".");
  let node: unknown = DEMO_MESSAGES[locale];
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}

describe("demo guide i18n mapping", () => {
  const features = DEMO_GROUPS.flatMap((g) => g.features);

  it("maps every feature to existing message keys in both locales", () => {
    for (const f of features) {
      for (const field of ["title", "what", "why", "tryPath"] as const) {
        const key = demoKeys.feature(f, field);
        expect(keyExists("en", key), `missing en key ${key}`).toBe(true);
        expect(keyExists("fr", key), `missing fr key ${key}`).toBe(true);
      }
    }
  });

  it("maps every group to existing message keys in both locales", () => {
    for (const g of DEMO_GROUPS) {
      for (const field of ["label", "intro"] as const) {
        const key = demoKeys.group(g.id, field);
        expect(keyExists("en", key), `missing en key ${key}`).toBe(true);
        expect(keyExists("fr", key), `missing fr key ${key}`).toBe(true);
      }
    }
  });

  it("maps every walkthrough step and house rule in both locales", () => {
    for (const step of WALKTHROUGH) {
      for (const field of ["step", "detail", "linkLabel"] as const) {
        const key = demoKeys.walkthrough(step.id, field);
        expect(keyExists("en", key), `missing en key ${key}`).toBe(true);
        expect(keyExists("fr", key), `missing fr key ${key}`).toBe(true);
      }
    }
    for (const rule of HOUSE_RULES) {
      for (const field of ["title", "line", "linkLabel"] as const) {
        const key = demoKeys.rule(rule.id, field);
        if (!rule.href && field === "linkLabel") continue;
        expect(keyExists("en", key), `missing en key ${key}`).toBe(true);
        expect(keyExists("fr", key), `missing fr key ${key}`).toBe(true);
      }
    }
  });

  it("keeps feature anchor ids unique", () => {
    const anchors = features.map((f) => featureAnchorId(f));
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("mirrors the en and fr demo message trees", () => {
    function keysOf(node: unknown): string[] {
      if (typeof node !== "object" || node === null) return [];
      return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => [
        k,
        ...keysOf(v).map((sub) => `${k}.${sub}`),
      ]);
    }
    const enKeys = new Set(keysOf(DEMO_MESSAGES.en));
    const frKeys = new Set(keysOf(DEMO_MESSAGES.fr));
    expect([...frKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !frKeys.has(k))).toEqual([]);
  });
});
