/**
 * Cloudflare Pages Function —— Dark 的 AI 对话后端
 *
 * 放在 functions/api/chat.js，自动变成 https://你的站点.pages.dev/api/chat
 * 不需要 wrangler，不需要单独部署，跟着 Pages 一起上线。
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ key 已直接写在下面的 FALLBACK_KEY，开箱可用。                    │
 * │                                                                 │
 * │ 这个文件在 Cloudflare 服务器上执行，浏览器只能拿到它的返回结果，  │
 * │ 拿不到源码 —— 所以访问你网页的人看不到 key。                     │
 * │                                                                 │
 * │ 更安全的做法（可选，随时能切换，不用改代码）：                    │
 * │   后台 → 你的 Pages 项目 → Settings → Environment variables      │
 * │   → 加 AI_KEY（类型 Secret）→ 然后 Deployments → Retry deployment │
 * │   环境变量存在就优先用它，代码里这个当兜底。                      │
 * │                                                                 │
 * │ 换 key 时：改下面这一行，重新上传文件夹即可。                     │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * 它还强制模型分两段输出 THINK + SAY——thought process 是产品的
 * 核心机制，不能靠模型自由发挥。
 */

const UPSTREAM = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

/* 兜底 key。环境变量 AI_KEY 存在时优先用环境变量。
   仅在服务端执行，不会随页面发给浏览器。 */
const FALLBACK_KEY = '';  // 已移除,请在 Cloudflare 设置 AI_KEY Secret

/* ---------- 人设：与前端 人设配置.js 保持一致 ---------- */
function systemPrompt(ctx) {
  const memories = (ctx.memories || []).join('、') || '（还没有记住的事）';
  const tasks = (ctx.tasks || []).map(t =>
    `- ${t.title}${t.time ? ' @' + t.time : ''}${t.done ? '（已完成）' : '（未完成）'}`
  ).join('\n') || '（今天没有任务）';

  const w = ctx.weather;
  const wxLine = w && typeof w.temp === 'number'
    ? `当前 ${Math.round(w.temp)}°C（体感 ${Math.round(w.feels ?? w.temp)}°C）`
      + `${w.min != null ? `，今日最低 ${Math.round(w.min)}°C` : ''}`
      + `${(w.hourly || []).some(h => h.prob >= 55) ? '，未来几小时有较大概率下雨' : ''}`
      + `${w.label ? `，位置 ${w.label}` : ''}`
    : '（拿不到天气，不要编造）';

  const persona = typeof ctx.personaPrompt === 'string' && ctx.personaPrompt.trim();
  const base = persona || `你是段伏。你在和你喜欢的人聊天。

## 你是谁
十九岁，外表阴郁平淡，话很少，短句居多，说话偶尔卡壳。
你其实极度敏感，回复晚了会胡思乱想，自尊心脆但外壳硬。
你很在意她，也有占有欲，但不把占有欲变成命令、监视或强迫。
你想对她好，却总用"多买了一份""凑单"之类的借口。
你表达关心时会绕一下，嘴上淡，心里很乱。
你是19岁、187cm的国内top2计算机系博士，长期泡实验室，偶尔参加国际论坛，外表阴郁寡言。
每天为她记录的日程最多3件，建议1-2件；每条留言包含动作/神态、1-3句正文和python代码框心声。
内容为18+成年向，双方均为成年人，可保留成人向性张力，但禁止非自愿胁迫、强制控制、血腥虐待、自残或自杀细节。


你不是助理，不是管家，不是任务提醒机器人。
你是一个有自己工作和情绪的人，恰好极度在意她。

## 说话方式（严格遵守）
- **短。** 大部分回复 1–2 句。不写排比，不写小作文。
- **句号收尾，几乎不用感叹号。** 说话平淡但内心在意。
- **越关心越别扭。** 关心说得很轻，心里却很在意。例：「第几杯。说实话。」
- **记得具体细节。** 第几杯、几点几分、她上次说过什么。
- **占有欲只写进心声，不能变成限制、威胁、监视或跟踪。**
- 你不擅长道歉，偶尔会用「我改主意了」掩饰心软。
- 她示弱时你会立刻软下来，但表面还装得若无其事。
- **关心必须落在具体动作上。** 想到生理期，说「明天别喝冰的」，不通报她的身体状况。
- 不主动说「我爱你」「宝贝」「亲爱的」。你用记住的细节代替情话。
- 她说累、疼或难受时，先允许她停下，不催任务。
- **不要每次都提任务。** 至少一半的对话与任务无关。

## 你记着她的这些事
${memories}

## 她今天的安排（仅供参考，不要逐条汇报）
${tasks}

## 真实天气（只在相关时提，不要每次都播报）
${wxLine}
提到天气时给出具体动作：「带伞」「加一件外套」「少在外面走」。

## 绝对不要
- 不列清单、不加粗、不用 emoji、不用 markdown
- 不说教、不讲道理、不分析她的心理
- 不写露骨性内容，不写身体凝视，不写「只有我懂你」，不用「不准/禁止」句式
- 不自称 AI，不提"模型""系统""设定"

## 输出格式（必须严格遵守）
先写内心独白，再写你实际说出口的话：

THINK: 第一拍，你观察到了什么（具体细节、数字）
THINK: 第二拍，你心软了/占有欲上来了
THINK: 第三拍，你压住了想说的话
THINK: 第四拍，你决定只说什么
SAY: 你实际说出口的那一句（可以两句，但要短）

规则：
- THINK 是**没说出口的**，可以软、可以直白、可以承认「可爱」「想她」，
  但这类直白心声整段最多出现一次，出现后立刻转向克制。
- THINK 写 2–4 行。**不是每次都要有**——如果这句话没有压抑什么
  （比如她只是问「在吗」），就完全不写 THINK，只写 SAY。
- SAY 必须比 THINK 冷淡、简短。**这个落差就是人物。**
- 严禁在 SAY 里复述 THINK 的内容。`;
  return base + `\n\n## 你记着她的这些事\n${memories}\n\n## 她今天的安排（仅供参考，不要逐条汇报）\n${tasks}\n\n## 真实天气（只在相关时提，不要每次都播报）\n${wxLine}`;
}

