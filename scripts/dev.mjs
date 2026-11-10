import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('🚀 Starting Media Downloader (Backend on :4000, Frontend on :5173)...');

const backend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'backend'),
  stdio: 'inherit',
  shell: isWin,
});

const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'frontend'),
  stdio: 'inherit',
  shell: isWin,
});

let isShuttingDown = false;

function killProcess(child) {
  if (!child || child.killed || !child.pid) return;
  if (isWin) {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // Process already terminated
    }
  } else {
    try {
      child.kill('SIGTERM');
    } catch {
      // Process already terminated
    }
  }
}

function cleanup(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n🛑 Shutting down servers...');
  killProcess(backend);
  killProcess(frontend);
  process.exit(exitCode);
}

backend.on('exit', (code) => {
  if (!isShuttingDown && code !== 0 && code !== null) {
    console.error(`\n⚠️  Backend service exited with code ${code}`);
    cleanup(code);
  }
});

frontend.on('exit', (code) => {
  if (!isShuttingDown && code !== 0 && code !== null) {
    console.error(`\n⚠️  Frontend service exited with code ${code}`);
    cleanup(code);
  }
});

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));
