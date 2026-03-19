const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), '.token_usage');
const LOG_FILE = path.join(LOG_DIR, 'token_usage.jsonl');
const TMP_ROOT = path.join(os.homedir(), '.gemini', 'tmp');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function findChatsDirectories(dir, results = new Set()) {
  if (!fs.existsSync(dir)) return results;
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.resolve(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          if (file === 'chats') {
            results.add(fullPath);
          } else if (!fullPath.includes('node_modules') && !fullPath.includes('.git')) {
            findChatsDirectories(fullPath, results);
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
  return results;
}

/**
 * 增强型标题生成：从对话内容深度提取摘要
 */
function getSmartTitle(chatData) {
  // 1. 优先使用官方 summary
  if (chatData.summary && chatData.summary.trim()) return chatData.summary.trim();

  // 2. 深度扫描：聚合所有用户消息
  const userMessages = chatData.messages
    .filter(m => m.type === 'user')
    .map(m => (m.content && m.content[0] && m.content[0].text) || '')
    .filter(text => text.length > 0);

  if (userMessages.length > 0) {
    // 拼接前几条消息以获取上下文，但优先保留第一条
    const combined = userMessages.join(' | ');
    if (combined.trim().length > 0) {
      return combined.substring(0, 80).replace(/\r?\n/g, ' ').trim();
    }
  }

  // 3. 兜底方案：使用时间戳和模型信息
  const date = new Date(chatData.startTime).toLocaleDateString();
  const models = Array.from(new Set(chatData.messages.filter(m => m.model).map(m => m.model))).join(', ');
  return `Chat on ${date} [${models || 'Unknown Model'}]`;
}

function syncAll() {
  console.log('🔍 Running Smart Sync V5.7 (Enhanced Title Generation)...');
  const chatDirs = findChatsDirectories(TMP_ROOT);
  const sessionMessages = new Map(); 
  const sessionMeta = new Map();

  chatDirs.forEach(dir => {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      files.forEach(f => {
        try {
          const chatData = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
          const sid = chatData.sessionId;
          
          // 严格修复：必须有 sessionId 且不是当前同步指令产生的临时文件
          if (!sid || !chatData.messages || chatData.messages.length === 0) return;
          
          // 忽略正在运行同步指令的会话 (防止自指)
          // 检查用户的第一条消息内容
          const firstUserMsg = chatData.messages.find(m => m.type === 'user')?.content?.[0]?.text || '';
          if (firstUserMsg.includes('请执行同步脚本') || firstUserMsg.includes('/tokens:sync')) return;

          if (!sessionMessages.has(sid)) {
            sessionMessages.set(sid, new Map());
            sessionMeta.set(sid, { 
              startTime: chatData.startTime, 
              lastUpdated: chatData.lastUpdated,
              chatData: chatData // 保存一份引用用于标题提取
            });
          }

          const meta = sessionMeta.get(sid);
          if (new Date(chatData.startTime) < new Date(meta.startTime)) meta.startTime = chatData.startTime;
          if (new Date(chatData.lastUpdated) > new Date(meta.lastUpdated)) meta.lastUpdated = chatData.lastUpdated;

          chatData.messages.forEach(msg => {
            if (msg.id) {
              const msgMap = sessionMessages.get(sid);
              if (!msgMap.has(msg.id)) msgMap.set(msg.id, msg);
            }
          });
        } catch (e) {}
      });
    } catch (e) {}
  });

  let sessionLastUpdateMap = new Map();
  if (fs.existsSync(LOG_FILE)) {
    const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
    lines.forEach(l => {
      if (!l) return;
      try {
        const r = JSON.parse(l);
        // 强化字段解析：兼容旧格式，优先驼峰
        const sid = r.sessionId || r.session_id;
        const lut = r.sessionLastUpdated || r.lastUpdated || r.last_updated;
        if (!sid) return;
        const existing = sessionLastUpdateMap.get(sid);
        if (!existing || new Date(lut) > new Date(existing)) {
          sessionLastUpdateMap.set(sid, lut);
        }
      } catch(e) {}
    });
  }
  console.log(`📊 Loaded ${sessionLastUpdateMap.size} sessions from existing logs.`);

  let syncedSessions = new Set();
  let updatedSessions = new Set();
  let sessionDetails = [];

  sessionMessages.forEach((msgMap, sid) => {
    const meta = sessionMeta.get(sid);
    const prevLastUpdated = sessionLastUpdateMap.get(sid);

    // 关键修复：确保新数据的时间戳真的比已记录的数据新
    const isNew = !prevLastUpdated;
    const isUpdate = prevLastUpdated && new Date(meta.lastUpdated) > new Date(prevLastUpdated);

    if (isNew || isUpdate) {
      const modelStats = {};
      msgMap.forEach(msg => {
        if (msg.type === 'gemini' && msg.tokens) {
          const model = msg.model || 'unknown';
          if (!modelStats[model]) {
            modelStats[model] = { prompt: 0, completion: 0, thought: 0, cached: 0, tool: 0, total: 0 };
          }
          modelStats[model].prompt += (msg.tokens.input || 0);
          modelStats[model].completion += (msg.tokens.output || 0);
          modelStats[model].thought += (msg.tokens.thoughts || 0);
          modelStats[model].cached += (msg.tokens.cached || 0);
          modelStats[model].tool += (msg.tokens.tool || 0);
          const roundTotal = msg.tokens.total || (msg.tokens.input + msg.tokens.output + (msg.tokens.thoughts || 0) + (msg.tokens.tool || 0));
          modelStats[model].total += roundTotal;
        }
      });

      const modelEntries = Object.entries(modelStats);
      if (modelEntries.length === 0) return; // 关键修复：如果没有有效的 Token 消耗，直接跳过，不计入统计

      const finalTitle = getSmartTitle(meta.chatData);
      
      if (isNew) {
        syncedSessions.add(sid);
      } else {
        updatedSessions.add(sid);
      }
      sessionDetails.push(`- [${sid.substring(0,8)}] ${finalTitle}`);

      modelEntries.forEach(([model, stats]) => {
        const record = {
          syncedAt: new Date().toISOString(),
          sessionId: sid,
          sessionTitle: finalTitle,
          sessionStartTime: meta.startTime,
          sessionLastUpdated: meta.lastUpdated,
          model: model,
          promptTokens: stats.prompt,
          completionTokens: stats.completion,
          thoughtTokens: stats.thought,
          cachedTokens: stats.cached,
          toolTokens: stats.tool,
          totalTokens: stats.total 
        };
        fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');
      });
    }
  });

  console.log(`✅ Sync complete! New: ${syncedSessions.size}, Updates: ${updatedSessions.size}`);
  if (sessionDetails.length > 0) {
    console.log('\nModified Sessions:');
    sessionDetails.forEach(d => console.log(d));
  }
}

syncAll();
