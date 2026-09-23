/**
 * 课后反馈自动文案生成器的单测：家长版三段式 / 朋友圈版 / 标签截断 / 容错。
 * 「教练只负责事实，系统负责表达」——表达错了家长直接看到，所以这里盯得细。
 */
const fc = require('../miniprogram/utils/feedbackComposer');

describe('feedbackComposer 家长版自动文案', () => {
  const base = {
    childName: '小明', typeName: '速度训练', rating: 5,
    tags: ['速度进步', '态度积极'], note: '落地稳定性明显提高', focus: '起跑爆发'
  };

  test('三段式齐活：完成情况 + 亮点 + 一句话 + 下阶段', () => {
    const text = fc.composeParentVersion(base);
    expect(text).toContain('小明完成了今天的速度训练，课堂表现非常出色。');
    expect(text).toContain('值得肯定的是：速度进步、态度积极。');
    expect(text).toContain('落地稳定性明显提高。');
    expect(text).toContain('下阶段将继续围绕「起跑爆发」展开训练。');
  });

  test('缺省兜底：无标签/一句话/重点时也有完整三段', () => {
    const text = fc.composeParentVersion({ childName: '小红', typeName: '耐力训练', rating: 3 });
    expect(text).toContain('小红完成了今天的耐力训练，整体完成情况平稳。');
    expect(text).toContain('下阶段将保持现有训练节奏，稳步推进。');
    expect(text).not.toContain('值得肯定');
  });

  test('一句话自带句号时不重复加句号', () => {
    const text = fc.composeParentVersion(Object.assign({}, base, { note: '状态很好。' }));
    expect(text).toContain('状态很好。');
    expect(text).not.toContain('状态很好。。');
  });

  test('标签超过上限截断到前 4 个', () => {
    const text = fc.composeParentVersion(Object.assign({}, base, { tags: fc.FEEDBACK_TAGS }));
    expect(text).toContain('值得肯定的是：速度进步、耐力提升、协调改善、敏捷提高。');
    expect(text).not.toContain('态度积极');
  });

  test('评分越界 / 缺孩子名时不炸', () => {
    expect(fc.composeParentVersion({ rating: 0 })).toContain('孩子完成了今天的训练。');
    expect(fc.composeParentVersion({ childName: '小明', typeName: '速度训练', rating: 9 }))
      .toContain('小明完成了今天的速度训练。');
  });
});

describe('feedbackComposer 朋友圈版自动文案', () => {
  test('带星级、亮点（只取前 3 个标签）与话题标签', () => {
    const text = fc.composeMomentsVersion({
      childName: '小明', typeName: '速度训练', rating: 4,
      tags: ['速度进步', '态度积极', '专注力好', '多余的标签']
    });
    expect(text).toContain('🔥小明 速度训练打卡｜★★★★☆');
    expect(text).toContain('今日亮点：速度进步 · 态度积极 · 专注力好');
    expect(text.endsWith('#腾鑫体育 #少儿体能')).toBe(true);
  });

  test('没打分 / 没标签也能安全成稿', () => {
    const text = fc.composeMomentsVersion({});
    expect(text).toContain('🔥小运动员 体能训练打卡');
    expect(text).not.toContain('★');
    expect(text.endsWith('#腾鑫体育 #少儿体能')).toBe(true);
  });

  test('一句话原样进入朋友圈版', () => {
    const text = fc.composeMomentsVersion({ childName: '小明', typeName: '速度训练', rating: 5, note: '起跑反应明显变快' });
    expect(text).toContain('起跑反应明显变快');
  });
});

describe('feedbackComposer 常量', () => {
  test('标签集与周反馈同词汇且 8 个；评分措辞 1-5 齐全', () => {
    expect(fc.FEEDBACK_TAGS).toHaveLength(8);
    expect(fc.TAG_CAP).toBe(4);
    expect(fc.NOTE_MAX).toBe(100);
    expect(fc.TEMPLATE_CAP).toBe(10);
    for (let i = 1; i <= 5; i++) {
      expect(typeof fc.ratingWord(i)).toBe('string');
      expect(fc.ratingWord(i)).not.toBe('');
    }
    expect(fc.ratingWord(0)).toBe('');
    expect(fc.ratingWord(9)).toBe('');
  });
});

describe('feedbackComposer 家长版·训练完成量（组数/个数）', () => {
  const base = {
    childName: '小明', typeName: '综合训练', rating: 4,
    doneAmounts: ['深蹲3组×12次', '平板支撑2组']
  };

  test('已完成且带量的项目拼成「今日完成量」段，只列勾选的', () => {
    const text = fc.composeParentVersion(base);
    expect(text).toContain('今日完成量：深蹲3组×12次、平板支撑2组。');
  });

  test('没填组数/个数（doneAmounts 空/缺省）→ 整段不出现', () => {
    expect(fc.composeParentVersion(Object.assign({}, base, { doneAmounts: [] })))
      .not.toContain('完成量');
    expect(fc.composeParentVersion({ childName: '小红', typeName: '耐力训练', rating: 3 }))
      .not.toContain('完成量');
  });

  test('超过 4 个收成「等N项」；空串/null 项被过滤不进文案', () => {
    const text = fc.composeParentVersion(Object.assign({}, base, {
      doneAmounts: ['深蹲3组×12次', '平板支撑2组', '折返跑4组', '开合跳50次', '弓步走2组', '', null]
    }));
    expect(text).toContain('深蹲3组×12次、平板支撑2组、折返跑4组、开合跳50次等5项。');
    expect(text).not.toContain('弓步走');
  });
});
