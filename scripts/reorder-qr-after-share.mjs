import { readFileSync, writeFileSync } from 'fs';

const p = 'index.html';
let html = readFileSync(p, 'utf8');

const qrComment = '<!-- QR Code';
const qrStart = html.indexOf(qrComment);
const shareStart = html.indexOf('id="share-power-block"');
if (qrStart < 0 || shareStart < 0 || qrStart > shareStart) {
  console.error('Unexpected layout', { qrStart, shareStart });
  process.exit(1);
}

// Start at beginning of the line containing the QR comment
const blockStart = html.lastIndexOf('\n', qrStart) + 1;
// share-power div starts a few chars before id=
const shareDivStart = html.lastIndexOf('<div', shareStart);
const qrBlock = html.slice(blockStart, shareDivStart);
html = html.slice(0, blockStart) + html.slice(shareDivStart);

const moreBtn = html.indexOf('id="share-more-options-btn"');
if (moreBtn < 0) {
  console.error('share-more-options-btn not found');
  process.exit(1);
}
// Close of share-power-block is the </div> after more-options button's </button>
const afterMore = html.indexOf('</button>', moreBtn);
const closeDiv = html.indexOf('</div>', afterMore);
if (closeDiv < 0) {
  console.error('close div not found');
  process.exit(1);
}
const insertAt = closeDiv + '</div>'.length;
html = html.slice(0, insertAt) + '\n\n' + qrBlock + html.slice(insertAt);
writeFileSync(p, html);
console.log('OK: QR relocated after share-power-block, bytes', qrBlock.length);
