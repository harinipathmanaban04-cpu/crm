const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '⚡ Starting Eco CRM: Server (port 5000) + Client (port 5173)...');

let server = null;
let client = null;
let shuttingDown = false;

function startServer() {
  if (shuttingDown) return;
  server = spawn('node', ['src/index.js'], {
    cwd: path.join(__dirname, 'server'),
    stdio: 'inherit',
    shell: true,
  });

  server.on('exit', (code) => {
    if (!shuttingDown) {
      console.warn(`\x1b[33m%s\x1b[0m`, `⚠️ Backend server process stopped (code ${code}). Auto-restarting in 1s...`);
      setTimeout(startServer, 1000);
    }
  });
}

startServer();

function startClient() {
  if (shuttingDown || client) return;
  client = spawn(npmCmd, ['run', 'dev', '--prefix', 'client'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
  });
  client.on('exit', (code) => {
    if (!shuttingDown) console.log(`Client exited with code ${code}`);
  });
}

async function waitForServer() {
  const url = 'http://127.0.0.1:5000/api/health';
  for (let i = 0; i < 60; i++) {
    if (shuttingDown) return;
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log('\x1b[32m%s\x1b[0m', '✅ Backend is ready; starting client...');
        startClient();
        return;
      }
    } catch (_) {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error('❌ Backend did not become ready in time; starting client anyway.');
  startClient();
}

// Only wait if global fetch is available (Node 18+); otherwise start immediately.
if (typeof fetch === 'function') {
  waitForServer();
} else {
  setTimeout(startClient, 1500);
}

function shutdown() {
  shuttingDown = true;
  try {
    if (isWin) {
      if (server && server.pid) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
      if (client && client.pid) spawn('taskkill', ['/pid', String(client.pid), '/T', '/F']);
    } else {
      if (server) server.kill('SIGINT');
      if (client) client.kill('SIGINT');
    }
  } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
