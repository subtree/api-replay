import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { rm, mkdir } from 'node:fs/promises';

async function build() {
  const srcDir = join(process.cwd(), 'src');
  const distDir = join(process.cwd(), 'dist');

  console.log('Starting build process...');

  // Clean dist directory
  if (existsSync(distDir)) {
    await rm(distDir, { recursive: true });
  }
  await mkdir(distDir, { recursive: true });

  // Build with Bun - this creates the JS files
  console.log('Building JavaScript files...');
  const result = await Bun.build({
    entrypoints: [join(srcDir, 'index.ts')],
    outdir: distDir,
    target: 'node',
    format: 'esm',
    splitting: false,
    sourcemap: 'external',
    minify: false,
  });

  if (!result.success) {
    console.error('Build failed:', result.logs);
    process.exit(1);
  }

  console.log('JavaScript build completed successfully!');
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});