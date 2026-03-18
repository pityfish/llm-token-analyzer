const { spawn } = require('child_process');

const server = spawn('node', ['scripts/mcp_server.bundle.cjs'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

setTimeout(() => {
  console.log("Timeout waiting for response!");
  server.kill();
  process.exit(1);
}, 3000);

server.stdout.on('data', (data) => {
  console.log(`Received: ${data}`);
  const lines = data.toString().split('\n');
  lines.forEach(line => {
      if (!line.trim()) return;
      try {
          const res = JSON.parse(line);
          console.log("Parsed JSON:", res);
          if (res.id === 1) {
              console.log("Got init result, tearing down");
              server.kill();
              process.exit(0);
          }
      } catch (e) {
      }
  })
});

const initReq = {
    jsonrpc: "2.0",
    method: "initialize",
    id: 1,
    params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1" }
    }
};

console.log("Sending init request...");
server.stdin.write(JSON.stringify(initReq) + '\n');
