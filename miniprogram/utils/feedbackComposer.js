// utils/feedbackComposer.js
// 课后结构化反馈的自动文案生成器（蓝图 P10）：教练只给「事实」（评分/标签/一句话），
// 系统负责「表达」。纯函数、无 wx 依赖，方便 jest 全覆盖；
// 两版文案都允许教练手改，这里只负责生成起点。
// 周反馈（feedbacks 集合）与每课反馈（lessonFeedbacks）语义不同，本模块服务后者。

// 进步标签：与周反馈（pages/coach/feedback/write 的 tagList）同一套词汇，
// 家长端两处看到的语言保持一致
const FEEDBACK_TAGS = ['速度进步', '耐力提升', '协调改善', '敏捷提高', '态度积极', '需要加强', '表现优秀', '专注力好'];

// 评分 → 课堂表现措辞（嵌进「{child}完成了今天的{type}，____」）
const RATING_PHRASES = {
  1: '今天状态比较一般',
  2: '今天练得有些吃力',
  3: '整体完成情况平稳',
  4: '课堂表现积极投入',
  5: '课堂表现非常出色'
};

const TAG_CAP = 4;      // 60 秒流程，标签贵精不贵多
const NOTE_MAX = 100;   // 一句话记录的上限
const TEMPLATE_CAP = 10; // 每个教练本地存的家长版模板上限
const DONE_AMOUNT_CAP = 4; // 家长版「完成量」最多列举几个，超出收成「等N项」

function ratingWord(rating) {
  return RATING_PHRASES[rating] || '';
}

/** 句子收尾统一成一个句号，避免「事实。。」 */
function asSentence(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  return /[。？！.?!]$/.test(s) ? s : s + '。';
}

/**
 * 家长版：三段式 —— 完成情况 (+ 训练完成量) + 亮点/教练事实 + 下阶段
 * @param {Object} p { childName, typeName, rating, tags, note, focus, doneAmounts }
 *   doneAmounts: 已完成且填了组数/个数的项目，由调用方拼好的「深蹲3组×12次」字符串数组
 */
function composeParentVersion(p) {
  p = p || {};
  const childName = (p.childName || '').trim() || '孩子';
  const typeName = (p.typeName || '').trim() || '训练';
  const rating = p.rating | 0;
  const tags = (p.tags || []).slice(0, TAG_CAP);
  const note = asSentence(p.note);
  const focus = (p.focus || '').trim();
  const doneAmounts = (p.doneAmounts || []).filter(Boolean);

  const parts = [];

  const phrase = ratingWord(rating);
  parts.push(asSentence(
    phrase
      ? childName + '完成了今天的' + typeName + '，' + phrase
      : childName + '完成了今天的' + typeName
  ));

  // 训练完成量：勾了且带组数/个数的项目才进文案，没填量的只打卡不列举
  if (doneAmounts.length) {
    const shown = doneAmounts.slice(0, DONE_AMOUNT_CAP).join('、');
    const more = doneAmounts.length > DONE_AMOUNT_CAP ? '等' + doneAmounts.length + '项' : '';
    parts.push(asSentence('今日完成量：' + shown + more));
  }

  if (tags.length) parts.push(asSentence('值得肯定的是：' + tags.join('、')));
  if (note) parts.push(note);

  parts.push(asSentence(
    focus
      ? '下阶段将继续围绕「' + focus + '」展开训练'
      : '下阶段将保持现有训练节奏，稳步推进'
  ));

  return parts.filter(Boolean).join('\n');
}

/**
 * 朋友圈版：短、带星级和话题标签的对外内容。
 * 事实照写（含「需要加强」这类标签），表达交给教练手改。
 */
function composeMomentsVersion(p) {
  p = p || {};
  const childName = (p.childName || '').trim() || '小运动员';
  const typeName = (p.typeName || '').trim() || '体能训练';
  const rating = p.rating | 0;
  const tags = (p.tags || []).slice(0, 3);
  const note = String(p.note || '').trim();

  const stars = rating > 0 ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '';
  const lines = [];

  lines.push('🔥' + childName + ' ' + typeName + '打卡' + (stars ? '｜' + stars : ''));
  if (tags.length) lines.push('今日亮点：' + tags.join(' · '));
  if (note) lines.push(note);
  lines.push('—— 腾鑫体育 · 让每一次训练都被看见');

  return lines.filter(Boolean).join('\n') + '\n#腾鑫体育 #少儿体能';
}

module.exports = {
  FEEDBACK_TAGS,
  RATING_PHRASES,
  TAG_CAP,
  NOTE_MAX,
  TEMPLATE_CAP,
  DONE_AMOUNT_CAP,
  ratingWord,
  composeParentVersion,
  composeMomentsVersion
};
