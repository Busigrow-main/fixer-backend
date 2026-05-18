/**
 * Verify scraped SKU image folders before upload.
 * Run: npm run ac:verify
 *      npm run ac:verify -- --sku=40101701SD01777
 *      npm run ac:verify -- --warn-only
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getArg, parseArgs } from './lib/cli';
import { ENV_PATH, VERIFY_REPORT_JSON } from './lib/paths';
import { filterBySku, loadStockUpload } from './lib/stock';
import { buildVerifyReport, type VerifyReport } from './lib/verify-images';

dotenv.config({ path: ENV_PATH });

function printReport(report: VerifyReport): void {
  console.log(`\n📋 Verify report: ${report.passCount} pass, ${report.failCount} fail`);
  if (report.duplicateHashes.length) {
    console.log(`\n⚠  Cross-SKU duplicate hashes (${report.duplicateHashes.length}):`);
    for (const dup of report.duplicateHashes.slice(0, 10)) {
      console.log(`   ${dup.hash.slice(0, 12)}… → SKUs: ${dup.skus.join(', ')}`);
    }
    if (report.duplicateHashes.length > 10) {
      console.log(`   … and ${report.duplicateHashes.length - 10} more`);
    }
  }

  for (const [sku, r] of Object.entries(report.skus)) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`\n${icon} ${sku} (${r.modelCode})`);
    if (r.productUrl) console.log(`   URL: ${r.productUrl}`);
    for (const e of r.errors) console.log(`   ✗ ${e}`);
    for (const w of r.warnings) console.log(`   ⚠ ${w}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const sku = getArg(args, 'sku');
  const warnOnly = args['warn-only'] === true;

  const items = filterBySku(loadStockUpload(), sku);
  const report = buildVerifyReport(items);

  fs.mkdirSync(path.dirname(VERIFY_REPORT_JSON), { recursive: true });
  fs.writeFileSync(VERIFY_REPORT_JSON, JSON.stringify(report, null, 2));
  console.log(`📝 Wrote ${VERIFY_REPORT_JSON}`);

  printReport(report);

  if (report.failCount > 0 && !warnOnly) {
    console.error(`\n❌ ${report.failCount} SKU(s) failed verification. Fix images or URLs, then re-scrape.`);
    console.error('   npm run ac:scrape -- --sku=<code> --force');
    console.error('   npm run ac:verify -- --sku=<code>');
    process.exitCode = 1;
  } else if (report.failCount > 0) {
    console.warn(`\n⚠  ${report.failCount} failure(s) (--warn-only, exit 0)`);
  } else {
    console.log('\n✅ All SKUs passed verification');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
