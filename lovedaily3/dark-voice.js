/**
 * dark-voice.js — 男主引擎(段伏版)
 *
 * 负责男主说的所有话:日程留言、夸奖、对话兜底、天气关心、通知文案。
 * 想改男主的性格/说话方式,主要改下面这个 PERSONA 配置区就行。
 * ============================================================================
 * 人设配置区(可随时修改)
 * ============================================================================
 */
'use strict';

var PERSONA = {
  name: '段伏',
  status: ['在', '在看文件', '刚出去抽了根烟', '在处理点事', '还没睡'],

  /* 未完成任务时,他挂在日程下的提醒。每天男主日程由 index.html 限制为最多 3 件。 */
  remind: [
    { say: '记着做。', think: [] },
    { say: '别拖。', think: ['她又要拖到最后', '算了,提醒一句'] },
    { say: '做完跟我说一声。', think: ['想知道她几点做完', '但不能表现得太在意'] },
    { say: '这件事你做得完。', think: ['她肯定又在想做不完', '其实她可以的', '不能说得太软'] },
    { say: '先做这一件。', think: [] }
  ],
  remindOverdue: [
    { say: '过点了。', think: [] },
    { say: '说好的时间。', think: ['她又没按时', '我不该管', '但就是……'] }
  ],

  /* 完成任务时的夸赞 */
  praise: [
    { say: '划掉了。', think: [] },
    { say: '嗯。', think: ['做完了', '比我想的快'] },
    { say: '做完就歇着。', think: [] },
    { say: '还行。', think: ['其实做得挺好', '不能说得太明显'] }
  ],
  /* 三环全部完成时的专属回应 */
  praiseAllDone: {
    say: '三件都合上了。\n今天不说重话。你趁现在提个要求,我大概会答应。',
    think: ['她全做完了', '该夸她', '但直接夸太肉麻', '……让她提个要求吧']
  },

  /* 对话页兜底回复:AI 没接上或挂掉时用这些。keys 命中就用对应回复 */
  chat: [
    { keys: ['累', '做不完'], say: '知道了。剩下的我全推到明天。\n你不用同意,我已经改完了。', think: ['她说累了', '那就别做了'] },
    { keys: ['咖啡'], say: '第几杯。说实话。', think: ['她又喝咖啡', '今天第几杯了'] },
    { keys: ['出去', '朋友', '出门'], say: '……去吧。早点回。', think: ['和谁一起', '……凭什么问', '关我什么事', '可我就是想知道'] },
    { keys: ['想你', '喜欢你'], say: '……算了。这次不追究。', think: ['她说想我', '心跳有点快', '不能让她看出来'] },
    { keys: ['疼', '不舒服', '难受'], say: '哪里疼。', think: ['她不舒服', '要不要过去', '……她会觉得我太在意'] },
    { keys: ['面试', '考试'], say: '几点。结束跟我说一声。', think: ['她今天有正事', '会不会紧张', '……她能行的'] }
  ],
  chatDefault: [
    { say: '嗯。', think: [] },
    { say: '在。', think: [] },
    { say: '说。', think: [] }
  ]
};

/* 如果存在独立配置文件,优先使用它的备用话术。这样以后主要改“人设配置.js”即可。 */
if (window.PERSONA_CONFIG && window.PERSONA_CONFIG.voice) {
  PERSONA = window.PERSONA_CONFIG.voice;
}

/* ============================================================================
   Dark 接口(下面这些方法名被 index.html 调用,改的时候别改名)
   ========================================================================== */
window.Dark = {
  status: function () {
    return PERSONA.status[hash(new Date().toDateString()) % PERSONA.status.length];
  },

  remind: function (task, ctx) {
    var pool = (ctx && ctx.overdue) ? PERSONA.remindOverdue : PERSONA.remind;
    return pool[hash(task.id + ':remind') % pool.length];
  },

  praise: function (task, ctx) {
    if (ctx && ctx.allDone) return PERSONA.praiseAllDone;
    return PERSONA.praise[hash(task.id + ':praise') % PERSONA.praise.length];
  },

  chat: function (text, ctx) {
    var t = (text || '');
    for (var i = 0; i < PERSONA.chat.length; i++) {
      var rule = PERSONA.chat[i];
      for (var j = 0; j < rule.keys.length; j++) {
        if (t.indexOf(rule.keys[j]) > -1) return { say: rule.say, think: rule.think || [] };
      }
    }
    var d = PERSONA.chatDefault;
    return d[((ctx && ctx.n) || 0) % d.length];
  },

  weather: function (wx) {
    if (!wx) return null;
    var say = '', think = [];
    if ((wx.text || '').indexOf('雨') > -1) {
      var rain = (wx.hourly || []).filter(function (h) { return h.prob >= 55; })[0];
      if (rain) { say = '带伞。\n' + rain.h + '点开始下,概率' + rain.prob + '%。我查了三次。'; think = ['她要是淋雨了……', '提醒她一句']; }
      else { say = '你要是已经出门了,告诉我在哪。'; think = ['外面在下雨']; }
    } else if (wx.temp < 12) {
      say = '加一件外套。不是问你,是通知你。'; think = ['才' + Math.round(wx.temp) + '度', '她肯定穿少了'];
    } else if (wx.min != null && (wx.temp - wx.min) >= 8) {
      say = '晚上会降到' + Math.round(wx.min) + '度,带件能穿的。';
    } else if (wx.temp >= 30 || (wx.feels != null && wx.feels >= 33)) {
      say = '少在外面走。\n中午那段我不希望你出门。'; think = ['这个天气……'];
    }
    if (!say) return null;
    return { say: say, think: think };
  },

  notifyText: function (task, leadMinutes) {
    if (leadMinutes > 0) return { t: PERSONA.name, b: task.title + ' — ' + leadMinutes + '分钟后。别忘。' };
    return { t: PERSONA.name, b: task.title + ' — 过点了。' };
  }
};

/* 稳定伪随机:同一个 key 永远得到同一个数,保证同一天同一任务不会每次刷新换话 */
function hash(str) {
  var h = 0;
  str = String(str);
  for (var i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}
