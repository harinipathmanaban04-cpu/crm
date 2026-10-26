const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '⚡ Starting Eco CRM: Server (port 5000) + Client (port 5173)...');

// 1. Start backend server
const server = spawn(npmCmd, ['run', 'dev', '--prefix', 'server'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
});

// 2. Start frontend client
const client = spawn(npmCmd, ['run', 'dev', '--prefix', 'client'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
});

function shutdown() {
  try {
    if (isWin) {
      if (server.pid) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
      if (client.pid) spawn('taskkill', ['/pid', String(client.pid), '/T', '/F']);
    } else {
      server.kill('SIGINT');
      client.kill('SIGINT');
    }
  } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
