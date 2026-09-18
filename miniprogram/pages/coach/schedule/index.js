// pages/coach/schedule/index.js — 教练端「今日课」
// 查询逻辑来自 pages/coach/workbench/index.js 的 loadTodayTrainings()，
// 但补了三个修正：onShow 空值守卫、查询 .catch()、按开始时间排序。
const db = wx.cloud.database();
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

Page({
  data: {
    coachInfo: {},
    dateLabel: '',
    trainings: [],
    loading: true
  },

  onLoad() {
    this.setData({ dateLabel: this.buildDateLabel(new Date()) });
    this.init();
  },

  onShow() {
    // 从 in-class / post-class 返回后刷新。
    // 首次进入时 coachInfo 还没到，跳过，避免用 undefined 的 coachId 空查一次
    // （workbench 的 onShow 就是无守卫调用，首次会多发一次请求）。
    if (this.data.coachInfo._id) this.loadTrainings();
  },

  async init() {
    try {
      await this.loadCoachInfo();
      await this.loadTrainings();
    } finally {
      this.setData({ loading: false });
    }
  },

  /* ==================== 工具 ==================== */
  getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  buildDateLabel(d) {
    return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEK[d.getDay()]}`;
  },

  /* ==================== 数据 ==================== */
  loadCoachInfo() {
    return db.collection('users').where({
      _openid: wx.getStorageSync('openid'),
      role: 'coach'
    }).get().then(res => {
      if (res.data.length > 0) {
        const coachInfo = res.data[0];
        // coachInfo 缓存已是全项目约定（appointments / children.list / performance.weekly 等 7 处读取）
        wx.setStorageSync('coachInfo', coachInfo);
        this.setData({ coachInfo });
      } else {
        wx.showToast({ title: '未找到教练信息', icon: 'none' });
      }
    }).catch(err => {
      console.error('加载教练信息失败', err);
      wx.showToast({ title: '未找到教练信息', icon: 'none' });
    });
  },

  loadTrainings() {
    const coachId = this.data.coachInfo._id;
    if (!coachId) {
      this.setData({ trainings: [], loading: false });
      return Promise.resolve();
    }

    const today = this.getTodayDateString();
    const now = new Date();

    return db.collection('trainings').where({
      date: today,
      coachId: coachId
    }).orderBy('startTime', 'asc').get().then(async res => {
      // 补齐学员姓名（老数据可能没有 childName 字段）
      const childIds = Array.from(new Set(res.data.map(t => t.childId).filter(Boolean)));
      let childInfoMap = {};
      if (childIds.length > 0) {
        const _ = db.command;
        const childRes = await db.collection('children').where({ _id: _.in(childIds) }).get();
        childInfoMap = childRes.data.reduce((map, c) => { map[c._id] = c; return map; }, {});
      }

      const trainings = res.data.map(t => {
        // 今天才能开课，所以 canStart 按今天的时分算即可
        let canStart = true;
        if (t.startTime) {
          const [hour, minute] = t.startTime.split(':').map(Number);
          canStart = now >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
        }

        const status = t.status || 'pending';
        let statusText = '上课';
        let statusClass = 'ready';
        if (status === 'in_class') {
          statusText = '上课中';
          statusClass = 'ongoing';
        } else if (status === 'finished') {
          statusText = '已下课';
          statusClass = 'done';
        } else if (!canStart) {
          statusText = '未到时间';
          statusClass = 'wait';
        }

        const child = childInfoMap[t.childId];
        return {
          ...t,
          childName: (child && child.name) || t.childName || '未知学员',
          canStart,
          status,
          statusText,
          statusClass
        };
      });

      this.setData({ trainings, loading: false });
    }).catch(err => {
      // workbench 版本没有 catch，查询失败会永远卡在骨架屏
      console.error('加载今日课程失败', err);
      this.setData({ trainings: [], loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  /* ==================== 交互 ==================== */
  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) wx.navigateTo({ url: `/pages/coach/training-detail/index?id=${id}` });
  },

  // 状态流转与 workbench.goToClass() 一致
  goToClass(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) {
      wx.showToast({ title: '数据错误', icon: 'none' });
      return;
    }

    const training = this.data.trainings.find(t => t._id === id);
    if (!training) {
      wx.showToast({ title: '未找到训练', icon: 'none' });
      return;
    }

    if (training.status === 'in_class') {
      wx.navigateTo({ url: `/pages/coach/in-class/index?trainingId=${id}` });
      return;
    }

    if (training.status === 'finished') {
      wx.showToast({ title: '课程已结束', icon: 'none' });
      return;
    }

    if (!training.canStart) {
      wx.showToast({ title: '未到上课时间', icon: 'none' });
      return;
    }

    db.collection('trainings').doc(id).update({
      data: {
        status: 'in_class',
        inClassTime: new Date()
      }
    }).then(() => {
      wx.navigateTo({ url: `/pages/coach/in-class/index?trainingId=${id}` });
      this.loadTrainings();
    }).catch(err => {
      console.error('开始上课失败', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  gotoAddTraining() {
    wx.navigateTo({ url: '/pages/coach/trainings/edit/index' });
  },

  onPullDownRefresh() {
    this.loadTrainings().then(() => {
      wx.stopPullDownRefresh();
      wx.showToast({ title: '刷新成功', icon: 'success', duration: 1000 });
    });
  }
});
