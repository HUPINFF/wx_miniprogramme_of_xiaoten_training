// pages/coach/trainings/edit/index.js
const auth = require('../../../../utils/auth');
const { fetchAll } = require('../../../../utils/db');
const scheduleRules = require('../../../../utils/scheduleRules');
const itemAI = require('../../../../utils/itemAI');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 孩子相关
    nonthing: '',
    childId: '',
    childName: '',
    childAvatar: '',
    children: [],
    selectedChild: {},

    // 训练数据
    date: '',
    startTime: '',        // 【新增】训练开始时间
    duration: '',         // 【新增】训练时长
    durationList: ['30分钟', '45分钟', '60分钟', '90分钟', '120分钟'],
    // 训练项目：一行一个名称，上课时在 in-class 页逐项打卡。
    // 原训练类型/训练名称/自由文本训练内容已移除——type 固定「综合训练」，
    // name 由项目摘要派生，coachContent 由项目名拼接，既有展示位不会空白。
    // 组数/个数输入已下线（2026-09-22）：新行不再带这两个字段，旧课次编辑时
    // 由 _oldRecord 回填原值带回，重存不洗历史数据。
    itemDrafts: [{ name: '' }],
    // 编辑模式：旧 items 的勾选状态按名缓存，重存时按名合并（改名的那项回退未完成）
    oldItemsByName: {},
    // 该学员近期用过的项目名：recentItems 给「常用」点选条（前10），recentItemNames
    // 给保存前的 AI 归一对历史（前30）。名字从源头写法一致，AI 调用量也跟着降
    recentItems: [],
    recentItemNames: [],
    focus: '',
    difficulty: '',
    // 【新增】上课地点，家长端首页「下节课」卡片要展示
    location: '',
    photoUrls: [], //存储上传的照片临时路径

    // 教练信息
    coachInfo: {},

    // 状态
    submitting: false,
    isEdit: false, //  是否编辑模式
    recordId: '',  //编辑时的记录id
    trainingHoursDisplay: '', //【新增】课时显示文本

    // 管理员调度（管理 tab 排课中心）：可把课指派给任意教练、给全部学员排课
    isAdmin: false,
    coaches: [],        // 全部教练（users.role='coach'）
    coachNames: [],     // picker 展示用
    coachIndex: -1,     // -1 = 未选，保存回落到自己/原记录

    // 学员课时余额展示（排课侧只提示不拦截，扣课仍发生在课后完成时）
    balanceText: '',
    balanceLow: false
  },

  // 在 onDurationChange 中更新
  // onDurationChange(e) {
  //   const index = e.detail.value;
  //   const duration = this.data.durationList[index];
  //   const minutes = parseInt(duration);
  //   const trainingHours = !isNaN(minutes) ? Math.round((minutes / 60) * 2) / 2 : 0;
  //   const trainingHoursDisplay = `约 ${duration}，扣减 ${trainingHours} 课时`;

  //   this.setData({ 
  //     duration: duration,
  //     trainingHoursDisplay: trainingHoursDisplay
  //   });
  // },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { childId, id } = options;
    const coachInfo = wx.getStorageSync('coachInfo') || {};
    this.setData({ coachInfo, isAdmin: auth.isAdmin() });

    // 管理员才加载教练列表（指派用）；普通教练保存仍写自己，零感知
    if (auth.isAdmin()) this.loadCoaches();

    if (id) {
      // 编辑模式
      this.setData({ isEdit: true, recordId: id });
      this.loadTrainingRecord(id);
    }

    if (childId) {
      // 传有孩子ID，直接加载该孩子。
      // 本页保存时会写 coachId: 自己，先确认这个孩子是自己名下的。
      // 下面的 loadChildrenList 分支不用校验，那个查询本来就按 coachId 过滤了。
      auth.guardChildAccess(childId).then(ok => {
        if (ok) this.loadChildInfo(childId);
      });
    } else {
      // 没有传，加载该教练所有孩子
      this.loadChildrenList();
    }

    // 设置默认日期为今天
    this.setDefaultDate();
    // 设置默认时间为当前时间
    this.setDefaultTime();
  },

  // 设置默认日期为今天
  setDefaultDate() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    this.setData({ date: today })
  },

  // 【新增】设置默认时间为当前时间
  setDefaultTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    this.setData({ startTime: `${hours}:${minutes}` });
  },

  //加载孩子信息
  loadChildInfo(childId) {
    const db = wx.cloud.database()
    db.collection('children').doc(childId).get().then(res => {
      const child = res.data;
      this.setData({
        childId: child._id,
        childName: child.name,
        childAvatar: child.avatar,
        selectedChild: child
      });
      this.loadRecentItems(child._id);
      this.applyBalance(child);
    });
  },

  // 学员课时余额展示：排课侧只提示不拦截，扣课仍发生在课后完成时
  applyBalance(child) {
    const h = child && child.remainingHours;
    if (typeof h !== 'number') {
      this.setData({ balanceText: '', balanceLow: false });
      return;
    }
    this.setData({
      balanceText: h <= 0 ? '剩余课时 ' + h + '，请及时充值' : '剩余课时 ' + h,
      balanceLow: h <= 0
    });
  },

  // 加载该教练的所有孩子；管理员调度可给全部学员排课，不按自己过滤
  loadChildrenList() {
    const db = wx.cloud.database();
    const query = this.data.isAdmin
      ? db.collection('children')
      : db.collection('children').where({ coachId: this.data.coachInfo._id });
    fetchAll(query).then(list => {
      this.setData({ children: list });
    });
  },

  // 管理员：拉全部教练供指派课次
  loadCoaches() {
    const db = wx.cloud.database();
    fetchAll(db.collection('users').where({ role: 'coach' })).then(list => {
      this.setData({
        coaches: list,
        coachNames: list.map(c => c.name || '未命名教练')
      });
      this.syncCoachPicker();
    }).catch(err => {
      console.error('教练列表加载失败', err);
    });
  },

  // 编辑模式回填：让教练 picker 停在原 coachId 上（记录和教练列表两个异步谁后到都能对上）
  syncCoachPicker() {
    if (!this._recordCoachId || !this.data.coaches.length) return;
    const idx = this.data.coaches.findIndex(c => c._id === this._recordCoachId);
    if (idx >= 0) this.setData({ coachIndex: idx });
  },

  onCoachChange(e) {
    this.setData({ coachIndex: Number(e.detail.value) });
  },

  // 保存写入的教练：管理员选了谁就是谁；编辑模式没选就保留原教练；否则恒为自己
  resolveCoach() {
    const i = this.data.coachIndex;
    if (this.data.isAdmin && i >= 0 && this.data.coaches[i]) {
      const c = this.data.coaches[i];
      return { id: c._id, name: c.name || '' };
    }
    if (this.data.isEdit && this._recordCoachId) {
      return { id: this._recordCoachId, name: this._recordCoachName || '' };
    }
    return { id: this.data.coachInfo._id, name: this.data.coachInfo.name };
  },

  // 加载训练记录(编辑模式)

  loadTrainingRecord() {
    const db = wx.cloud.database();
    db.collection('trainings').doc(this.data.recordId).get().then(res => {
      const record = res.data;

      // 编辑模式是「拿 id 换整条记录」，同样能被改 URL 参数打开别人家的训练，
      // 保存时会带着 coachId: 自己 覆盖回去。
      // 训练记录自己存了 coachId，直接比它，不用再查一次 children。
      // 管理员调度中心要能改任何教练的课次，这里给 isAdmin 开口子（刻意放宽，
      // 仅此一处；其余页面的学员归属校验仍保持教练视角）。
      if (!record || (record.coachId !== auth.getCoachId() && !auth.isAdmin())) {
        console.warn('越权编辑训练记录，已拦截 recordId =', this.data.recordId);
        auth.denyAndLeave('无权编辑该记录');
        return;
      }

      // 留作改课留痕（buildChangeLog 的旧文档）与原教练回填
      this._oldRecord = record;
      this._recordCoachId = record.coachId || '';
      this._recordCoachName = record.coachName || '';

      const oldItems = record.items || [];
      this.setData({
        childId: record.childId,
        childName: record.childName || '',
        childAvatar: record.childAvatar || '',
        date: record.date,
        // 原来这里回填的是页面默认值（打开编辑器的当前时刻），保存一次编辑
        // 就会把上课时间悄悄改掉——改课留痕上线后这是灾难，改为回填原值
        startTime: record.startTime || this.data.startTime,
        duration: record.duration || '',              // 【新增】训练时长
        itemDrafts: oldItems.length
          ? oldItems.map(it => ({ name: (it && it.name) || '', sets: (it && it.sets) || '', reps: (it && it.reps) || '' }))
          : [{ name: '' }],
        oldItemsByName: oldItems.reduce((m, it) => { if (it && it.name) m[it.name] = !!it.done; return m; }, {}),
        focus: record.focus,
        difficulty: record.difficulty,
        location: record.location || '',
        photoUrls: record.photos || []
      });
      this.syncCoachPicker();
      // 如果有孩子id，加载孩子详细信息
      if (record.childId) {
        this.loadChildInfo(record.childId);
      }
    }).catch(err => {
      // get 失败绝不能留在页面：否则 isEdit+recordId 就位、表单全空，
      // 用户重填后保存会盲写这份没经过归属校验的 update
      console.error('加载训练记录失败', err);
      auth.denyAndLeave('记录加载失败');
    });
  },

  // 选择学员
  onChildChange(e) {
    const index = e.detail.value;
    const selectedChild = this.data.children[index];
    this.setData({
      childId: selectedChild._id,
      childName: selectedChild.name,
      childAvatar: selectedChild.avatar,
      selectedChild
    });
    this.loadRecentItems(selectedChild._id);
    this.applyBalance(selectedChild);
  },

  // 选择日期
  onDateChange(e) {
    this.setData({ date: e.detail.value })
  },

  // 【新增】选择时间
  onTimeChange(e) {
    this.setData({ startTime: e.detail.value })
  },


  // 在 onDurationChange 中更新
  onDurationChange(e) {
    const index = e.detail.value;
    const duration = this.data.durationList[index];
    const minutes = parseInt(duration);
    const trainingHours = !isNaN(minutes) ? Math.round((minutes / 60) * 2) / 2 : 0;
    const trainingHoursDisplay = `约 ${duration}，扣减 ${trainingHours} 课时`;

    this.setData({
      duration: duration,
      trainingHoursDisplay: trainingHoursDisplay
    });
  },
  // // // 【新增】选择时长
  // onDurationChange(e) {
  //   const index = e.detail.value;
  //   this.setData({duration: this.data.durationList[index]});

  // },


  // 训练项目：添加一行
  onAddItem() {
    if (this.data.itemDrafts.length >= 10) {
      wx.showToast({ title: '最多添加10个项目', icon: 'none' });
      return;
    }
    this.setData({ itemDrafts: this.data.itemDrafts.concat({ name: '' }) });
  },

  // 训练项目：编辑名称
  onItemInput(e) {
    const i = Number(e.currentTarget.dataset.index);
    const itemDrafts = this.data.itemDrafts.slice();
    if (!itemDrafts[i]) return;
    itemDrafts[i] = Object.assign({}, itemDrafts[i], { name: e.detail.value });
    this.setData({ itemDrafts });
  },

  // 训练项目：删除一行
  onRemoveItem(e) {
    const i = Number(e.currentTarget.dataset.index);
    const itemDrafts = this.data.itemDrafts.slice();
    itemDrafts.splice(i, 1);
    this.setData({ itemDrafts });
  },

  // 该学员近期用过的训练项目名（近 20 节课按日期倒序取，首次出现的顺序即最近用在前）
  loadRecentItems(childId) {
    if (!childId) return;
    const db = wx.cloud.database();
    db.collection('trainings').where({ childId: childId })
      .orderBy('date', 'desc').limit(20).get().then(res => {
        const names = [];
        (res.data || []).forEach(t => {
          (t.items || []).forEach(it => {
            const n = ((it && it.name) || '').trim();
            if (n && names.indexOf(n) < 0) names.push(n);
          });
        });
        this.setData({
          recentItems: names.slice(0, 10),
          recentItemNames: names.slice(0, 30)
        });
      }).catch(() => { /* 点选条加载失败不影响排课，静默 */ });
  },

  // 点「常用」chip：填进第一个空行；没有空行就追加一行；已在列表里则提示
  onRecentItemTap(e) {
    const name = (e.currentTarget.dataset.name || '').trim();
    if (!name) return;
    const drafts = this.data.itemDrafts.slice();
    if (drafts.some(d => d && (d.name || '').trim() === name)) {
      wx.showToast({ title: '已在项目列表里', icon: 'none' });
      return;
    }
    let idx = -1;
    drafts.forEach((d, i) => { if (idx < 0 && d && !(d.name || '').trim()) idx = i; });
    if (idx < 0) {
      if (drafts.length >= 10) {
        wx.showToast({ title: '最多添加10个项目', icon: 'none' });
        return;
      }
      drafts.push({ name: '' });
      idx = drafts.length - 1;
    }
    drafts[idx] = Object.assign({}, drafts[idx], { name });
    this.setData({ itemDrafts: drafts });
  },

  /**
   * 保存前把本次项目名交给 AI 与该学员的历史项目对一对：同义不同写法的
   * （快走200 / 快步走200米）统一成历史写法，聚合与进步对比才认得出是同一个项目。
   * 只在存在「历史里没有精确同名」的项目时才调 AI（省额度）；AI 挂了按原名照存
   * （fail-open），绝不卡保存。归到同名的两行会去重（首行为准）。
   */
  resolveItemNames(items) {
    const history = this.data.recentItemNames || [];
    const names = [];
    items.forEach(it => {
      const n = (it.name || '').trim();
      if (n && names.indexOf(n) < 0) names.push(n);
    });
    const fresh = names.filter(n => history.indexOf(n) < 0);
    if (!fresh.length || !history.length) {
      // 跳过 AI 的两种情形落个日志——「为什么没调 matchNames」不用再去云端日志里猜
      console.log('[排课归一] 跳过 AI：', !history.length ? '该学员暂无历史项目' : '项目名已全部精确命中历史');
      return Promise.resolve(items);
    }

    wx.showLoading({ title: '正在核对项目名', mask: true });
    return itemAI.matchItemNames(history, fresh).then(mappings => {
      wx.hideLoading();
      if (!mappings || !mappings.length) return items;
      const map = {};
      mappings.forEach(m => {
        // 双保险：to 必须是清单里真实存在的写法（服务端已校过，这里防串包）
        if (history.indexOf(m.to) >= 0 || names.indexOf(m.to) >= 0) map[m.from] = m.to;
      });
      const seen = {};
      const out = [];
      items.forEach(it => {
        const name = map[(it.name || '').trim()] || it.name;
        if (seen[name]) return;
        seen[name] = true;
        out.push(Object.assign({}, it, { name }));
      });
      if (out.length < items.length) {
        wx.showToast({ title: '已合并相同项目', icon: 'none' });
      }
      return out;
    }).catch(() => {
      wx.hideLoading();
      return items;
    });
  },

  // 由项目名派生训练名称：≤2 个全列，>2 个取前两个 + 等N项
  deriveTrainingName(names) {
    return names.length > 2 ? names.slice(0, 2).join('、') + '等' + names.length + '项' : names.join('、');
  },

  // 输入训练重点
  onFocusInput(e) {
    this.setData({ focus: e.detail.value });
  },

  // 输入训练难点
  onDifficultyInput(e) {
    this.setData({ difficulty: e.detail.value });
  },

  // 输入上课地点
  onLocationInput(e) {
    this.setData({ location: e.detail.value });
  },

  // 上传照片
  uploadPhotos() {
    const maxCount = 9 - this.data.photoUrls.length;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // chooseMedia 返回的是 tempFiles 数组
        const tempFiles = res.tempFiles;
        // 提取每个文件的临时路径
        console.log("dada", tempFiles);
        const tempFilePaths = tempFiles.map(file => file.tempFilePath);
        const newPhotos = [...this.data.photoUrls, ...tempFilePaths];
        this.setData({ photoUrls: newPhotos });
      },
      fail: (err) => {
        console.error('选择照片失败', err);
        wx.showToast({ title: '选择照片失败', icon: 'none' });
      }
    });
  },

  // 删除照片
  deletePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photoUrls = [...this.data.photoUrls]
    photoUrls.splice(index, 1);
    this.setData({ photoUrls })
  },

  // 【新增】计算训练课时（根据时长）
  calculateTrainingHours() {
    const { duration } = this.data;
    if (!duration) return 1;
    const minutes = parseInt(duration);
    if (isNaN(minutes)) return 1;
    const hours = minutes / 60;
    return Math.round(hours * 2) / 2;  // 保留0.5的精度
  },

  // 提交保存
  onSubmit() {
    // 防重复提交：冲突检测有网络窗口、保存成功后有 1.5 秒回跳窗口，
    // 期间再进来会双写（新增模式落两条重复课次）
    if (this.data.submitting) return;

    // 验证
    if (!this.data.childId) {
      wx.showToast({
        title: '请选择学员',
        icon: 'none'
      });
      return;
    }

    if (!this.data.date) {
      wx.showToast({ title: '请选择训练日期', icon: 'none' })
      return;
    }

    // 预约系统建的课 items/focus/difficulty/location 从源头上就是空，管理员在
    // 调度中心只想改个时间，不该被迫现编这些内容：编辑模式下原值本来为空的
    // 字段放行空值（新增模式照旧必填；原值非空的编辑也照旧必填）
    const oldRecord = this._oldRecord || {};
    const emptyAllowed = (oldVal) => this.data.isEdit && !oldVal;

    // 训练项目必填：上课时靠它逐项打卡；纯空行跳过。
    // sets/reps 输入已下线，仅编辑旧课次时由草稿回填原值带回，保证重存不洗历史数据
    const items = [];
    const drafts = this.data.itemDrafts || [];
    for (let i = 0; i < drafts.length; i++) {
      const dr = drafts[i] || {};
      const name = (dr.name || '').trim();
      // String() 兜底：历史数据里 sets/reps 万一是数字，.trim() 会抛错且在
      // promise 链外、catch 接不住 → 保存静默失败
      const sets = String(dr.sets || '').trim();
      const reps = String(dr.reps || '').trim();
      if (!name && !sets && !reps) continue;
      if (!name) {
        wx.showToast({ title: '请填写第' + (i + 1) + '个项目的名称', icon: 'none' });
        return;
      }
      items.push({ name, done: !!this.data.oldItemsByName[name], sets, reps });
    }
    if (!items.length && !emptyAllowed(oldRecord.items && oldRecord.items.length)) {
      wx.showToast({ title: '请至少添加一个训练项目', icon: 'none' });
      return;
    }

    if (!this.data.focus.trim() && !emptyAllowed(oldRecord.focus)) {
      wx.showToast({ title: '请选择训练重点', icon: 'none' })
      return;
    }

    if (!this.data.difficulty.trim() && !emptyAllowed(oldRecord.difficulty)) {
      wx.showToast({ title: '请选择训练难点', icon: 'none' })
      return;
    }

    // 上课地点必填：家长端首页「下节课」卡片要显示它
    if (!this.data.location.trim() && !emptyAllowed(oldRecord.location)) {
      wx.showToast({ title: '请填写上课地点', icon: 'none' })
      return;
    }

    // 保存前的自动规则：同教练/同学员时间重叠检测。重叠只弹窗确认不硬拦
    // （教练连排、管理员调课是合理场景），检测挂了也不卡保存
    // 校验全过：先 AI 归一项目名（有 loading 遮罩，同样防重复提交），再锁保存
    // 按钮进冲突检测。AI 失败 resolve 原数组，保存链路永不因此中断
    this.resolveItemNames(items).then(finalItems => {
      this.setData({ submitting: true });
      this.checkConflictThenSave(finalItems);
    }).catch(() => {
      this.setData({ submitting: true });
      this.checkConflictThenSave(items);
    });
  },

  /**
   * 保存前冲突检测：按教练、按学员各查一笔当天的课（学员的课可能挂在别的教练
   * 名下，只查教练侧会漏），合并去重后交给 scheduleRules 判区间相交。
   */
  checkConflictThenSave(items) {
    const db = wx.cloud.database();
    const coach = this.resolveCoach();
    const slot = {
      coachId: coach.id,
      childId: this.data.childId,
      startTime: this.data.startTime,
      endTime: this.calculateEndTime(),
      duration: this.data.duration
    };

    Promise.all([
      fetchAll(db.collection('trainings').where({ coachId: slot.coachId, date: this.data.date })),
      fetchAll(db.collection('trainings').where({ childId: slot.childId, date: this.data.date }))
    ]).then(([coachList, childList]) => {
      const merged = {};
      coachList.concat(childList).forEach(t => { if (t && t._id) merged[t._id] = t; });
      const conflicts = scheduleRules.findConflicts(
        slot,
        Object.keys(merged).map(k => merged[k]),
        this.data.isEdit ? this.data.recordId : ''
      );
      if (!conflicts.length) {
        this.doSave(items);
        return;
      }
      const first = conflicts[0];
      const more = conflicts.length > 1 ? ' 等 ' + conflicts.length + ' 节课' : '';
      wx.showModal({
        title: '时间冲突提醒',
        content: '与「' + (first.childName || '学员') + '」' + (first.startTime || '') + ' 开始的课' + more + '时间重叠，仍要保存吗？',
        confirmText: '仍要保存',
        cancelText: '再看看',
        success: (res) => {
          if (res.confirm) {
            this.doSave(items);
          } else {
            // 「再看看」取消：解锁保存按钮（submitting 在检测前就置位了）
            this.setData({ submitting: false });
          }
        }
      });
    }).catch(err => {
      console.error('冲突检测失败，按无冲突继续保存', err);
      this.doSave(items);
    });
  },

  // 真正落库（原 onSubmit 的保存链路）；items 由 onSubmit 构建后逐段传下来
  doSave(items) {
    this.setData({ submitting: true });

    const coach = this.resolveCoach();

    // 计算训练课时
    const trainingHours = this.calculateTrainingHours();

    // 课时余额警示：不拦保存（扣课在课后完成时），只提醒先安排续费
    const balance = this.data.selectedChild && this.data.selectedChild.remainingHours;
    if (typeof balance === 'number' && balance <= 0) {
      wx.showToast({ title: '该学员课时不足，请及时充值', icon: 'none' });
    }

    // 如果有照片需要上传到云存储
    const uploadTasks = this.uploadPhotosToCloud();

    Promise.all(uploadTasks).then(photoUrls => {
      // 构建训练记录数据
      const db = wx.cloud.database();
      const trainingData = {
        childId: this.data.childId,
        childName: this.data.childName,
        childAvatar: this.data.childAvatar,
        coachId: coach.id,
        coachName: coach.name,
        date: this.data.date,
        startTime: this.data.startTime,           // 【新增】训练开始时间
        duration: this.data.duration,              // 【新增】训练时长
        endTime: this.calculateEndTime(),          // 【新增】计算结束时间
        day: this.getWeekday(this.data.date),
        time: '',  // 可根据需要添加时间字段
        // 训练类型不再让教练选；编辑时保留原 type（预约建的课程是「基础体能」，
        // 不能被静默改写成「综合训练」）
        type: (this.data.isEdit && this._oldRecord && this._oldRecord.type) || '综合训练',
        focus: this.data.focus,
        difficulty: this.data.difficulty,
        // 键名保持 coachContent（训练内容），不动 trainingContent——
        // 那是家长预约(book-class)写入的字段，本页整条 update 不能覆盖它。
        location: this.data.location,
        photos: photoUrls,
        photoCount: photoUrls.length,
        trainingHours: trainingHours,           // 【新增】记录本次训练的课时
        // status 不在这里写：新增模式才置 'pending'，编辑必须保留原状态——
        // 否则改个地点就把 finished/in_class/scheduled 打回 pending，
        // 课后消课的幂等守卫（判 status==='finished'）被绕过会双扣课时
        updatedAt: new Date()
      };

      // 项目三件套（name/items/coachContent）只在真有项目时写：编辑预约建的课
      // 允许不带项目（原值为空放行），此时保留原 name（如「张三课」）不被空摘要覆写
      if (items.length) {
        trainingData.name = this.deriveTrainingName(items.map(it => it.name));
        // 上课/课后逐项打卡用；done 为勾选状态（编辑重存按名合并旧勾选，
        // 防止把课上勾过的清掉），sets/reps 仅旧课次回填带回
        trainingData.items = items;
        trainingData.coachContent = items.map(it => {
          const amount = [it.sets ? it.sets + '组' : '', it.reps ? it.reps + '次' : ''].filter(Boolean).join('×');
          return amount ? it.name + '（' + amount + '）' : it.name;
        }).join('；');
      }

      let savePromise;
      if (this.data.isEdit) {
        // 改课留痕：与原记录 diff 出改了什么，追加进 changeLogs（保留最近 20 条）。
        // endTime 由 startTime+duration 派生，不进 diff（否则改时间会记两条）
        const changeLog = scheduleRules.buildChangeLog(this._oldRecord || {}, {
          date: trainingData.date,
          startTime: trainingData.startTime,
          duration: trainingData.duration,
          location: trainingData.location,
          childId: trainingData.childId,
          childName: trainingData.childName,
          coachId: trainingData.coachId,
          coachName: trainingData.coachName
        }, coach.name);
        if (changeLog) {
          trainingData.changeLogs = scheduleRules.appendChangeLog(
            (this._oldRecord && this._oldRecord.changeLogs) || [],
            changeLog
          );
        }
        // 编辑模式：只更新训练记录，不扣减学时
        savePromise = db.collection('trainings').doc(this.data.recordId).update({
          data: trainingData
        });
      } else {
        // 新增模式：只添加训练记录，学时在下课后扣减
        trainingData.createdAt = new Date();
        trainingData.status = 'pending';   // 课程状态：pending(未上课)；编辑模式不碰 status
        console.log('准备添加训练记录:', trainingData);
        savePromise = db.collection('trainings').add({ data: trainingData });
      }
      return savePromise;
    }).then(() => {
      // 标记成功：finally 里不再解锁按钮，回跳前的 1.5 秒窗口内点不了第二次
      this._saved = true;
      wx.showToast({ title: '保存成功', icon: "success" });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }).catch(err => {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }).finally(() => {
      // 只有失败才解锁；成功路径页面即将销毁，保持锁定防双写
      if (!this._saved) this.setData({ submitting: false });
    })
  },

  // 【新增】计算结束时间
  calculateEndTime() {
    const { startTime, duration } = this.data;
    if (!startTime || !duration) return '';

    const [hours, minutes] = startTime.split(':').map(Number);
    const durationMinutes = parseInt(duration);

    const endDate = new Date();
    endDate.setHours(hours);
    endDate.setMinutes(minutes + durationMinutes);

    const endHours = String(endDate.getHours()).padStart(2, '0');
    const endMinutes = String(endDate.getMinutes()).padStart(2, '0');

    return `${endHours}:${endMinutes}`;
  },


  // 上传照片到云存储（返回Promise数组）
  uploadPhotosToCloud() {
    const tasks = [];
    for (let i = 0; i < this.data.photoUrls.length; i++) {
      const filePath = this.data.photoUrls[i];
      // 如果已经是云存储路径，跳过上传
      if (filePath.startsWith('cloud://')) {
        tasks.push(Promise.resolve(filePath));
        continue;
      }
      const cloudPath = `trainings/${this.data.childId}/${Date.now()}_${i}.jpg`;
      const task = wx.cloud.uploadFile({
        cloudPath,
        filePath
      }).then(res => res.fileID);
      tasks.push(task);
    }
    return tasks;
  },

  // 根据日期获取星期几
  getWeekday(dateStr) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const date = new Date(dateStr);
    return weekdays[date.getDay()];
  },

  // 【新增】获取课时显示文本
  getTrainingHoursDisplay() {
    const { duration } = this.data;
    if (!duration) return '';
    const minutes = parseInt(duration);
    if (isNaN(minutes)) return '';
    const hours = minutes / 60;
    const trainingHours = Math.round(hours * 2) / 2;
    return `约 ${duration}，扣减 ${trainingHours} 课时`;
  },


  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})