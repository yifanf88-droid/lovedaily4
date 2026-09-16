# Cloudflare Pages 部署 + 接入 DeepSeek

## 你遇到的问题：拿到的是 Workers 地址，不是 Pages 地址

你得到的：`lovelovedaily.yifanf88.**workers**.dev`
应该是：`lovelovedaily.**pages**.dev`

**这是 Cloudflare 上两个不同的产品**，入口挨得很近，很容易点错：

- **Workers** —— 写后端代码的，域名是 `*.workers.dev`
- **Pages** —— 传静态网站的，域名是 `*.pages.dev`

### 而且 workers.dev 在国内打不开

我查了 DNS：

```
lovelovedaily.yifanf88.workers.dev → 168.143.171.186
                                   → 2a03:2880:...:face:b00c
```

`face:b00c` 是 **Meta/Facebook 的 IPv6 标志段** —— 这不是 Cloudflare 的地址（Cloudflare 是 `104.16.x`）。**`workers.dev` 这个域名被 DNS 污染了，所以解析到错误 IP、打不开。**

对比：`pages.dev` 从国内访问**正常**（实测返回 301）。

> **结论：必须用 `pages.dev`。`workers.dev` 在国内基本用不了。**

---

## 正确的部署步骤

### 1. 删掉之前建错的项目

Cloudflare 后台 → **Workers & Pages** → 找到 `lovelovedaily` → 进去 → Settings → 最下面 **Delete**。

### 2. 重新建，这次选 Pages

**Workers & Pages** → **Create** → 上方有两个标签，**点 `Pages`** → **Upload assets**

> 关键：确认你点的是 **Pages** 标签，不是默认的 Workers。

### 3. 上传

项目名随便起（比如 `lovelovedaily`），然后把 **`app/dark` 整个文件夹**拖进去。

拖之前可以删掉这几个不需要上传的（留着也不影响）：

```
make-icons.py       打包工具，服务器不需要
make-standalone.py  打包工具
serve-lan.sh        本地脚本
*.md                说明文档
dark-standalone.html  单文件版，Pages 上用不着
```

**必须包含的**：

```
index.html
dark-voice.js
sw.js
manifest.webmanifest
icons/          （5 个 png）
functions/      ← 关键！DeepSeek 后端就在这里
  api/
    chat.js
```

点 **Deploy**，得到 `https://xxxx.pages.dev`。

---

## 加 DeepSeek：只需在后台填一个环境变量

**好消息：不用装 wrangler，不用命令行，也不用在 App 里填地址。**

Pages 自带后端函数能力。`functions/api/chat.js` 会自动变成 `你的站点.pages.dev/api/chat`，而 App **会自己发现它**。

### 填 key（唯一需要你做的事）

1. Cloudflare 后台 → 你的 Pages 项目 → **Settings**
2. 找到 **Environment variables** → **Add variable**
3. 填：

| 字段 | 值 |
|---|---|
| Variable name | `AI_KEY` |
| Value | 你的 DeepSeek key（`sk-` 开头那串） |
| Type | **选 Secret**（加密，之后看不到明文） |

4. **Save**
5. ⚠️ **去 Deployments 标签，点最新那次部署的 `⋯` → Retry deployment**

> **第 5 步不能跳过。** 环境变量只在部署时注入，不重新部署一次就还是读不到 key。这是最容易漏的一步。

### 完成

手机打开 `https://你的站点.pages.dev` → 添加到主屏幕。

进 **我的 → AI 对话**，如果显示：

> **已接入 · 本站 /api/chat（无需配置）**

就说明成好了。**不用填任何地址。**

---

## 怎么确认真的接上了

### 方法一：看对话

对话页发 `我好累啊`。

- **接上了**：每次回复不一样，会提到你今天的具体任务或当前天气
- **没接上**：回复是固定那几句，且会弹提示「AI 没有响应，已用内置人格回复」

### 方法二：直接在浏览器开这个地址

```
https://你的站点.pages.dev/api/chat
```

正常会看到：

```json
{"ok":true,"hint":"这个地址只接受 POST。在 App 里填的地址就是当前这个 URL。"}
```

- 看到这个 → **函数部署成功了**
- 看到 404 → `functions` 文件夹没上传上去
- 看到 `AI_KEY 未配置` → 环境变量没填，或者填完没 Retry deployment

---

## 出问题怎么查

| 现象 | 原因 | 怎么办 |
|---|---|---|
| 我的页显示「未接入」 | `functions/` 没上传 | 重新上传，确认包含 `functions/api/chat.js` |
| `/api/chat` 返回 `AI_KEY 未配置` | 变量没填或没重新部署 | 填 `AI_KEY` → **Retry deployment** |
| 提示「AI 没有响应」 | key 错了 / 余额不足 | 直接开 `/api/chat` 看不到具体原因的话，用下面的 curl |
| 域名是 `workers.dev` | 建项目时选错产品 | 删掉重建，选 **Pages** 标签 |

想看具体报错，在电脑终端里跑：

```bash
curl -X POST https://你的站点.pages.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"测试"}]}'
```

后端会把 DeepSeek 的错误翻译成能动手解决的提示：

- `AI_KEY 不正确或已失效，去 DeepSeek 后台确认`
- `DeepSeek 账户余额不足`
- `请求太频繁，稍等一下`

---

## AI 挂了不会影响使用

前端有回退：请求失败会自动用内置人格回复，并提示你。**不会白屏，不会一直转圈。**

这一点我测过三种故障：key 没配、key 错误、`functions` 目录缺失——三种情况下 App 都正常出回复，只是回复来自内置规则。

---

## Dark 的人设已经在里面了

`functions/api/chat.js` 里包含完整设定，你不用写提示词：

- 占有欲爆棚的金融精英，说话不疾不徐，越温柔越危险
- 句号收尾，几乎不用感叹号
- 占有欲落在「记录」上而不是「限制」上（说「我知道」，不说「不准去」）
- 绝不说对不起，但很好哄
- 关心落在具体动作上（说「明天别喝冰的」，**不说**「你要来经期了」）

还会把这些真实信息喂给模型：

- 你今天的任务和完成情况
- 当前温度、体感、今日最低温、未来几小时降雨概率、你所在位置

所以他能说「带伞。18 点开始下，概率 77%」—— **数字是真的**。

同时**强制模型分两段输出** `THINK`（四拍内心独白）+ `SAY`（实际说的），thought process 才会显示。

### 想改他说话风格

改 `functions/api/chat.js` 里 `systemPrompt` 那段，重新上传文件夹即可。

---

## 花多少钱

- **Cloudflare Pages**：免费。静态请求无限，函数每天 10 万次
- **DeepSeek**：约 1 元 / 100 万 token，一次对话约 1500 token → **几千次对话一块钱**

---

## 验证情况

我在本地起了一个模拟 Pages 的环境（静态文件 + `/api/chat` 函数），用真实浏览器跑过：

**正常路径 16 项全过**：

- App 自动发现同站后端，`aiHere` 自动置位，**未手填任何地址**
- 我的页正确显示「已接入 · 本站 /api/chat」
- 对话回复确实来自模型（用固定标记内容验证，排除了内置规则）
- thought process 四拍、能展开、位于话语上方、内容来自模型
- 返回字段是 `think`（前端读的就是这个名，字段名错了会静默失效）
- `GET /api/chat` 返回可读提示而不是让人困惑的 405

**故障路径 3 种场景全过**：key 未配置 / key 错误(401) / 无 functions 目录 —— 都能优雅回退到内置人格，不卡死、不报未处理错误，401 时后端返回 502 并给出「AI_KEY 不正确或已失效」的可操作提示。
