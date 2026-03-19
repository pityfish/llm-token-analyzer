const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), '.token_usage');
const LOG_FILE = path.join(LOG_DIR, 'token_usage.jsonl');

const PRICING = {
  // Gemini 3 系列 (Preview)
  'gemini-3.1-pro-preview': { p1: 2.00, p2: 4.00, c1: 12.00, c2: 18.00, cache: 0.1, t: 200000 },
  'gemini-3-pro-preview': { p1: 2.00, p2: 4.00, c1: 12.00, c2: 18.00, cache: 0.1, t: 200000 },
  'gemini-3-flash-preview': { p1: 0.50, p2: 0.50, c1: 3.00, c2: 3.00, cache: 0.1, t: 1000000 },
  'gemini-3.1-flash-lite-preview': { p1: 0.25, p2: 0.25, c1: 1.50, c2: 1.50, cache: 0.1, t: 1000000 },
  
  // Gemini 2.5 系列
  'gemini-2.5-pro': { p1: 1.25, p2: 2.50, c1: 10.00, c2: 15.00, cache: 0.1, t: 200000 },
  'gemini-2.5-flash': { p1: 0.30, p2: 0.60, c1: 2.50, c2: 5.00, cache: 0.1, t: 128000 },
  'gemini-2.5-flash-lite': { p1: 0.10, p2: 0.20, c1: 0.40, c2: 0.80, cache: 0.1, t: 128000 },
  'gemini-2.5-flash-lite-preview': { p1: 0.10, p2: 0.20, c1: 0.40, c2: 0.80, cache: 0.1, t: 128000 },
  
  // Gemini 2.0 系列
  'gemini-2.0-flash': { p1: 0.10, p2: 0.20, c1: 0.40, c2: 0.80, cache: 0.1, t: 128000 },
  'gemini-2.0-flash-exp': { p1: 0.10, p2: 0.20, c1: 0.40, c2: 0.80, cache: 0.1, t: 128000 },
  'gemini-2.0-flash-lite': { p1: 0.075, p2: 0.15, c1: 0.30, c2: 0.60, cache: 0.1, t: 128000 },
  'gemini-2.0-flash-lite-preview': { p1: 0.075, p2: 0.15, c1: 0.30, c2: 0.60, cache: 0.1, t: 128000 },
  
  // Gemini 1.5 系列
  'gemini-1.5-pro': { p1: 1.25, p2: 2.50, c1: 5.00, c2: 10.00, cache: 0.1, t: 128000 },
  'gemini-1.5-pro-latest': { p1: 1.25, p2: 2.50, c1: 5.00, c2: 10.00, cache: 0.1, t: 128000 },
  'gemini-1.5-flash': { p1: 0.075, p2: 0.15, c1: 0.30, c2: 0.60, cache: 0.1, t: 128000 },
  'gemini-1.5-flash-latest': { p1: 0.075, p2: 0.15, c1: 0.30, c2: 0.60, cache: 0.1, t: 128000 },
  'gemini-1.5-flash-8b': { p1: 0.0375, p2: 0.075, c1: 0.15, c2: 0.30, cache: 0.1, t: 128000 },
  'gemini-1.5-flash-8b-latest': { p1: 0.0375, p2: 0.075, c1: 0.15, c2: 0.30, cache: 0.1, t: 128000 },
  
  // Gemini 1.0 系列
  'gemini-1.0-pro': { p1: 0.125, p2: 0.125, c1: 0.375, c2: 0.375, cache: 0.1, t: 1000000 },
  
  // 其他
  'claude-3-5-sonnet': { p1: 3.0, p2: 3.0, c1: 15.0, c2: 15.0, cache: 1.0, t: 1000000 }
};

/**
 * 核心计费逻辑：支持自定义阶梯阈值 + 缓存读取折扣
 * p1/c1: <threshold 价格, p2/c2: >threshold 价格
 */
function calculateCost(model, prompt, completion, cached) {
  // 查找最匹配的定价，支持前缀匹配
  const modelKey = Object.keys(PRICING).find(k => model.startsWith(k)) || model;
  const p = PRICING[modelKey] || { p1: 0, p2: 0, c1: 0, c2: 0, cache: 1.0, t: 128000 };
  
  const isLong = prompt > p.t;
  const pPrice = isLong ? p.p2 : p.p1;
  const cPrice = isLong ? p.c2 : p.c1;
  
  const normalPrompt = prompt - cached;
  const cost = (normalPrompt / 1000000) * pPrice + 
               (cached / 1000000) * pPrice * p.cache + 
               (completion / 1000000) * cPrice;
  return cost;
}

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

    const cost = calculateCost(model, prompt, completion, cached);

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
