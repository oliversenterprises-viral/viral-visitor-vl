import https from 'https';

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => resolve({ status: r.statusCode, body: d }));
      })
      .on('error', reject);
  });
}

const home = await get('https://www.viralrefer.app/');
const llms = await get('https://www.viralrefer.app/llms.txt');
const robots = await get('https://www.viralrefer.app/robots.txt');
const sm = await get('https://www.viralrefer.app/sitemap.xml');

const report = {
  home: home.status,
  whatIs: home.body.includes('What is ViralRefer'),
  faqSection: home.body.includes('id="faq"'),
  FAQPage: home.body.includes('FAQPage'),
  aeoEntity: home.body.includes('aeo-entity'),
  llms: llms.status,
  llmsOk: llms.body.includes('ViralRefer') && llms.body.includes('no cash prize'),
  robots: robots.status,
  GPTBot: robots.body.includes('GPTBot'),
  PerplexityBot: robots.body.includes('PerplexityBot'),
  sitemapFaq: sm.body.includes('#faq'),
  sitemapLlms: sm.body.includes('llms.txt'),
};

console.log(JSON.stringify(report, null, 2));
const ok =
  report.home === 200 &&
  report.whatIs &&
  report.faqSection &&
  report.FAQPage &&
  report.llms === 200 &&
  report.llmsOk &&
  report.GPTBot &&
  report.sitemapFaq;
process.exit(ok ? 0 : 1);
