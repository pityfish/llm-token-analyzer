const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), '.token_usage');
const LOG_FILE = path.join(LOG_DIR, 'token_usage.jsonl');

const PRICING = {
  'gemini-3.1-pro-preview': { prompt: 1.25, completion: 3.75 },
  'gemini-3-pro-preview': { prompt: 1.25, completion: 3.75 },
  'gemini-3-flash-preview': { prompt: 0.1, completion: 0.4 },
  'gemini-2.5-pro': { prompt: 1.25, completion: 3.75 },
  'gemini-2.5-flash': { prompt: 0.1, completion: 0.4 },
  'gemini-2.5-flash-lite': { prompt: 0.075, completion: 0.3 },
  'gemini-1.5-pro': { prompt: 1.25, completion: 3.75 },
  'gemini-1.5-pro-latest': { prompt: 1.25, completion: 3.75 },
  'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },
  'claude-3-5-sonnet': { prompt: 3.0, completion: 15.0 }
};

function formatCurrency(amount) {
  return `$${amount.toFixed(4)}`;
}

function drawBar(value, total, width = 20) {
  const percent = total > 0 ? (value / total) : 0;
  const filled = Math.round(width * percent);
  return '█'.repeat(filled) + '░'.repeat(width - filled) + ` ${Math.round(percent * 100)}%`;
}

function analyzeTokenUsage() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`No usage data found at ${LOG_FILE}`);
    return;
  }

  const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
  const allRecords = lines.map(line => JSON.parse(line));

  const sessionModelMap = new Map();
  allRecords.forEach(r => {
    const sid = r.sessionId || r.session_id;
    const model = r.model;
    const lut = r.sessionLastUpdated || r.lastUpdated || r.last_updated;
    const key = `${sid}_${model}`;
    const existing = sessionModelMap.get(key);
    
    if (!existing || new Date(lut) > new Date(existing.sessionLastUpdated || existing.lastUpdated || existing.last_updated)) {
      sessionModelMap.set(key, r);
    }
  });

  const records = Array.from(sessionModelMap.values());
  const sessions = {};
  const modelAggregation = {};
  let globalTotal = { prompt: 0, completion: 0, thought: 0, cached: 0, tool: 0, cost: 0, tokens: 0 };

  records.forEach(rec => {
    const sid = rec.sessionId || rec.session_id;
    const title = rec.sessionTitle || rec.session_title;
    const model = rec.model;
    const prompt = rec.promptTokens || rec.prompt_tokens || 0;
    const completion = rec.completionTokens || rec.completion_tokens || 0;
    const thought = rec.thoughtTokens || rec.thought_tokens || 0;
    const cached = rec.cachedTokens || rec.cached_tokens || 0;
    const tool = rec.toolTokens || rec.tool_tokens || 0;
    const total = rec.totalTokens || rec.total_tokens || 0;
    const startTime = rec.sessionStartTime || rec.startTime || rec.start_time;
    const lastUpdated = rec.sessionLastUpdated || rec.lastUpdated || rec.last_updated;

    if (!sessions[sid]) {
      sessions[sid] = { title, startTime, lastUpdated, models: {}, total_cost: 0 };
    }

    if (!sessions[sid].models[model]) {
      sessions[sid].models[model] = { prompt: 0, completion: 0, thought: 0, cached: 0, tool: 0, cost: 0 };
    }

    const pricing = PRICING[model] || { prompt: 0, completion: 0 };
    const cost = (prompt / 1000000) * pricing.prompt + (completion / 1000000) * pricing.completion;

    sessions[sid].models[model].prompt += prompt;
    sessions[sid].models[model].completion += completion;
    sessions[sid].models[model].thought += thought;
    sessions[sid].models[model].cached += cached;
    sessions[sid].models[model].tool += tool;
    sessions[sid].models[model].cost += cost;
    sessions[sid].total_cost += cost;

    if (!modelAggregation[model]) modelAggregation[model] = 0;
    modelAggregation[model] += total;

    globalTotal.prompt += prompt;
    globalTotal.completion += completion;
    globalTotal.thought += thought;
    globalTotal.cached += cached;
    globalTotal.tool += tool;
    globalTotal.cost += cost;
    globalTotal.tokens += total;
  });

  const uniqueSessionCount = Object.keys(sessions).length;

  console.log('\n--- LLM Token Usage Analysis Report (V5.9) ---');
  console.log(`Total Unique Sessions: ${uniqueSessionCount}`);
  console.log(`Overall Total Estimated Cost: ${formatCurrency(globalTotal.cost)}`);

  console.log('\n--- Model Distribution ---');
  Object.entries(modelAggregation).sort((a,b) => b[1] - a[1]).forEach(([model, val]) => {
    console.log(`${model.padEnd(25)}: ${drawBar(val, globalTotal.tokens)} (${val.toLocaleString()} tokens)`);
  });

  console.log('\n--- Global Aggregated Stats ---');
  console.log(`Total Prompt:     ${globalTotal.prompt.toLocaleString()}`);
  console.log(`Total Completion: ${globalTotal.completion.toLocaleString()}`);
  console.log(`Total Thought:    ${globalTotal.thought.toLocaleString()}`);
  console.log(`Total Cached:     ${globalTotal.cached.toLocaleString()}`);
  console.log(`Total Cost:       ${formatCurrency(globalTotal.cost)}`);
}

analyzeTokenUsage();
