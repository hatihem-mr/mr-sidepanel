import esbuild from 'esbuild';
import { copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const isDev = process.argv.includes('--dev');

const buildOptions = {
  entryPoints: {
    'service-worker': 'src/background/service-worker.ts',
    'sidepanel': 'src/sidepanel/sidepanel.ts',
    'content-script': 'src/content/content-script.ts',
    'results-window': 'src/popup/results-window.ts',
    'overlay/index': 'src/overlay/index.tsx',
    'overlay/test-hello-world': 'src/overlay/test-hello-world.js',
    'overlay/content-integration': 'src/overlay/content-integration.ts',
    // Temporary entry points for testing Phase 1 utilities
    'shared/utils/text-processor': 'src/shared/utils/text-processor.ts',
    'shared/utils/tfidf-calculator': 'src/shared/utils/tfidf-calculator.ts'
  },
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  target: 'chrome88',
  sourcemap: isDev,
  minify: !isDev,
  jsx: 'automatic', // Enable React 17+ automatic JSX runtime
  jsxImportSource: 'react', // Use React as JSX import source
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
    // Inject environment variables at build time
    'process.env.INTERCOM_ACCESS_TOKEN': JSON.stringify(process.env.INTERCOM_ACCESS_TOKEN || ''),
    'process.env.OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY || ''),
    'process.env.CLAUDE_API_KEY': JSON.stringify(process.env.CLAUDE_API_KEY || '')
  },
  external: [] // Don't externalize any dependencies for Chrome extension
};

async function copyAssets() {
  // Ensure dist directory exists
  if (!existsSync('dist')) {
    await mkdir('dist', { recursive: true });
  }

  // Copy static files
  const filesToCopy = [
    { from: 'manifest.json', to: 'dist/manifest.json' },
    { from: 'src/sidepanel/sidepanel.html', to: 'dist/sidepanel.html' },
    { from: 'src/sidepanel/sidepanel.css', to: 'dist/sidepanel.css' },
    { from: 'src/popup/results-window.html', to: 'dist/results-window.html' },
    { from: 'src/popup/results-window.css', to: 'dist/results-window.css' },
    { from: 'assets/icons/icon-128.png', to: 'dist/icon-128.png' }
  ];

  for (const file of filesToCopy) {
    try {
      await copyFile(file.from, file.to);
      console.log(`Copied ${file.from} → ${file.to}`);
    } catch (error) {
      console.warn(`Could not copy ${file.from}:`, error.message);
    }
  }
}

async function build() {
  try {
    console.log(`Building in ${isDev ? 'development' : 'production'} mode...`);
    
    await copyAssets();
    
    if (isDev) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();