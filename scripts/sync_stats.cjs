const fs = require('fs');
const path = require('path');
const os = require('os');

// 持久化存储在 ~/.token_usage 目录中
const LOG_DIR = path.join(os.homedir(), '.token_usage');
const LOG_FILE = path.join(LOG_DIR, 'token_usage.jsonl');

function extractTokens(text) {
  const result = {
    model: 'unknown',
    prompt: 0,
    completion: 0,
    thought: 0,
    cached: 0,
    tool: 0
  };

  const inputMatch = text.match(/(Input|Prompt|In):\s*([\d,]+)/i);
  const outputMatch = text.match(/(Output|Completion|Out):\s*([\d,]+)/i);
  const thoughtMatch = text.match(/(Thought|Thinking):\s*([\d,]+)/i);
  const cachedMatch = text.match(/(Cached|Cache):\s*([\d,]+)/i);
  const toolMatch = text.match(/(Tool|Tools):\s*([\d,]+)/i);
  const modelMatch = text.match(/Model:\s*([\w\.\-]+)/i);

  if (inputMatch) result.prompt = parseInt(inputMatch[2].replace(/,/g, ''), 10);
  if (outputMatch) result.completion = parseInt(outputMatch[2].replace(/,/g, ''), 10);
  if (thoughtMatch) result.thought = parseInt(thoughtMatch[2].replace(/,/g, ''), 10);
  if (cachedMatch) result.cached = parseInt(cachedMatch[2].replace(/,/g, ''), 10);
  if (toolMatch) result.tool = parseInt(toolMatch[2].replace(/,/g, ''), 10);
  if (modelMatch) result.model = modelMatch[1];

  return result;
}

function logFromStats(sessionId, sessionTitle, statsText) {
  const data = extractTokens(statsText);
  if (data.prompt === 0 && data.completion === 0) {
    console.error('Failed to parse tokens from input text.');
    return;
  }

  const record = {
    timestamp: new Date().toISOString(),
    start_time: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    session_id: sessionId,
    session_title: sessionTitle || 'Untitled Session',
    model: data.model,
    prompt_tokens: data.prompt,
    completion_tokens: data.completion,
    thought_tokens: data.thought,
    cached_tokens: data.cached,
    tool_tokens: data.tool,
    total_tokens: data.prompt + data.completion + data.thought + data.tool
  };

  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');
    console.log(`✅ Successfully synced stats for Session: [${sessionTitle}]`);
  } catch (err) {
    console.error(`Error writing log: ${err.message}`);
  }
}

const [,, sessionId, sessionTitle, ...rest] = process.argv;
const statsText = rest.join(' ');
logFromStats(sessionId, sessionTitle, statsText);
