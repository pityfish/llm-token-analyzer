const fs = require('fs');
const path = require('path');
const os = require('os');

// 持久化存储在 ~/.token_usage 目录中
const LOG_DIR = path.join(os.homedir(), '.token_usage');
const LOG_FILE = path.join(LOG_DIR, 'token_usage.jsonl');

function logTokenUsage(sessionId, sessionTitle, model, prompt, completion, thought = 0, cached = 0, tool = 0) {
  if (!sessionId || !model || isNaN(prompt) || isNaN(completion)) {
    console.error('Usage: node log_token.cjs <session_id> <session_title> <model> <prompt> <completion> [thought] [cached] [tool]');
    process.exit(1);
  }

  const record = {
    timestamp: new Date().toISOString(),
    start_time: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    session_id: sessionId,
    session_title: sessionTitle || 'Untitled Session',
    model: model,
    prompt_tokens: parseInt(prompt, 10),
    completion_tokens: parseInt(completion, 10),
    thought_tokens: parseInt(thought, 10),
    cached_tokens: parseInt(cached, 10),
    tool_tokens: parseInt(tool, 10),
    total_tokens: parseInt(prompt, 10) + parseInt(completion, 10) + parseInt(thought, 10) + parseInt(tool, 10)
  };

  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');
    console.log(`Successfully logged usage for Session: [${sessionTitle}] (${model})`);
  } catch (err) {
    console.error(`Failed to log token usage: ${err.message}`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length < 5) {
    process.exit(1);
}

logTokenUsage(...args);
