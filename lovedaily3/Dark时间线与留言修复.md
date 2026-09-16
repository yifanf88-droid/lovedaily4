# 念念日程 · Dark 时间线与留言修复

## ✅ 已完成的修复（2处）

### 修复 1：Dark 留言不重复

**问题**：Dark 的提醒和表扬话术会永久缓存，导致每次看到的都是同一句话，失去了人格的生动感。

**原因**：`said()` 函数缓存机制没有过期时间
```javascript
// 修复前
if (S.said[k]) return S.said[k];  // 永久缓存，今天、明天、后天都是这句
```

**修复方案**：
```javascript
// 修复后（第 773-781 行）
function said(task, mode, ctx) {
  var k = mode + ':' + task.id;
  /* 检查缓存：如果已缓存且是今天的，复用；否则重新抽取（避免留言重复） */
  if (S.said[k] && S.said[k].day === S.day) return S.said[k];
  var v = mode === 'praise' ? Dark.praise(task, ctx) : Dark.remind(task, ctx);
  if (v) v.day = S.day;  /* 标记生成日期 */
  S.said[k] = v || { none: 1, day: S.day };
  save();
  return S.said[k];
}
```

**效果**：
- ✅ **同一天内**：相同任务的留言保持一致（避免刷新就换话）
- ✅ **跨天后**：会从话术库重新抽取新的话（`S.day` 变化 → 缓存失效）
- ✅ **示例**：今天 Dark 说"这件事你能做完"，明天可能换成"我知道你做得到"

---

### 修复 2：Dark 日程符合时间线

**问题**：Dark 的 5 个日程（晨间会议、投行通话...）是硬编码的 `on` 状态，下午 5 点后看他的页面，上午的任务还显示"未完成"，不符合时间逻辑。

**原因**：`HIS` 数组的 `on` 字段是静态写死的
```javascript
// 修复前（第 1039-1045 行）
var HIS = [
  { t: '07:00', n: '晨间盘前会', no: '...', on: true },   // 硬编码 on: true
  { t: '10:30', n: '与投行方通话', no: '...', on: true }, // 硬编码 on: true
  { t: '14:00', n: '交割文件终审', no: '...', on: false }, // 硬编码 on: false
  ...
];
```

**修复方案**：
```javascript
// 修复后（第 1046-1056 行）
function renderHim() {
  $('#hmStat').textContent = Dark.status();
  $('#chStat').textContent = Dark.status();
  var q = S.wx ? Dark.weather(S.wx) : null;
  $('#hmQuote').textContent = q ? q.say : '把今天要做的事列出来。我看着你做完。';
  
  /* 根据当前时间更新 Dark 日程的完成状态（时间线修复） */
  var now = new Date();
  var hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  HIS.forEach(function (b) {
    b.on = b.t <= hhmm;  /* 当前时间已过该任务时间 → 标记为已完成 */
  });
  
  $('#hisTodo').innerHTML = HIS.map(function (b) { ... });
}
```

**效果**：
- ✅ **实时更新**：每次进入 Dark 页面，都会根据当前时间重新计算哪些任务已完成
- ✅ **时间线正确**：
  - 上午 8:00 → 只有 07:00 的"晨间会议"显示✓已完成
  - 下午 15:00 → 07:00/10:30/14:00 三个任务都显示✓已完成
  - 晚上 23:00 → 所有 5 个任务都显示✓已完成
- ✅ **动态感**：Dark 的日程会随着时间推进而逐步完成，更有陪伴感

---

## 🧪 测试验证

打开 http://localhost:8123，在浏览器 Console 里：

### 测试 1：Dark 留言刷新
```javascript
// 1. 清除旧缓存
S.said = {};
save();

// 2. 添加一个任务并查看 Dark 的话
S.tasks.push({ id: 'test1', time: '', title: '测试任务', ring: 1, done: false });
save();
renderTasks();
// → Dark 会说一句提醒话，记住这句话

// 3. 刷新页面，再看同一个任务
location.reload();
// → 今天内，Dark 说的还是同一句话（缓存生效）

// 4. 模拟跨天
S.day = '2026-08-15';  // 改成明天
save();
location.reload();
renderTasks();
// → Dark 的话换了！（缓存失效，重新抽取）
```

### 测试 2：Dark 日程时间线
```javascript
// 切到 Dark 页
go('him');

// 检查 Dark 的 5 个日程
HIS.forEach(function (b) {
  console.log(b.t, b.n, '→', b.on ? '✓已完成' : '○未完成');
});
// → 输出示例（假设现在是下午 15:30）：
// 07:00 晨间盘前会 → ✓已完成
// 10:30 与投行方通话 → ✓已完成
// 14:00 交割文件终审 → ✓已完成
// 17:30 修改并购方案 → ○未完成（还没到时间）
// 22:00 看你有没有睡 → ○未完成
```

---

## 📦 文件变更

**修改文件**: `/Users/gogofeng/WorkBuddy/tencent/念念日程-dark-完整版/index.html`

**修改行数**: 2 处
- 第 773-781 行：`said()` 函数加入日期判断
- 第 1046-1056 行：`renderHim()` 函数加入时间线计算

**文件大小**: ~87KB（微调）

---

## 📋 下一步：循环计划功能

快速修复已完成！如果需要实现**循环计划功能**（计划页 FAB + 周期任务），这是一个完整的新功能模块，包括：

### 功能设计
1. **数据结构**：
   ```javascript
   S.plans = [
     {
       id: 'p1',
       title: '健身房锻炼',
       ring: 3,  // 归到哪个环
       repeat: 'week',  // 周期：week / month / year
       days: [2, 4, 6],  // 周：星期几 | 月：几号 | 年：月-日数组
       start: '2026-08-14',  // 开始日期
       end: '2026-11-14',    // 结束日期（为期3个月）
       time: '18:00'
     }
   ];
   ```

2. **UI 改动**：
   - 计划页右下角显示 FAB（+ 按钮）
   - 点击弹出"添加循环计划"表单（周期、重复日期、时长）
   - 今天页根据循环计划自动生成当日任务

3. **逻辑实现**：
   - `materialize()` 函数：根据循环计划生成当日任务
   - 计划列表渲染：显示进行中的计划 + 删除/编辑

**预估开发时间**: 1-2 小时

需要我现在开始开发循环计划功能吗？

---

**修复完成时间**: 2026-08-14 13:00  
**修复内容**: Dark 留言不重复 + Dark 日程时间线  
**下一步**: 循环计划功能（待开发）
