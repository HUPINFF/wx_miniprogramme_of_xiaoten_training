// pages/coach/reports/edit/index.js
// 成长报告生成/编辑器：选周期 → 系统按 6 段骨架自动出草稿（数据块预填）
// → 教练逐块润色（点评/标签/照片/计划/家长行动）→ 预览 → 存草稿或发布。
// 「模板报告」和「自定义报告」在这里是同一个东西：区别只是教练改多少。
const auth = require('../../../../utils/auth');
const rb = require('../../../../utils/reportBuilder');

/** 教练内容块：换周期重新生成时要保留，不能被新数据冲掉 */
const COACH_KINDS = ['photos', 'comment', 'plan', 'action'];

Page({

  data: {
    loading: true,
    loadFail: false,
    childId: '',
    childName: '',
    type: 'monthly',        // monthly | quarterly（入口定死，编辑器里不换类型）
    typeLabel: '月报',
    reportId: '',           // 有值 = 编辑已有草稿
    loadedStatus: 'draft',
    periodOptions: [],      // 选择项（最近 12 个月 / 6 个季度）
    periodIndex: 0,
    period: null,           // monthRange/quarterRange 结果
    sections: [],
    commentTagMap: {},      // WXML 里不能调 indexOf，选中态用 map 表达
    presets: {
      tags: rb.PRESET_TAGS,
      plan: rb.PRESET_PHRASES_PLAN,
      action: rb.PRESET_PHRASES_ACTION
    },
    previewMode: false,
    saving: false,
    uploading: false,
    // 训练照片选择面板（photosAvideos 按月归档的训练照片）
    pickerOpen: false,
    pickerLoading: false,
    pickerList: [],
    pickerSelMap: {},
    pickerCount: 0
  },

  onLoad(options) {
    const type = options.type === 'quarterly' ? 'quarterly' : 'monthly';
    const periodOptions = type === 'quarterly'
      ? rb.buildQuarterOptions(new Date())
      : rb.buildMonthOptions(new Date());

    this.setData({
      childId: options.childId || '',
      type: type,
      typeLabel: rb.reportTypeLabel(type),
      periodOptions: periodOptions
    });

    if (!options.childId) {
      this.finishLoadFail('缺少学员参数');
      return;
    }
    this.loadChildAndInit(options.reportId || '');
  },

  loadChildAndInit(reportId) {
    const db = wx.cloud.database();
    db.collection('children').doc(this.data.childId).get().then(childRes => {
      if (!auth.canViewChild(childRes.data, auth.getCoachId())) {
        auth.denyAndLeave('无权为该学员生成报告');
        return;
      }
      const child = childRes.data || {};
      this.childName = child.name || '';
      this.goal = child.goal || '';
      // 冗余进报告文档：将来 reports 上安全规则（家长按 parentOpenId 读）时直接可用
      this.parentOpenId = child.parentOpenId || '';
      this.setData({ childName: this.childName });

      if (reportId) {
        return this.loadExistingReport(reportId);
      }
      return this.checkDuplicateThenCreate();
    }).catch(err => {
      console.error('打开报告编辑器失败', err);
      this.finishLoadFail('加载失败');
    });
  },

  finishLoadFail(msg) {
    this.setData({ loading: false, loadFail: true });
    wx.showToast({ title: msg, icon: 'none' });
  },

  /**
   * 同学员同类型同周期只该有一份报告：默认周期已有时直接引导去编辑，
   * 避免教练生成两份同月报告后不知道发哪份。
   */
  checkDuplicateThenCreate() {
    const db = wx.cloud.database();
    const opt = this.data.periodOptions[0];
    const period = this.rangeOf(opt);
    db.collection('reports').where({
      childId: this.data.childId,
      type: this.data.type,
      periodStart: period.start
    }).orderBy('updatedAt', 'desc').limit(1).get().then(res => {
      if (res.data && res.data.length) {
        const existing = res.data[0];
        wx.showModal({
          title: '该周期已有' + this.data.typeLabel,
          content: period.label + '的' + this.data.typeLabel + '已存在，可以直接编辑它。',
          confirmText: '去编辑',
          cancelText: '再建一份',
          success: (r) => {
            if (r.confirm) {
              wx.redirectTo({
                url: '/pages/coach/reports/edit/index?childId=' + this.data.childId +
                     '&type=' + this.data.type + '&reportId=' + existing._id
              });
            } else {
              this.createNew();
            }
          }
        });
      } else {
        this.createNew();
      }
    }).catch(err => {
      // 查重失败不阻塞创建（最坏情况是多一份草稿，教练可删）
      console.error('报告查重失败', err);
      this.createNew();
    });
  },

  createNew() {
    this.buildForPeriod(0).then(({ period, sections }) => {
      this.setData({ loading: false, period: period, sections: sections, periodIndex: 0 });
    }).catch(err => {
      console.error('生成报告草稿失败', err);
      this.finishLoadFail('生成失败');
    });
  },

  loadExistingReport(reportId) {
    const db = wx.cloud.database();
    db.collection('reports').doc(reportId).get().then(res => {
      const report = res.data;
      if (!report || report.coachId !== auth.getCoachId()) {
        auth.denyAndLeave('无权编辑该报告');
        return;
      }
      // 入口参数和报告对不上（比如月报入口带了季报的 reportId）：
      // 不拦住的话保存会把报告的类型/所属学员悄悄改掉
      if (report.type !== this.data.type || report.childId !== this.data.childId) {
        auth.denyAndLeave('报告参数不匹配');
        return;
      }
      // 把选择器定位到报告存的周期。周期在选择窗口外（很早以前的报告）时
      // 把报告自己的周期补进选项，否则 findIndex 落空会让保存把 year/month 改成当前月
      let options = this.data.periodOptions;
      let idx = options.findIndex(o =>
        this.data.type === 'quarterly'
          ? (o.year === report.year && o.quarter === report.quarter)
          : (o.year === report.year && o.month === report.month)
      );
      if (idx < 0 && typeof report.year === 'number' &&
          (this.data.type === 'quarterly' ? typeof report.quarter === 'number' : typeof report.month === 'number')) {
        options = [{
          label: report.periodLabel || '',
          year: report.year,
          month: this.data.type === 'monthly' ? report.month : null,
          quarter: this.data.type === 'quarterly' ? report.quarter : null
        }].concat(options);
        idx = 0;
      }
      if (idx < 0) {
        this.finishLoadFail('报告周期数据不完整');
        return;
      }
      this.setData({
        loading: false,
        reportId: reportId,
        loadedStatus: report.status || 'draft',
        periodOptions: options,
        period: {
          start: report.periodStart,
          end: report.periodEnd,
          label: report.periodLabel,
          startTs: report.startTs || 0,
          endTs: report.endTs || 0
        },
        sections: this.normalizeSections(report.sections || []),
        periodIndex: idx
      });
      this.syncCommentTagMap();
    }).catch(err => {
      console.error('加载报告失败', err);
      this.finishLoadFail('报告不存在或已删除');
    });
  },

  /** 早期草稿可能缺 videos/tags 字段，补齐再进编辑器（Object.assign 后写的字段优先） */
  normalizeSections(sections) {
    return (sections || []).map(s => {
      if (s.kind === 'photos') return Object.assign({ videos: [] }, s);
      if (s.kind === 'comment' || s.kind === 'plan' || s.kind === 'action') {
        return Object.assign({ tags: [] }, s);
      }
      return s;
    });
  },

  rangeOf(opt) {
    return this.data.type === 'quarterly'
      ? rb.quarterRange(opt.year, opt.quarter)
      : rb.monthRange(opt.year, opt.month);
  },

  /** 拉一个周期内的全部原始数据并聚合成草稿块 */
  buildForPeriod(index) {
    const opt = this.data.periodOptions[index];
    const period = this.rangeOf(opt);
    const db = wx.cloud.database();
    const _ = db.command;
    const inRange = (r) => {
      const t = (r && r.createdAt) ? new Date(r.createdAt).getTime() : 0;
      return t >= period.startTs && t <= period.endTs;
    };

    return Promise.all([
      db.collection('trainings').where({
        childId: this.data.childId,
        date: _.gte(period.start).and(_.lte(period.end))
      }).limit(100).get(),
      db.collection('performance').where({
        childId: this.data.childId,
        weekDate: _.gte(period.start).and(_.lte(period.end))
      }).limit(100).get(),
      // assessments / hoursRecords 的 createdAt 是 Date。课时流水每结一节课就 +1 条，
      // 整表按学员拉回会被小程序端 100 条上限静默截断，老学员的消耗课时会算错——
      // 必须按周期做 Date 范围查询（hours-detail 页同款写法），单周期最多几十条
      db.collection('assessments').where({
        childId: this.data.childId,
        createdAt: _.gte(new Date(period.startTs)).and(_.lte(new Date(period.endTs)))
      }).limit(100).get(),
      db.collection('hoursRecords').where({
        childId: this.data.childId,
        createdAt: _.gte(new Date(period.startTs)).and(_.lte(new Date(period.endTs)))
      }).orderBy('createdAt', 'desc').limit(100).get()
    ]).then(([tRes, pRes, aRes, hRes]) => {
      const sections = rb.buildDraftSections({
        period: period,
        trainings: tRes.data || [],
        performances: pRes.data || [],
        assessments: (aRes.data || []).filter(inRange),
        hoursRecords: (hRes.data || []).filter(inRange),
        goal: this.goal || ''
      });
      return { period: period, sections: sections };
    });
  },

  /** 换周期：数据块按新周期重算，教练已写的内容原样保留 */
  onPeriodChange(e) {
    const index = Number(e.detail.value);
    if (isNaN(index) || index === this.data.periodIndex) return;

    const hasCoachContent = this.data.sections.some(s =>
      COACH_KINDS.indexOf(s.kind) !== -1 &&
      (s.content || (s.tags && s.tags.length > 0) || (s.fileIDs && s.fileIDs.length > 0))
    );

    const apply = () => {
      wx.showLoading({ title: '重新生成...' });
      this.buildForPeriod(index).then(({ period, sections }) => {
        this.setData({
          periodIndex: index,
          period: period,
          sections: rb.mergeDraftSections(sections, this.data.sections)
        });
        wx.hideLoading();
      }).catch(err => {
        console.error('切换周期失败', err);
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      });
    };

    if (hasCoachContent) {
      wx.showModal({
        title: '切换周期',
        content: '数据块将按新周期重新统计，你写的点评、挑的照片会保留。',
        confirmText: '重新生成',
        success: (r) => { if (r.confirm) apply(); }
      });
    } else {
      apply();
    }
  },

  // ==================== 教练块编辑 ====================

  /** 文字块的统一输入：data-kind 指明写的是哪一块 */
  onSectionInput(e) {
    this.updateSection(e.currentTarget.dataset.kind, { content: e.detail.value });
  },

  updateSection(kind, patch) {
    const sections = this.data.sections.map(s =>
      s.kind === kind ? Object.assign({}, s, patch) : s
    );
    this.setData({ sections: sections });
    if (kind === 'comment') this.syncCommentTagMap();
  },

  /** 同步点评标签的选中态 map（WXML 表达式不能调 indexOf） */
  syncCommentTagMap() {
    const comment = this.data.sections.find(s => s.kind === 'comment');
    const map = {};
    ((comment && comment.tags) || []).forEach(t => { map[t] = true; });
    this.setData({ commentTagMap: map });
  },

  onTagToggle(e) {
    const tag = e.currentTarget.dataset.tag;
    const comment = this.data.sections.find(s => s.kind === 'comment');
    if (!comment) return;
    const tags = (comment.tags || []).slice();
    const idx = tags.indexOf(tag);
    if (idx >= 0) {
      tags.splice(idx, 1);
    } else {
      if (tags.length >= 6) {
        wx.showToast({ title: '最多选 6 个标签', icon: 'none' });
        return;
      }
      tags.push(tag);
    }
    this.updateSection('comment', { tags: tags });
  },

  /** 常用语：整段插入光标内容末尾（手机打字慢，这是这类功能最大的效率点） */
  onInsertPhrase(e) {
    const { kind, text } = e.currentTarget.dataset;
    const sec = this.data.sections.find(s => s.kind === kind);
    if (!sec) return;
    this.updateSection(kind, { content: sec.content ? sec.content + '\n' + text : text });
  },

  /** 下阶段计划一键带入本阶段目标（children.goal） */
  onBringGoal() {
    const plan = this.data.sections.find(s => s.kind === 'plan');
    if (!plan) return;
    if (plan.content) {
      wx.showToast({ title: '已有内容，请手动参考', icon: 'none' });
      return;
    }
    this.updateSection('plan', { content: '围绕本阶段目标「' + plan.goal + '」安排下一阶段训练。' });
  },

  // ==================== 精彩证据照片 ====================

  addPhotos() {
    if (this.data.uploading) return;
    const sec = this.data.sections.find(s => s.kind === 'photos');
    if (!sec) return;
    const remainPhotos = 9 - (sec.fileIDs || []).length;
    const remainVideos = 3 - (sec.videos || []).length;
    if (remainPhotos <= 0 && remainVideos <= 0) {
      wx.showToast({ title: '照片视频已选满', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: Math.min(remainPhotos + remainVideos, 9),
      mediaType: ['image', 'video'],
      sizeType: ['compressed'],
      success: (res) => {
        const files = res.tempFiles || [];
        // chooseMedia 分不清单类型上限，超了在这里按剩余名额截掉
        const images = files.filter(f => f.fileType !== 'video').slice(0, Math.max(remainPhotos, 0));
        const videos = files.filter(f => f.fileType === 'video').slice(0, Math.max(remainVideos, 0));
        if (images.length + videos.length < files.length) {
          wx.showToast({ title: '最多 9 张照片 / 3 个视频', icon: 'none' });
        }
        this.uploadPhotos(images.concat(videos));
      }
    });
  },

  uploadPhotos(files) {
    if (!files || !files.length) return;
    this.setData({ uploading: true });
    // mask 挡住上传期间的点击，配合 saveDraft 的 uploading 守卫，
    // 避免「照片还在传、报告已经存出去」把在传的照片静默丢掉
    wx.showLoading({ title: '上传中...', mask: true });
    const tasks = files.map((file, i) => wx.cloud.uploadFile({
      cloudPath: 'reports/' + this.data.childId + '/' + Date.now() + '_' + i +
        (file.fileType === 'video' ? '.mp4' : '.jpg'),
      filePath: file.tempFilePath
    }).then(r => ({ fileID: r.fileID, isVideo: file.fileType === 'video' })));

    Promise.all(tasks).then(results => {
      const sec = this.data.sections.find(s => s.kind === 'photos');
      this.updateSection('photos', {
        fileIDs: (sec.fileIDs || []).concat(results.filter(r => !r.isVideo).map(r => r.fileID)),
        videos: (sec.videos || []).concat(results.filter(r => r.isVideo).map(r => r.fileID))
      });
      wx.hideLoading();
    }).catch(err => {
      console.error('照片上传失败', err);
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }).then(() => {
      this.setData({ uploading: false });
    });
  },

  removePhoto(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const sec = this.data.sections.find(s => s.kind === 'photos');
    if (!sec || isNaN(idx)) return;
    const fileIDs = (sec.fileIDs || []).slice();
    fileIDs.splice(idx, 1);
    this.updateSection('photos', { fileIDs: fileIDs });
  },

  removeVideo(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const sec = this.data.sections.find(s => s.kind === 'photos');
    if (!sec || isNaN(idx)) return;
    const videos = (sec.videos || []).slice();
    videos.splice(idx, 1);
    this.updateSection('photos', { videos: videos });
  },

  // ==================== 从训练记录选照片 ====================

  noop() {},

  /**
   * 打开训练媒体面板：两个来源并取——
   *  1) trainings.photos：每次训练直接挂的照片（fileID 数组，upload-photos 会和归档同步写，
   *     但老数据/手工录的课可能只有这一处；trainings 没有视频字段）
   *  2) photosAvideos：按（学员, 月份）归档的训练照片 + 视频
   * 按 fileID 去重合并（最多展示 60 项），训练记录排前面（带日期、离上课最近）。
   * 两个来源各自 fail-soft：一边挂了另一边照常展示。
   */
  openAlbumPicker() {
    if (this.data.pickerLoading) return;
    this.setData({ pickerOpen: true, pickerLoading: true, pickerList: [], pickerSelMap: {}, pickerCount: 0 });
    const db = wx.cloud.database();

    const safeGet = (query, label) => query.then(res => res.data || []).catch(err => {
      console.error('加载训练照片失败（' + label + '）', err);
      return [];
    });

    Promise.all([
      safeGet(db.collection('trainings').where({ childId: this.data.childId })
        .orderBy('date', 'desc').limit(24).get(), 'trainings'),
      safeGet(db.collection('photosAvideos').where({ childId: this.data.childId })
        .orderBy('yearMonth', 'desc').limit(24).get(), 'photosAvideos')
    ]).then(([trainings, archives]) => {
      const list = [];
      const seen = {};
      const pushMedia = (fileIDs, isVideo) => {
        (fileIDs || []).forEach(fid => {
          if (fid && list.length < 60 && !seen[fid]) {
            seen[fid] = true;
            list.push({ fileID: fid, isVideo: isVideo });
          }
        });
      };
      trainings.forEach(t => pushMedia(t.photos, false));
      archives.forEach(doc => {
        pushMedia(doc.photos, false);
        pushMedia(doc.videos, true);
      });

      this.setData({ pickerLoading: false, pickerList: list });
      if (!list.length) {
        wx.showToast({ title: '还没有训练照片或视频，可先用手机上传', icon: 'none' });
      }
    });
  },

  togglePickerItem(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const item = this.data.pickerList.find(m => m.fileID === id);
    if (!item) return;
    const sec = this.data.sections.find(s => s.kind === 'photos');
    const inReport = item.isVideo
      ? sec && (sec.videos || []).indexOf(id) !== -1
      : sec && (sec.fileIDs || []).indexOf(id) !== -1;
    if (inReport) {
      wx.showToast({ title: '已在报告中', icon: 'none' });
      return;
    }
    const map = Object.assign({}, this.data.pickerSelMap);
    if (map[id]) {
      delete map[id];
    } else {
      // 分类型限量：照片 9 张、视频 3 个（报告里已有的 + 本次勾选的）
      const selIds = Object.keys(map);
      const selVideos = selIds.filter(selId => {
        const m = this.data.pickerList.find(x => x.fileID === selId);
        return m && m.isVideo;
      }).length;
      if (item.isVideo) {
        if (((sec && sec.videos) || []).length + selVideos >= 3) {
          wx.showToast({ title: '最多 3 个视频', icon: 'none' });
          return;
        }
      } else if (((sec && sec.fileIDs) || []).length + (selIds.length - selVideos) >= 9) {
        wx.showToast({ title: '最多 9 张照片', icon: 'none' });
        return;
      }
      map[id] = true;
    }
    this.setData({ pickerSelMap: map, pickerCount: Object.keys(map).length });
  },

  confirmPicker() {
    const selMap = this.data.pickerSelMap;
    const ids = Object.keys(selMap);
    if (!ids.length) {
      this.setData({ pickerOpen: false });
      return;
    }
    // 按类型拆开：照片进 fileIDs，视频进 videos
    const imgIDs = [];
    const vidIDs = [];
    this.data.pickerList.forEach(m => {
      if (!selMap[m.fileID]) return;
      (m.isVideo ? vidIDs : imgIDs).push(m.fileID);
    });
    const sec = this.data.sections.find(s => s.kind === 'photos');
    this.updateSection('photos', {
      fileIDs: (sec.fileIDs || []).concat(imgIDs),
      videos: (sec.videos || []).concat(vidIDs)
    });
    this.setData({ pickerOpen: false, pickerSelMap: {}, pickerCount: 0 });
  },

  closePicker() {
    this.setData({ pickerOpen: false, pickerSelMap: {}, pickerCount: 0 });
  },

  // ==================== 预览 / 保存 / 发布 ====================

  onPreviewToggle() {
    this.setData({ previewMode: !this.data.previewMode });
  },

  saveDraft(publish) {
    if (this.data.saving) return;
    if (this.data.uploading) {
      // 上传还没落进 sections 就保存 = 在传的照片/视频会被静默丢出报告
      wx.showToast({ title: '照片上传中，请稍候', icon: 'none' });
      return;
    }
    const sections = this.data.sections;

    if (publish) {
      const comment = sections.find(s => s.kind === 'comment');
      const hasComment = comment && (comment.content || (comment.tags && comment.tags.length > 0));
      if (!hasComment) {
        wx.showToast({ title: '发布前请写教练点评', icon: 'none' });
        return;
      }
    }

    const opt = this.data.periodOptions[this.data.periodIndex];
    const period = this.data.period || this.rangeOf(opt);
    const doc = {
      childId: this.data.childId,
      childName: this.childName || '',
      parentOpenId: this.parentOpenId || '',
      coachId: auth.getCoachId(),
      type: this.data.type,
      year: opt.year,
      month: opt.month || null,
      quarter: opt.quarter || null,
      periodStart: period.start,
      periodEnd: period.end,
      periodLabel: period.label,
      startTs: period.startTs,
      endTs: period.endTs,
      status: publish ? 'published' : 'draft',
      sections: sections,
      goalSnapshot: this.goal || '',
      updatedAt: new Date()
    };

    this.setData({ saving: true });
    wx.showLoading({ title: publish ? '发布中...' : '保存中...' });
    const db = wx.cloud.database();

    const writeDoc = () => {
      const op = this.data.reportId
        ? db.collection('reports').doc(this.data.reportId).update({ data: doc }).then(() => this.data.reportId)
        : db.collection('reports').add({ data: doc }).then(res => res._id);

      op.then(id => {
        wx.hideLoading();
        if (publish) {
          wx.showToast({ title: '已发布', icon: 'success' });
          this.leaveLater(() => {
            wx.redirectTo({ url: '/pages/coach/reports/detail/index?id=' + id });
          }, 650);
        } else {
          // 记下 id：接着改再存走更新，不会存出一堆重复草稿。
          // saving 保持 true 挡住离场前这 650ms 的重复点击，页面马上就退出了
          this.setData({ reportId: id, loadedStatus: 'draft' });
          wx.showToast({ title: '草稿已保存', icon: 'success' });
          this.leaveLater(() => { wx.navigateBack(); }, 650);
        }
      }).catch(err => {
        console.error('保存报告失败', err);
        wx.hideLoading();
        this.setData({ saving: false });
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
    };

    if (this.data.reportId) {
      writeDoc();
      return;
    }

    // 落库前最后查一次重：入口查重只覆盖默认周期，教练切到别的周期再保存时，
    // 这里是唯一能拦住「同周期两份报告」的地方
    db.collection('reports').where({
      childId: this.data.childId,
      type: this.data.type,
      periodStart: period.start
    }).orderBy('updatedAt', 'desc').limit(1).get().then(res => {
      if (!(res.data && res.data.length)) {
        writeDoc();
        return;
      }
      const existing = res.data[0];
      wx.hideLoading();
      wx.showModal({
        title: '该周期已有' + this.data.typeLabel,
        content: period.label + '的' + this.data.typeLabel + '已经有一份了，避免重复，去编辑那份吗？',
        confirmText: '去编辑',
        cancelText: '仍要另存',
        success: (r) => {
          if (r.confirm) {
            wx.redirectTo({
              url: '/pages/coach/reports/edit/index?childId=' + this.data.childId +
                   '&type=' + this.data.type + '&reportId=' + existing._id
            });
          } else {
            writeDoc();
          }
        }
      });
    }).catch(err => {
      // 查重失败不阻塞保存（最坏情况是多一份，教练可删）
      console.error('保存前查重失败', err);
      writeDoc();
    });
  },

  onSaveDraft() { this.saveDraft(false); },

  onPublish() { this.saveDraft(true); },

  /** 延迟离场统一入口：句柄记在实例上，教练在窗口内手动返回时由 onUnload 取消，
      否则定时器触发时只看栈长，防不住本页已出栈后的二次 navigateBack/redirectTo */
  leaveLater(fn, delay) {
    if (this._leaveTimer) clearTimeout(this._leaveTimer);
    this._leaveTimer = setTimeout(fn, delay);
  },

  onUnload() {
    if (this._leaveTimer) {
      clearTimeout(this._leaveTimer);
      this._leaveTimer = null;
    }
  },

  onDeleteDraft() {
    if (!this.data.reportId) return;
    wx.showModal({
      title: '删除草稿',
      content: '删掉后不可恢复，确定删除？',
      confirmColor: '#ff3b30',
      success: (r) => {
        if (!r.confirm) return;
        const db = wx.cloud.database();
        db.collection('reports').doc(this.data.reportId).remove().then(() => {
          wx.showToast({ title: '已删除', icon: 'success' });
          this.leaveLater(() => { wx.navigateBack(); }, 650);
        }).catch(err => {
          console.error('删除草稿失败', err);
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      }
    });
  }
});
