// pages/coach/post-class/index.js
// 课后记录（蓝图 C06 课后结构化反馈内嵌版）：
//   顶部课次信息 → 训练项目完成情况（可补勾）→ 课后反馈版块（一句话/评分/标签/双版文案）→ 本次可选录入。
//   照片/视频已上移到上课中页面现场录入（课次文档 classPhotos/classVideos），写反馈时从这里取。
// 反馈复用 feedbacks 集合，字段向后兼容——content = 家长版文案、weekStart/weekRange 照写，
// 老的读取方（我的反馈/反馈列表/工作台统计）不用改。表达由 utils/feedbackComposer 生成、可手改。
// mode=edit 时由反馈列表进入，只更新反馈、不消课。
const auth = require('../../../utils/auth');
const fc = require('../../../utils/feedbackComposer');

const TEMPLATE_KEY_PREFIX = 'lessonFeedbackTemplates_';
const MOMENTS_TEMPLATE_KEY_PREFIX = 'lessonFeedbackTemplatesMoments_';

Page({
  data: {
    // ---- 页面基础 ----
    training: {},
    childInfo: {},
    loading: true,      // 课次信息加载中
    isEdit: false,      // 编辑既有反馈（来自反馈列表）

    // ---- 训练项目完成情况（旧文档无 items 则为空、整卡隐藏；可补勾） ----
    items: [],
    doneCount: 0,

    // ---- 课后反馈版块 ----
    // 照片/视频已移到上课中现场录入（存课次文档 classPhotos/classVideos）。
    // 这里的 photos/videos 不再有 UI，仅作老反馈兼容占位：编辑老反馈时预填原文档媒体，
    // 课次上没有新媒体时不覆盖，防止重存把老照片/视频清掉。
    tagPresets: fc.FEEDBACK_TAGS,
    tagCap: fc.TAG_CAP,
    noteMax: fc.NOTE_MAX,

    childName: '',
    typeName: '',
    dateText: '',
    focus: '',

    rating: 0,
    ratingWord: '',
    tagMap: {},
    tags: [],
    note: '',
    photos: [],
    videos: [],
    parentVersion: '',
    momentsVersion: '',
    templates: [],
    momentsTemplates: [],

    saving: false,

    aiLoading: false    // 「✨ AI 生成」请求进行中（行内按钮态，非模态，教练可继续浏览）
  },

  onLoad(options) {
    const { id, childId, mode } = options;
    this.trainingId = id || '';
    this.childId = childId || '';
    this.childIdFromOptions = !!childId;
    this.parentOpenId = '';
    this.existingId = '';
    this._lastRegenNote = '';   // 一句话重算基线：blur 时比对，没改字就不重算（防洗掉手改/AI 文案）
    this.setData({ isEdit: mode === 'edit' });

    if (!this.trainingId) {
      auth.denyAndLeave('缺少课次参数');
      return;
    }
    if (this.childId) {
      // 本页能扣课时、写 hoursRecords，务必先确认这个孩子是当前教练名下的
      auth.guardChildAccess(this.childId).then(ok => {
        if (ok) this.loadChildInfo(this.childId);
      });
    }
    this.loadTraining();
  },

  // 加载学员信息（顶部卡片 + 家长归属快照）
  loadChildInfo(childId) {
    const db = wx.cloud.database();
    db.collection('children').doc(childId).get().then(res => {
      this.setData({ childInfo: res.data });
      this.parentOpenId = (res.data && res.data.parentOpenId) || '';
    }).catch(err => {
      console.error('加载学员信息失败', err);
    });
  },

  // 加载课次（反馈文案与文档都需要课次的真实字段，不再只用 options 里的 id）
  loadTraining() {
    const db = wx.cloud.database();
    db.collection('trainings').doc(this.trainingId).get().then(res => {
      const training = res.data;
      if (!training || training.coachId !== auth.getCoachId()) {
        auth.denyAndLeave('无权记录该课次');
        return;
      }
      if (!this.childId) this.childId = training.childId || '';
      if (this.childId && training.childId && training.childId !== this.childId) {
        auth.denyAndLeave('学员与课次不匹配');
        return;
      }
      // 入口漏带 childId 时的兜底：按课次上的 childId 补齐学员信息（扣课时/通知要用）
      if (!this.childIdFromOptions && this.childId) {
        auth.guardChildAccess(this.childId).then(ok => {
          if (ok) this.loadChildInfo(this.childId);
        });
      }
      // 组数/个数选填，拼成「3组×12次」展示；没填则为空、行内不显示。
      // sets/reps 必须带进内存对象——persistItems 补勾时会把整个数组写回课次文档，
      // 这里丢了就会把文档里的组数/个数洗掉，家长版的完成量也随之消失。
      // metric（上课时 AI 从表现文字抽的成绩数值）同理必须带回。
      const items = (training.items || []).map(it => ({
        name: (it && it.name) || '',
        done: !!(it && it.done),
        sets: (it && it.sets) || '',
        reps: (it && it.reps) || '',
        metric: (it && it.metric) || null,
        amount: [(it && it.sets) ? it.sets + '组' : '', (it && it.reps) ? it.reps + '次' : ''].filter(Boolean).join('×')
      }));
      this.setData({
        loading: false,
        training: training,
        childName: training.childName || this.data.childName || '',
        typeName: training.name || training.type || '训练',
        dateText: training.date || '',
        focus: training.focus || '',
        items,
        doneCount: items.filter(it => it.done).length
      });
      // 先拿到孩子姓名/家长归属再生成文案，避免异步竞态
      const ensureChild = this.childId
        ? db.collection('children').doc(this.childId).get().then(cRes => {
            this.parentOpenId = (cRes.data && cRes.data.parentOpenId) || this.parentOpenId;
            if (cRes.data && cRes.data.name && !this.data.childName) {
              this.setData({ childName: cRes.data.name });
            }
          }).catch(() => {})
        : Promise.resolve();
      return ensureChild.then(() => this.loadExisting());
    }).catch(err => {
      console.error('加载课次失败', err);
      // doc.get 对不存在的文档会报 document not exists（如课次被删后从反馈直入）
      const notFound = err && /not exist/i.test(err.errMsg || err.message || '');
      auth.denyAndLeave(notFound ? '课次不存在或已删除' : '课次加载失败');
    });
  },

  /** 同一课次只允许一份反馈：已存在则进入编辑态（预填） */
  loadExisting() {
    const db = wx.cloud.database();
    return db.collection('feedbacks').where({
      trainingId: this.trainingId
    }).orderBy('updatedAt', 'desc').limit(1).get().then(res => {
      this.loadTemplates();
      if (!(res.data && res.data.length)) {
        this.regenerate();
        return;
      }
      const doc = res.data[0];
      this.existingId = doc._id;
      const tagMap = {};
      (doc.tags || []).forEach(t => { tagMap[t] = true; });
      this.setData({
        rating: doc.rating || 0,
        ratingWord: fc.ratingWord(doc.rating || 0),
        tagMap: tagMap,
        tags: doc.tags || [],
        note: doc.note || '',
        photos: doc.photos || [],
        videos: doc.videos || [],
        parentVersion: doc.content || '',
        momentsVersion: doc.momentsVersion || ''
      });
      // 编辑态预填的一句话也是基线：进来就点一下输入框再失焦，不该把预填文案洗掉
      this._lastRegenNote = doc.note || '';
    }).catch(err => {
      console.error('查询已有反馈失败', err);
      this.loadTemplates();
      this.regenerate();
    });
  },

  /** 两版文案的模板各自存本地缓存、按教练隔离（持久化到库里留待二期） */
  loadTemplates() {
    const coachId = auth.getCoachId();
    this.setData({
      templates: coachId ? (wx.getStorageSync(TEMPLATE_KEY_PREFIX + coachId) || []) : [],
      momentsTemplates: coachId ? (wx.getStorageSync(MOMENTS_TEMPLATE_KEY_PREFIX + coachId) || []) : []
    });
  },

  /** 事实变了 → 重生成两版文案（手改的内容会被覆盖，页面有提示）。
      两栏都被系统重写，上一轮 AI 输出标记随之作废（AI 失败回落不得再拿它当「可吞」凭据）；
      同时记录本次重算所依据的一句话基线，供 onNoteBlur 判断「未改字的失焦」 */
  regenerate() {
    this._lastRegenNote = this.data.note;
    this._lastAIParent = '';
    this._lastAIMoments = '';
    this.setData({
      parentVersion: fc.composeParentVersion(this.collectParams()),
      momentsVersion: fc.composeMomentsVersion(this.collectParams())
    });
  },

  collectParams() {
    const d = this.data;
    return {
      childName: d.childName,
      typeName: d.typeName,
      rating: d.rating,
      tags: d.tags,
      note: d.note,
      focus: d.focus,
      // 已完成且填了组数/个数的项目 → 「深蹲3组×12次」，家长版文案里说明训练量
      doneAmounts: d.items.filter(it => it.done && it.amount).map(it => it.name + it.amount)
    };
  },

  onRatingTap(e) {
    const score = Number(e.currentTarget.dataset.score);
    if (!score || score === this.data.rating) return;
    this.setData({ rating: score, ratingWord: fc.ratingWord(score) });
    this.regenerate();
  },

  onTagToggle(e) {
    const tag = e.currentTarget.dataset.tag;
    const tagMap = Object.assign({}, this.data.tagMap);
    let tags = this.data.tags.slice();
    if (tagMap[tag]) {
      delete tagMap[tag];
      tags = tags.filter(t => t !== tag);
    } else {
      if (tags.length >= fc.TAG_CAP) {
        wx.showToast({ title: '最多选 ' + fc.TAG_CAP + ' 个标签', icon: 'none' });
        return;
      }
      tagMap[tag] = true;
      tags.push(tag);
    }
    this.setData({ tagMap: tagMap, tags: tags });
    this.regenerate();
  },

  // 一句话输完再重生成，避免打字过程文案抖动
  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  onNoteBlur() {
    // 没改字就失焦（点进来看一眼又点走）不重算——regenerate 会整段覆盖两栏，
    // 无变更的 blur 不该洗掉教练手改或 AI 生成的文案
    if (this.data.note === this._lastRegenNote) return;
    this.regenerate();
  },

  // 凡是非 AI 路径改动了栏（手输/点模板 chip/重新生成），同步清掉该栏的 AI 输出标记——
  // 标记语义是「这栏还是上一轮 AI 的输出，AI 失败时可吞掉换模板」，内容一变标记就必须作废，
  // 否则教练刚点选的模板文案若与上轮 AI 输出恰好相同，失败回落会把它误判成 AI 输出而吞掉。
  onParentInput(e) {
    this._lastAIParent = '';
    this.setData({ parentVersion: e.detail.value });
  },
  onMomentsInput(e) {
    this._lastAIMoments = '';
    this.setData({ momentsVersion: e.detail.value });
  },
  regenParent() {
    this._lastAIParent = '';
    this.setData({ parentVersion: fc.composeParentVersion(this.collectParams()) });
  },
  regenMoments() {
    this._lastAIMoments = '';
    this.setData({ momentsVersion: fc.composeMomentsVersion(this.collectParams()) });
  },

  // ==================== AI 生成（云函数中转智谱 GLM-4-Flash） ====================
  // 显式按钮两处入口，各自只填自己那栏（用户拍板：不联动）；评分/标签/一句话变动仍走上方即时模板 regenerate（保底 + 控调用量）。
  // 失败回落有个讲究：教练手改过的文案不能被模板吞掉——只回填「空栏」或「还是上一轮 AI 输出」的栏。

  // 客户端只送事实，prompt 在云函数里拼（服务端还有白名单清洗，多传的字段会被丢弃）
  buildAIPayload() {
    const d = this.data;
    return {
      child: {
        name: d.childName || (d.childInfo && d.childInfo.name) || '',
        age: d.childInfo && d.childInfo.age,
        gender: d.childInfo && d.childInfo.gender,
        goal: d.childInfo && d.childInfo.goal
      },
      training: {
        typeName: d.typeName,
        focus: d.focus,
        date: d.dateText,
        // 全量 items（含未勾的）——未完成项目 AI 会如实写成「留给下阶段加强」
        items: d.items.map(it => ({ name: it.name, done: it.done, sets: it.sets, reps: it.reps }))
      },
      feedback: {
        rating: d.rating,
        tags: d.tags,
        note: d.note,
        doneAmounts: this.collectParams().doneAmounts
      }
    };
  },

  // scope：每个入口只填自己那栏（data-scope="parent"/"moments"）——接口一次总回两版，
  // 但只落对应栏，另一栏（手改/上一轮 AI/模板内容）分毫不动。
  onAIGenerate(e) {
    if (this.data.aiLoading) return;   // 防抖：生成中再点无效（两处入口共用一个在途状态）
    if (this.data.saving) return;      // 保存/完成记录进行中，不再发起新一轮 AI
    if (!this.data.rating) {
      wx.showToast({ title: '先给本节课打个分，AI 写得更准', icon: 'none' });
      return;
    }
    // 学员信息还没加载完就点 AI：payload 会静默缺 age/gender/goal，AI 质量降级且无人知晓
    if (this.childId && !(this.data.childInfo && this.data.childInfo._id)) {
      wx.showToast({ title: '学员信息还在加载，请稍候再点', icon: 'none' });
      return;
    }
    this._aiScope = (e && e.currentTarget.dataset.scope) === 'moments' ? 'moments' : 'parent';
    this.setData({ aiLoading: true });
    this._aiAlive = true;   // onUnload 置 false，回包判活，防向已卸载页面 setData

    wx.cloud.callFunction({
      name: 'generateFeedbackAI',
      data: { payload: this.buildAIPayload() }
    }).then(res => {
      const r = (res && res.result) || {};
      if (!this._aiAlive) return;      // 页面已退出，静默丢弃
      this.setData({ aiLoading: false });
      if (this.data.saving) return;    // 已进入保存流程：存档快照已定盘，AI 结果不再上屏（防界面与存档不一致）
      if (r.success && r.parentVersion && r.momentsVersion) {
        // textarea maxlength 就是 500，双保险再截一次（云函数端已 clamp 过）
        const pv = r.parentVersion.slice(0, 500);
        const mv = r.momentsVersion.slice(0, 500);
        // 只落本次入口那一栏
        const patch = {};
        if (this._aiScope === 'moments') {
          patch.momentsVersion = mv;
          this._lastAIMoments = mv;
        } else {
          patch.parentVersion = pv;
          this._lastAIParent = pv;
        }
        this.setData(patch);
        wx.showToast({ title: 'AI 文案已生成，可手改', icon: 'none' });
        return;
      }
      this.fallbackAfterAIError(r.code);
    }).catch(err => {
      console.error('AI 生成反馈失败', err);
      if (!this._aiAlive) return;
      this.setData({ aiLoading: false });
      if (this.data.saving) return;    // 保存中：同样不再回落改写栏位
      this.fallbackAfterAIError('');
    });
  },

  /** AI 失败的回落：只回填「空栏」或「仍是上一轮 AI 输出」的栏，教练手改的内容绝不吞。
      toast 在 patch 算完后按实际结果出——没回填就说「已保留当前文案」，不说「已用模板文案」 */
  fallbackAfterAIError(code) {
    const d = this.data;
    const patch = {};
    // 回落只管本次入口那一栏，另一栏碰都不碰（与生成同口径，不联动）
    if (this._aiScope === 'moments') {
      if (!d.momentsVersion || d.momentsVersion === this._lastAIMoments) {
        patch.momentsVersion = fc.composeMomentsVersion(this.collectParams());
      }
    } else if (!d.parentVersion || d.parentVersion === this._lastAIParent) {
      patch.parentVersion = fc.composeParentVersion(this.collectParams());
    }
    this._lastAIParent = '';
    this._lastAIMoments = '';

    const reasons = {
      NO_API_KEY: 'AI 未配置',
      AUTH_FAILED: 'AI 密钥无效',
      RATE_LIMITED: 'AI 繁忙，稍后再试',
      CONTENT_BLOCKED: '内容被 AI 安全拦截',
      TIMEOUT: 'AI 超时',
      NETWORK: '网络异常',
      BAD_PAYLOAD: '学员信息缺失'
    };
    const reason = reasons[code] || 'AI 生成失败';
    if (Object.keys(patch).length) {
      this.setData(patch);
      wx.showToast({ title: reason + '，已补模板文案', icon: 'none' });
    } else {
      wx.showToast({ title: reason + '，已保留当前文案', icon: 'none' });
    }
  },

  // ---- 模板：点chip把对应栏整段换成模板文案（家长版/朋友圈版各自一套，互不混用） ----
  onTemplateTap(e) {
    const text = e.currentTarget.dataset.text;
    if (text) {
      this._lastAIParent = '';   // 教练明确选了模板，AI 失败回落不得吞
      this.setData({ parentVersion: text });
    }
  },

  onMomentsTemplateTap(e) {
    const text = e.currentTarget.dataset.text;
    if (text) {
      this._lastAIMoments = '';
      this.setData({ momentsVersion: text });
    }
  },

  /** 存模板共用规则：去重置顶 + 截断；家长版/朋友圈版各存各的缓存 key */
  saveTemplateList(storageKey, text) {
    let list = wx.getStorageSync(storageKey) || [];
    list = list.filter(t => t !== text);
    list.unshift(text);
    if (list.length > fc.TEMPLATE_CAP) list = list.slice(0, fc.TEMPLATE_CAP);
    wx.setStorageSync(storageKey, list);
    return list;
  },

  onSaveTemplate() {
    const text = (this.data.parentVersion || '').trim();
    if (!text) {
      wx.showToast({ title: '家长版文案为空', icon: 'none' });
      return;
    }
    const coachId = auth.getCoachId();
    if (!coachId) return;
    this.setData({ templates: this.saveTemplateList(TEMPLATE_KEY_PREFIX + coachId, text) });
    wx.showToast({ title: '已存为模板', icon: 'success' });
  },

  onSaveMomentsTemplate() {
    const text = (this.data.momentsVersion || '').trim();
    if (!text) {
      wx.showToast({ title: '朋友圈文案为空', icon: 'none' });
      return;
    }
    const coachId = auth.getCoachId();
    if (!coachId) return;
    this.setData({ momentsTemplates: this.saveTemplateList(MOMENTS_TEMPLATE_KEY_PREFIX + coachId, text) });
    wx.showToast({ title: '已存为模板', icon: 'success' });
  },

  // ==================== 底部主操作 ====================
  onPrimaryAction() {
    if (this.data.isEdit) {
      this.onEditSave();
    } else {
      this.finishRecord();
    }
  },

  // 录入成绩
  gotoPerformance() {
    const { childInfo, training } = this.data;
    wx.navigateTo({
      url: `/pages/coach/performance/weekly/index?childId=${childInfo._id}&childName=${childInfo.name}&fromPostClass=true&trainingId=${training._id}`
    });
  },

  // 体质测评
  gotoAssessment() {
    const { childInfo } = this.data;
    wx.navigateTo({
      url: `/pages/coach/assessment/edit/index?childId=${childInfo._id}&childName=${childInfo.name}`
    });
  },

  // 补勾/取消训练项目（创建态与补写反馈态都可改），勾选即同步课次文档
  onToggleItem(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const items = this.data.items;
    if (!items[idx]) return;
    const next = items.slice();
    next[idx] = Object.assign({}, next[idx], { done: !next[idx].done });
    this.setData({ items: next, doneCount: next.filter(it => it.done).length });
    this.persistItems(next);
    // 勾选也是事实：**被勾/取消的这个项目**带训练量 → doneAmounts 变了 → 家长版「完成量」跟着重写
    // （手改文案会被覆盖，与评分/标签同规则）。没填量的项目勾/取消不改变任何事实，不动两栏文案——
    // 守卫放宽到「任一项目带量」会让事实未变的补勾也整段覆盖手改/AI 文案，等于静默吞内容。
    if (next[idx].amount) this.regenerate();
  },

  // 与上课页同构：队列串行化防快速连点乱序覆盖，失败静默（console.error）
  persistItems(items) {
    if (!this.trainingId) return;
    const db = wx.cloud.database();
    // 只回写数据字段：sets/reps/metric 原样带回；amount 是派生的展示串，不入库
    const clean = items.map(it => ({ name: it.name || '', done: !!it.done, sets: it.sets || '', reps: it.reps || '', metric: it.metric || null }));
    const write = () => db.collection('trainings').doc(this.trainingId).update({
      data: { items: clean, updatedAt: new Date() }
    }).catch(err => console.error('保存训练项目失败', err));
    this._itemsQueue = (this._itemsQueue || Promise.resolve()).then(write);
  },

  // 完成记录（创建态）：已填反馈则先存反馈，再消课 + 通知家长
  finishRecord() {
    if (this.data.saving) return;
    if (!this.canSubmitFeedback()) return;

    // 有未勾项目时在弹窗里明示，允许带未勾项完成（课上确实跳过的项目）
    const pendingCount = this.data.items.length - this.data.doneCount;
    const content = (this.data.items.length && pendingCount > 0)
      ? `还有${pendingCount}个训练项目未勾选，确认完成本次课后记录？将扣除学员1课时`
      : '确认完成本次课后记录？将扣除学员1课时';

    wx.showModal({
      title: '提示',
      content: content,
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ saving: true });
        // 反馈保存失败不阻塞消课，教练稍后可在反馈列表补写
        const fbTask = this.data.rating ? this.writeFeedbackDoc() : Promise.resolve();
        fbTask.catch(err => {
          console.error('保存反馈失败', err);
          wx.showToast({ title: '反馈保存失败，可稍后补写', icon: 'none' });
        }).then(() => {
          // 幂等兜底：课次已是 finished 说明上次已完成过（如失败后重试），别再扣一次课时
          const db = wx.cloud.database();
          return db.collection('trainings').doc(this.trainingId).get().then(res => {
            if (res.data && res.data.status === 'finished') {
              this.goBackAfterFinish();
              return;
            }
            return this.deductHours().then(() => this.updateTrainingStatus('finished'));
          });
        }).catch(err => {
          console.error('完成记录失败', err);
          this.setData({ saving: false });
          wx.hideLoading();
          wx.showToast({ title: '操作失败，请重试', icon: 'none' });
        });
      }
    });
  },

  // 填了反馈内容（评分/一句话/标签任一，或课上拍了照片视频）就必须打分
  canSubmitFeedback() {
    const d = this.data;
    const mediaCount = ((d.training && d.training.classPhotos) || []).length
      + ((d.training && d.training.classVideos) || []).length;
    // 勾过训练项目也算「动过反馈」：完成量会进家长版文案，不拦的话教练
    // 只勾项目就完成记录，预览里的家长版（含完成量）会被静默丢弃且无法补写
    const touched = d.rating || (d.note || '').trim() || d.tags.length || mediaCount || d.doneCount;
    if (touched && !d.rating) {
      wx.showToast({ title: '请先给本节课打分', icon: 'none' });
      return false;
    }
    return true;
  },

  // 编辑态：只更新反馈，不消课
  onEditSave() {
    if (this.data.saving) return;
    if (!this.data.rating) {
      wx.showToast({ title: '请先给本节课打分', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    this.writeFeedbackDoc().then(() => {
      wx.showToast({ title: '反馈已更新', icon: 'success' });
      this.leaveLater(() => { wx.navigateBack(); }, 650);
    }).catch(err => {
      console.error('保存反馈失败', err);
      this.setData({ saving: false });
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  // 写入前再确认一次没有同课次反馈（loadExisting 失败/竞态的兜底），避免 add 出重复文档
  writeFeedbackDoc() {
    if (this.existingId) return this.writeFeedbackDocInner();
    const db = wx.cloud.database();
    return db.collection('feedbacks').where({
      trainingId: this.trainingId
    }).orderBy('updatedAt', 'desc').limit(1).get().then(res => {
      if (res.data && res.data.length) this.existingId = res.data[0]._id;
      return this.writeFeedbackDocInner();
    });
  },

  writeFeedbackDocInner() {
    const db = wx.cloud.database();
    const d = this.data;
    const now = new Date();
    const week = this.weekRangeOf(d.dateText);
    // 照片/视频来自上课中现场录入（课次文档 classPhotos/classVideos）；
    // 课次上没有新媒体时回落到老反馈文档预填的 photos/videos，防止重存把老媒体清掉
    const inPhotos = ((d.training && d.training.classPhotos) || []).filter(Boolean);
    const inVideos = ((d.training && d.training.classVideos) || []).filter(Boolean);
    const photos = inPhotos.length ? inPhotos : (d.photos || []);
    const videos = inVideos.length ? inVideos : (d.videos || []);
    // trainings 不存头像，coachAvatar 与旧周反馈一致取本地 coachInfo 快照
    const coachInfo = wx.getStorageSync('coachInfo') || {};
    const doc = {
      trainingId: this.trainingId,
      childId: this.childId,
      childName: d.childName,
      coachId: auth.getCoachId(),
      coachName: (d.training && d.training.coachName) || '',
      // users 文档的头像字段是 avatarUrl（不是 avatar），写错字段名会让反馈里的头像恒为空
      coachAvatar: coachInfo.avatarUrl || '',
      type: (d.training && d.training.type) || '',
      date: d.dateText,
      weekStart: week.start,
      weekRange: week.range,
      rating: d.rating,
      tags: d.tags,
      note: (d.note || '').trim(),
      content: (d.parentVersion || '').trim(),   // 兼容字段：老的读取方渲染的就是它
      momentsVersion: (d.momentsVersion || '').trim(),
      photos: photos,
      photoCount: photos.length,
      videos: videos,
      videoCount: videos.length,
      parentOpenId: this.parentOpenId,
      updatedAt: now
    };

    const op = this.existingId
      ? db.collection('feedbacks').doc(this.existingId).update({ data: doc })
      : db.collection('feedbacks').add({ data: Object.assign({ createdAt: now }, doc) });

    return op.then(res => {
      const feedbackId = this.existingId || (res && res._id) || '';
      // 回写课次便于以后做「待反馈」统计；照片视频顺手归档进成长相册；都失败不影响反馈本身
      if (feedbackId) {
        db.collection('trainings').doc(this.trainingId).update({
          data: { lessonFeedbackId: feedbackId, updatedAt: now }
        }).catch(() => {});
      }
      this.saveToArchive(photos, videos);
      return feedbackId;
    });
  },

  /** 媒体归档进 photosAvideos（按 childId+yearMonth 一档一份），合并去重，尽力而为 */
  saveToArchive(photos, videos) {
    if (!(photos && photos.length) && !(videos && videos.length)) return;
    const db = wx.cloud.database();
    const yearMonth = (this.data.dateText || '').substring(0, 7);
    if (!yearMonth) return;
    db.collection('photosAvideos').where({
      childId: this.childId,
      yearMonth: yearMonth
    }).limit(1).get().then(res => {
      if (res.data && res.data.length) {
        const archive = res.data[0];
        const mergedPhotos = this.mergeUnique(archive.photos, photos);
        const mergedVideos = this.mergeUnique(archive.videos, videos);
        return db.collection('photosAvideos').doc(archive._id).update({
          data: {
            photos: mergedPhotos,
            photoCount: mergedPhotos.length,
            videos: mergedVideos,
            videoCount: mergedVideos.length,
            updatedAt: new Date()
          }
        });
      }
      return db.collection('photosAvideos').add({
        data: {
          childId: this.childId,
          yearMonth: yearMonth,
          photos: photos || [],
          photoCount: (photos || []).length,
          videos: videos || [],
          videoCount: (videos || []).length,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }).catch(err => {
      console.warn('相册归档失败（不影响反馈）', err);
    });
  },

  mergeUnique(existing, incoming) {
    const list = (existing || []).slice();
    (incoming || []).forEach(f => {
      if (f && list.indexOf(f) === -1) list.push(f);
    });
    return list;
  },

  /** dateStr(YYYY-MM-DD) → 所在周的周一/周日，兼容周维度统计读取 */
  weekRangeOf(dateStr) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateStr || '');
    if (!m) return { start: '', range: '' };
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const day = d.getDay(); // 0=周日
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    const iso = dt => dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
    const cn = dt => (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
    return { start: iso(monday), range: cn(monday) + '-' + cn(sunday) };
  },

  // 扣减学员学时
  deductHours() {
    const { childInfo, training } = this.data;
    const db = wx.cloud.database();

    return db.collection('children').doc(childInfo._id).get().then(res => {
      const child = res.data;
      const currentHours = child.remainingHours || 0;
      const newHours = currentHours - 1;

      if (newHours < 0) {
        wx.showToast({ title: '学时不足，请及时充值', icon: 'none' });
      }

      return db.collection('children').doc(childInfo._id).update({
        data: {
          remainingHours: newHours,
          updatedAt: new Date()
        }
      }).then(() => {
        // 写入课时记录
        return this.addHoursRecord(childInfo._id, 'expense', 1, `训练课程: ${training.name || '训练'}扣减`);
      });
    });
  },

  // 添加课时记录
  addHoursRecord(childId, type, amount, description) {
    const db = wx.cloud.database();
    return db.collection('hoursRecords').add({
      data: {
        childId: childId,
        type: type,
        amount: amount,
        description: description,
        createdAt: new Date()
      }
    }).then(res => {
      console.log('课时记录添加成功:', res);
      return res;
    }).catch(err => {
      console.error('课时记录添加失败:', err);
      return err;
    });
  },

  // 更新训练状态（promise 交回调用链，失败统一走外层 catch）
  updateTrainingStatus(status) {
    const { training } = this.data;
    if (!training._id) return Promise.resolve();

    const db = wx.cloud.database();
    return db.collection('trainings').doc(training._id).update({
      data: {
        status: status,
        updatedAt: new Date()
      }
    }).then(() => {
      // 发送通知给家长
      this.sendNotificationToParent();
    });
  },

  // 发送训练完成通知给家长
  async sendNotificationToParent() {
    const { training } = this.data;
    // 学员信息没加载出来时（兜底路径），用 loadTraining 里取到的家长归属
    const parentOpenId = this.data.childInfo.parentOpenId || this.parentOpenId;

    if (!parentOpenId) {
      console.error('未找到家长的openid');
      wx.showToast({ title: '已保存', icon: 'success' });
      this.goBackAfterFinish();
      return;
    }

    try {
      // 训练完成通知模板ID（需要在微信公众平台配置）
      const templateId = 'e1sXPzlqTt8wP7sskewLntcKdhzfX8EBej3utxSp8W0';

      // 构建消息内容
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const templateData = {
        // childName 由 training.childName / children 文档双路填充，比 childInfo 可靠（兜底路径 childInfo 可能还是 {}）；
        // 空名兜底「学员」——thing 字段 value 为 undefined 时发送会失败
        thing2: { value: this.data.childName || '学员' },
        thing8: { value: "扣除一课时" },
        time3: { value: timeStr },
        thing1: { value: '腾鑫体育' }
      };

      console.log('发送训练完成通知:', templateData);

      // 发送订阅消息
      const result = await wx.cloud.callFunction({
        name: 'sendSubscribe',
        data: {
          openid: parentOpenId,
          templateId: templateId,
          page: 'pages/users/children/index',
          data: templateData
        }
      });

      if (result.result.success) {
        console.log('训练完成通知发送成功');
        wx.showToast({ title: '已通知家长', icon: 'success' });
      } else if (result.result.error?.errCode === 43101) {
        console.log('用户未授权通知');
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        console.error('训练完成通知发送失败', result.result.error);
        wx.showToast({ title: '已保存', icon: 'success' });
      }
    } catch (err) {
      console.error('发送通知失败:', err);
      wx.showToast({ title: '已保存', icon: 'success' });
    }

    this.goBackAfterFinish();
  },

  // 完成 → 连同上课页一起出栈，回到进入上课页前的位置
  goBackAfterFinish() {
    this.leaveLater(() => {
      const pages = getCurrentPages();
      const delta = pages.length > 2 ? 2 : pages.length - 1;
      if (delta > 0) {
        wx.navigateBack({ delta: delta });
      } else {
        // 页面栈里只剩本页（如开发者工具直接编译本页）→ 回工作台
        wx.reLaunch({ url: '/pages/coach/workbench/index' });
      }
    }, 1200);
  },

  /** 延迟离场统一入口：句柄记在实例上，onUnload 取消，防二次 navigateBack */
  leaveLater(fn, delay) {
    if (this._leaveTimer) clearTimeout(this._leaveTimer);
    this._leaveTimer = setTimeout(fn, delay);
  },

  onUnload() {
    this._aiAlive = false;   // AI 回包判活：页面卸载后回包静默丢弃
    if (this._leaveTimer) {
      clearTimeout(this._leaveTimer);
      this._leaveTimer = null;
    }
  }
})
