import { describe, expect, it } from "vitest";
import { isBlockedBot, isTrustedCrawler } from "./bot-block";

describe("isBlockedBot", () => {
  it("blocks known AI scrapers", () => {
    expect(isBlockedBot("Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)")).toBe(true);
    expect(isBlockedBot("Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://claudebot.anthropic.com)")).toBe(true);
    expect(isBlockedBot("CCBot/2.0 (https://commoncrawl.org/faq/)")).toBe(true);
    expect(isBlockedBot("Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai)")).toBe(true);
  });

  it("blocks SEO audit spiders and scanners", () => {
    expect(isBlockedBot("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)")).toBe(true);
    expect(isBlockedBot("Mozilla/5.0 (compatible; SemrushBot/7.0; +http://www.semrush.com/bot.html)")).toBe(true);
    expect(isBlockedBot("sqlmap/1.7")).toBe(true);
    expect(isBlockedBot("Mozilla/5.0 zgrab/0.x")).toBe(true);
  });

  it("is case-insensitive and matches inside a full UA", () => {
    expect(isBlockedBot("Mozilla/5.0 (compatible; gptbot/2.0)")).toBe(true);
    expect(isBlockedBot("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) ClaudeBot/0.3 Chrome/120 Safari/537.36")).toBe(true);
  });

  it("does not block normal browsers, curl, or legit crawlers", () => {
    expect(isBlockedBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36")).toBe(false);
    expect(isBlockedBot("curl/8.7.1")).toBe(false);
    expect(isBlockedBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(false);
    expect(isBlockedBot("Twitterbot/1.0")).toBe(false);
  });

  it("treats missing UAs as not blocked (rate limit covers them)", () => {
    expect(isBlockedBot(null)).toBe(false);
    expect(isBlockedBot(undefined)).toBe(false);
  });
});

describe("isTrustedCrawler", () => {
  it("trusts search engine crawlers", () => {
    expect(isTrustedCrawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isTrustedCrawler("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(true);
    expect(isTrustedCrawler("Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)")).toBe(true);
  });

  it("trusts social preview scrapers", () => {
    expect(isTrustedCrawler("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(isTrustedCrawler("Twitterbot/1.0")).toBe(true);
    expect(isTrustedCrawler("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)")).toBe(true);
  });

  it("does not trust normal browsers, curl, or blocked bots", () => {
    expect(isTrustedCrawler("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36")).toBe(false);
    expect(isTrustedCrawler("curl/8.7.1")).toBe(false);
    expect(isTrustedCrawler("Mozilla/5.0 (compatible; GPTBot/1.0)")).toBe(false);
    expect(isTrustedCrawler(null)).toBe(false);
    expect(isTrustedCrawler(undefined)).toBe(false);
  });
});
