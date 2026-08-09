/**
 * Demo-build crawler defense (used by the proxy). Two UA classifications:
 * - Blocked bots get a hard 403 before any page/API function runs — the
 *   Vercel bill guard, since every demo page hit is a function invocation.
 *   robots.txt is advisory; this is the enforcement layer.
 * - Trusted crawlers (search engines, social preview scrapers) bypass the
 *   per-IP rate limit so legit indexing and link unfurls never get 429s.
 */

const BOT_BLOCKLIST = [
  // AI training/answer scrapers — no legitimate reason to touch the demo.
  "gptbot",
  "oai-searchbot",
  "chatgpt-user",
  "claudebot",
  "anthropic-ai",
  "claude-web",
  "ccbot", // Common Crawl
  "bytespider", // ByteDance
  "amazonbot",
  "perplexitybot",
  "meta-externalagent",
  "cohere-ai",
  "ai2bot",
  "diffbot",
  "imagesiftbot",
  // SEO audit spiders — heavy crawlers, zero value here.
  "ahrefsbot",
  "semrushbot",
  "mj12bot", // Majestic
  "dotbot", // Moz
  "blexbot",
  "dataforseobot",
  "serpstatbot",
  "petalbot",
  "screaming frog",
  "sitebulb",
  // Security scanners / scraper frameworks.
  "nikto",
  "sqlmap",
  "zgrab",
  "masscan",
  "censys",
  "shodan",
  "urlscan.io",
  "scrapy",
] as const;

// Substring-checked against the lowercased UA — keep entries lowercase.
const TRUSTED_CRAWLERS = [
  // Search engines.
  "googlebot",
  "adsbot-google",
  "bingbot",
  "bingpreview",
  "applebot",
  "duckduckbot",
  "yandexbot",
  "baiduspider",
  "seznambot",
  "sogou",
  "naverbot",
  // Social preview scrapers (OG cards, link unfurls).
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "pinterest",
  "discordbot",
  "slackbot",
  "whatsapp",
  "telegrambot",
  "redditbot",
  "embedly",
] as const;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const blockedPattern = new RegExp(
  BOT_BLOCKLIST.map((ua) => escapeRegExp(ua)).join("|"),
  "i",
);
const trustedPattern = new RegExp(
  TRUSTED_CRAWLERS.map((ua) => escapeRegExp(ua)).join("|"),
  "i",
);

export function isBlockedBot(userAgent: string | null | undefined): boolean {
  return !!userAgent && blockedPattern.test(userAgent);
}

export function isTrustedCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && trustedPattern.test(userAgent);
}
