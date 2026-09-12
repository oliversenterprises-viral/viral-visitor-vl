/** Social preview crawlers — same set as live `src/lib/og-meta.ts`. */
export function isSocialCrawler(userAgent: string): boolean {
  return /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|googlebot|bingbot|applebot|pinterest|embedly|redditbot/i.test(
    userAgent,
  );
}
