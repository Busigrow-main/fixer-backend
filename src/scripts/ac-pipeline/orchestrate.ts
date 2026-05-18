/**
 * AC ingestion pipeline orchestrator.
 * Run: npm run ac:pipeline
 *      npm run ac:pipeline -- --step=scrape --parallel=3
 *      npm run ac:pipeline -- --skip-verify
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getArg, getArgNumber, parseArgs } from './lib/cli';
import { IMAGES_ROOT } from './lib/paths';
import { filterBySku, loadStockUpload } from './lib/stock';

const BACKEND_ROOT = path.resolve(__dirname, '../../..');

function runNpm(script: string, extraArgs: string[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script, '--', ...extraArgs], {
      stdio: 'inherit',
      cwd: BACKEND_ROOT,
      shell: true,
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function runParallelScrapes(skus: string[], parallel: number, extraArgs: string[]): Promise<number> {
  const queue = [...skus];
  let failed = 0;

  async function worker(): Promise<void> {
    while (queue.length) {
      const sku = queue.shift();
      if (!sku) return;
      console.log(`\n── Scrape worker: ${sku} ──`);
      const code = await runNpm('ac:scrape', ['--sku', sku, ...extraArgs]);
      if (code !== 0) failed++;
    }
  }

  await Promise.all(Array.from({ length: Math.min(parallel, skus.length) }, () => worker()));
  return failed;
}

async function main() {
  const args = parseArgs(process.argv);
  const step = getArg(args, 'step') ?? 'all';
  const sku = getArg(args, 'sku');
  const parallel = getArgNumber(args, 'parallel', 2);
  const skipVerify = args['skip-verify'] === true;
  const passArgs = sku ? ['--sku', sku] : [];
  const productUrl = getArg(args, 'product-url');
  const scrapeExtra = productUrl && sku ? ['--product-url', productUrl] : [];

  const items = filterBySku(loadStockUpload(), sku);
  fs.mkdirSync(IMAGES_ROOT, { recursive: true });
  for (const item of items) {
    fs.mkdirSync(path.join(IMAGES_ROOT, item.itemCode), { recursive: true });
  }
  console.log(`📁 Prepared ${items.length} image folder(s) under ${IMAGES_ROOT}`);

  const steps =
    step === 'all' ? ['scrape', 'verify', 'upload', 'seed'] : [step];

  for (const s of steps) {
    console.log(`\n════════ Step: ${s} ════════\n`);
    if (s === 'scrape') {
      if (!sku && parallel > 1) {
        const failed = await runParallelScrapes(
          items.map((i) => i.itemCode),
          parallel,
          scrapeExtra,
        );
        if (failed) console.warn(`\n⚠  ${failed} scrape job(s) failed`);
      } else {
        const code = await runNpm('ac:scrape', [...passArgs, ...scrapeExtra]);
        if (code !== 0) console.warn('Scrape step had failures');
      }
    } else if (s === 'verify') {
      if (skipVerify) {
        console.log('⏭  Skipping verify (--skip-verify)');
        continue;
      }
      const code = await runNpm('ac:verify', passArgs);
      if (code !== 0) {
        console.error('Verify step failed — fix images/URLs before upload. Use --skip-verify to override.');
        process.exit(code);
      }
    } else if (s === 'upload') {
      const code = await runNpm('ac:upload', passArgs);
      if (code !== 0) process.exit(code);
    } else if (s === 'merge' || s === 'seed') {
      const code = await runNpm(s === 'seed' ? 'ac:seed' : 'ac:merge', passArgs);
      if (code !== 0) process.exit(code);
    } else {
      throw new Error(`Unknown step: ${s}. Use scrape|verify|upload|merge|seed|all`);
    }
  }

  console.log('\n✅ Pipeline finished');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