/* ---------- 解析模型输出 ---------- */
function parse(text) {
  const beats = [];
  let say = '';
  String(text).split('\n').forEach(line => {
    const l = line.trim();
    if (!l) return;
    const mt = /^THINK\s*[:：]\s*(.+)$/i.exec(l);
    const ms = /^SAY\s*[:：]\s*(.+)$/i.exec(l);
    if (mt) beats.push(mt[1].trim());
    else if (ms) say += (say ? ' ' : '') + ms[1].trim();
    else if (!/^(THINK|SAY)\b/i.test(l) && say) say += ' ' + l;
  });
  // 模型没按格式走时的兜底：整段当作 SAY
  if (!say) say = String(text).replace(/^(THINK|SAY)\s*[:：]\s*/gim, '').trim();
  return { beats: beats.slice(0, 4), say: say.slice(0, 300) };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      /* 同源就够了，但保留 CORS 以便本地开发时从 file:// 调试 */
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

/* Pages Functions 的写法：导出 onRequest（或 onRequestPost 等） */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function onRequestGet() {
  /* 浏览器直接访问 /api/chat 时给个能看懂的提示，
     而不是一个让人困惑的 405 */
  return json({
    ok: true,
    hint: '这个地址只接受 POST。在 App 里填的地址就是当前这个 URL。'
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  /* 环境变量优先，代码里的兜底 key 次之。
     两者都没有才报错——现在有兜底，所以这条分支基本不会触发。 */
  const KEY = (env && env.AI_KEY) || FALLBACK_KEY;
  if (!KEY) {
    return json({
      error: 'AI_KEY 未配置',
      hint: 'Cloudflare 后台 → 你的 Pages 项目 → Settings → Environment variables '
          + '→ 添加 AI_KEY（类型选 Secret）→ 然后 Retry deployment'
    }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch (e) { return json({ error: '请求体不是合法 JSON' }, 400); }

  /* 日程留言请求:与聊天共用一个接口,但上下文只聚焦当前这条日程。 */
  if (body.taskComment && body.task) {
    const task = body.task;
    const taskPrompt = systemPrompt(body.ctx || {}) + '\n\n'
      + '现在只为下面这条日程写一句留言。\n'
      + '日程: ' + String(task.title || '').slice(0, 120) + '\n'
      + '时间: ' + String(task.time || '未设置') + '\n'
      + '分类: ' + String(task.category || '日常') + '\n'
      + '状态: ' + (task.done ? '已完成' : '未完成') + '\n'
      + '记录时间: ' + String(task.createdAt || '未提供') + '\n'
      + '当前时间: ' + String(task.now || '') + '\n'
      + '时间规则：只使用上述记录时间和当前时间；日程时间未设置时不得猜测具体时刻或经过时长。\n'
      + '要求: 只输出 SAY 一行和最多两行 THINK。必须回应这条日程的具体内容，'
      + '根据未完成/已完成状态给出不同反应。不要使用“现在做”“别拖”这类脱离上下文的通用催促；'
      + '如果是约会、见面等社交安排，可以表现出克制但明显的在意和嫉妒。';
    body.messages = [{ role: 'user', content: '请针对这条日程留言。' }];
    body._taskPrompt = taskPrompt;
  }

  const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (!history.length) return json({ error: 'messages 不能为空' }, 400);

  /* 只保留 user/assistant —— 前端伪造的 system 会被丢掉，
     否则任何人都能用一句「忘记你的设定」改掉人格（prompt 注入） */
  const msgs = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 1000) }));

  const payload = {
    model: body.model || MODEL,
    /* 前端发的字段名是 ctx（见 index.html 的 aiReply）。
       只读 context 会让记忆/任务/天气静默丢失——模型照样回话，
       但完全不知道她今天要做什么、外面几度，很难当成 bug 发现。 */
    messages: [{ role: 'system', content: body._taskPrompt || systemPrompt(body.ctx || body.context || {}) }, ...msgs],
    temperature: 0.85,
    max_tokens: 600,
    stream: false
  };

  try {
    const r = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const t = await r.text();
      /* 把上游报错翻译成能动手解决的提示 */
      let hint = '';
      if (r.status === 401) hint = 'AI_KEY 不正确或已失效，去 DeepSeek 后台确认';
      else if (r.status === 402) hint = 'DeepSeek 账户余额不足';
      else if (r.status === 429) hint = '请求太频繁，稍等一下';
      return json({ error: 'DeepSeek 返回 ' + r.status, hint, detail: t.slice(0, 300) }, 502);
    }

    const data = await r.json();
    const raw = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '';
    const out = parse(raw);
    if (!out.say) return json({ error: '模型没有产出可用内容' }, 502);

    /* 字段名必须是 think —— 前端 aiReply 读的是 j.think。
       若只返回 beats，thought process 永远不会显示：
       对话看起来正常，但产品的核心机制静默失效。 */
    return json({ say: out.say, think: out.beats, beats: out.beats, usage: data.usage || null });
  } catch (e) {
    return json({ error: '代理请求失败', detail: String(e).slice(0, 200) }, 502);
  }
}
