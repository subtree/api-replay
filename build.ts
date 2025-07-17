import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { rm, mkdir } from 'node:fs/promises';

async function build() {
  const srcDir = join(process.cwd(), 'src');
  const distDir = join(process.cwd(), 'dist');
  
  // Clean dist directory
  if (existsSync(distDir)) {
    await rm(distDir, { recursive: true });
  }
  await mkdir(distDir, { recursive: true });
  
  // Build with Bun
  const result = await Bun.build({
    entrypoints: [join(srcDir, 'index.ts')],
    outdir: distDir,
    target: 'bun',
    format: 'esm',
    splitting: true,
    sourcemap: 'external',
    minify: false,
  });
  
  if (!result.success) {
    console.error('Build failed:', result.logs);
    process.exit(1);
  }
  
  // Run TypeScript to generate declaration files
  const tscResult = await Bun.spawn(['tsc', '--project', '.'], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  
  if (tscResult.exitCode !== 0) {
    console.error('TypeScript declaration generation failed');
    process.exit(1);
  }
  
  console.log('Build completed successfully!');
}

build().catch(console.error);