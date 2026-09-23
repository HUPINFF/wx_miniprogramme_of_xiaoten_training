// pages/coach/workbench/index.js
// workbench 在 pages/coach/ 下一层，到 miniprogram/ 只要三级
const { fetchAll } = require('../../../utils/db');
const { findActiveClassForChild } = require('../../../utils/helper');

Page({
  data: {
    coachInfo: {},
    todayTrainings: [],
    inClassList: [],
    todo: {
      weeklyPerformance: 0,
      feedback: 0,
      photos: 0
    },
    banners: [],
    newsList: [],
    moments: [],
    comments: [],
    growthList: [],
    courseList: [],
    loading: true
  },

  async onLoad() {
    await this.refreshData();
    await this.loadCoachInfo();
    this.loadTodayTrainings();
    this.loadTodoCount();
    this.loadHomeData();
  },

  async refreshData() {
    try {
      await this.loadCoachInfo();
      await Promise.all([
        this.loadTodayTrainings(),
        this.loadTodoCount(),
        this.loadHomeData()
      ])
    } catch (err) {
      wx.showToast({ title: '刷新失败', icon: 'none' });
      console.error(err);
    } finally {
      this.setData({ loading: false });
    }
  },

  loadCoachInfo() {
    return new Promise((resolve, reject) => {
      const openid = wx.getStorageSync('openid')
      const db = wx.cloud.database();
      db.collection('users').where({
        _openid: openid,
        role: 'coach'
      }).get().then(res => {
        if (res.data.length > 0) {
          const coachInfo = res.data[0];
          this.setData({ coachInfo }, () => {
            resolve();
          });
        } else {
          reject('未找到教练信息');
        }
      }).catch(err => {
        reject(err);
      });
    });
  },

  onCoachUpdate(e) {
    const { coachInfo } = e.detail;
    this.setData({ coachInfo });
  },

  loadTodayTrainings() {
    const db = wx.cloud.database();
    const today = this.getTodayDateString();
    const now = new Date();

    db.collection('trainings').where({
      date: today,
      coachId: this.data.coachInfo._id
    }).get().then(async res => {
      // 获取学员信息来补充显示
      const childIdSet = new Set(res.data.map(t => t.childId));
      const childIds = Array.from(childIdSet);

      let childInfoMap = {};
      if (childIds.length > 0) {
        const _ = db.command;
        const childRes = await db.collection('children').where({
          _id: _.in(childIds)
        }).get();
        childInfoMap = childRes.data.reduce((map, child) => {
          map[child._id] = child;
          return map;
        }, {});
      }

      // 同一学员不能同时上两节课：先收集「真的在上课中」（in_class 且没盖下课戳）的
      // 学员，列表里把这些学员的其他待上课次按钮置灰；点击时 goToClass 里还有 DB 级守卫兜底
      const busyChildIds = new Set(
        res.data.filter(t => t.status === 'in_class' && !t.classEndedAt).map(t => t.childId)
      );

      // 处理训练数据
      const trainings = res.data.map(training => {
        const childInfo = childInfoMap[training.childId] || {};

        // 计算是否可以开始上课
        let canStart = true;
        if (training.startTime) {
          const [hour, minute] = training.startTime.split(':').map(Number);
          const startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
          canStart = now >= startDateTime;
        }

        // 灰字副标题：训练项目名；旧文档无 items 时回落到教练手填内容 / 训练重点
        const itemsText = (training.items || []).map(it => (it && it.name) || '').filter(Boolean).join('、')
          || training.coachContent || training.focus || '';
        // 这节课的学员是否被别的在上课占着（只对待上/已排课的课次有意义）
        const statusKey = training.status || 'pending';
        const childBusy = busyChildIds.has(training.childId)
          && statusKey !== 'in_class' && statusKey !== 'finished';

        return {
          ...training,
          childName: childInfo.name || '未知学员',
          itemsText,
          canStart: canStart,
          childBusy
        };
      });

      this.setData({ todayTrainings: trainings });
      this.updateInClassList(trainings);
    });
  },

  // 「正在上课」卡片：从今日课里挑出「真的在课上」的课次——status 是 in_class 且
  // 没盖过下课戳（classEndedAt 在下课那一刻就写入，而 status 要等课后记录
  // 「完成记录」才变 finished，单看 status 会把下课后的窗口期也当上课中）。
  // 带「已上课 X 分钟」的耗时文案；有课中时起一个 30s 定时器让耗时自己走。
  updateInClassList(trainings) {
    const inClassList = (trainings || []).filter(t => t.status === 'in_class' && !t.classEndedAt).map(t => ({
      _id: t._id,
      childName: t.childName,
      itemsText: t.itemsText,
      startTime: t.startTime,
      elapsedText: this.formatElapsed(t.inClassTime)
    }));

    this.setData({ inClassList });

    if (inClassList.length > 0 && !this.inClassTimer) {
      this.inClassTimer = setInterval(() => {
        // 用 todayTrainings 重新派生：下课（盖上 classEndedAt）后卡片自动消失
        this.updateInClassList(this.data.todayTrainings);
      }, 30000);
    } else if (inClassList.length === 0 && this.inClassTimer) {
      clearInterval(this.inClassTimer);
      this.inClassTimer = null;
    }
  },

  formatElapsed(inClassTime) {
    const start = inClassTime ? new Date(inClassTime).getTime() : NaN;
    if (!isFinite(start)) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
    if (minutes < 1) return '刚刚开始';
    if (minutes < 60) return `已上课 ${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `已上课 ${hours} 小时 ${rest} 分钟` : `已上课 ${hours} 小时`;
  },

  goBackToClass(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/coach/in-class/index?trainingId=${id}` });
    }
  },

  onHide() {
    if (this.inClassTimer) {
      clearInterval(this.inClassTimer);
      this.inClassTimer = null;
    }
  },

  onUnload() {
    if (this.inClassTimer) {
      clearInterval(this.inClassTimer);
      this.inClassTimer = null;
    }
  },

  loadTodoCount() {
    const db = wx.cloud.database();
    const _ = db.command;
    const coachId = this.data.coachInfo._id;
    if (!coachId) return;

    const now = new Date();
    const weekRange = this.getCurrentWeekRange(now);
    const weekStart = weekRange.start;

    // 学员必须分页拉全：小程序端单次 get() 上限 20 条，
    // 原来直接 .get() 的话，带 30 个学员的教练只拿到 20 个，待办数静默算少。
    fetchAll(db.collection('children').where({
      coachId: coachId
    })).then(children => {
      const childIds = children.map(child => child._id);

      if (childIds.length === 0) {
        this.setData({
          'todo.weeklyPerformance': 0,
          'todo.feedback': 0
        });
        return;
      }

      // 用 count() 而不是 get()：count 不受 20 条限制，且这里只要「有多少人交了」，
      // 不需要明细。performance 每周每学员至多一条（录入页按 childId + weekStart
      // 查重后走 update），所以记录数 == 已录入的学员数。
      return Promise.all([
        db.collection('performance').where({
          childId: _.in(childIds),
          // 这里原来是 weekRange，但录入页写进 weekRange 的是「9月14日-9月20日」
          // 这种展示文案，拿 'YYYY-MM-DD' 去比永远不相等 —— 待办数一直是「全部学员」。
          // 存日期的是 weekStart。
          weekStart: weekStart
        }).count(),
        db.collection('feedbacks').where({
          childId: _.in(childIds),
          weekStart: weekStart,
          // 每课反馈（带 trainingId）不计入：这里统计的是「本周已写周反馈的学员数」，
          // 同一孩子一周可能有多条每课反馈，混进来会把待写反馈数压小
          trainingId: _.exists(false)
        }).count()
      ]).then(([perfRes, feedbackRes]) => {
        // 兜底 max(0)：万一历史数据里同一个孩子本周有多条记录，减出来会是负数
        this.setData({
          'todo.weeklyPerformance': Math.max(0, childIds.length - perfRes.total),
          'todo.feedback': Math.max(0, childIds.length - feedbackRes.total)
        });
      })
    }).catch(err => {
      console.error('统计待办事项失败', err);
    });
  },

  getCurrentWeekRange(date) {
    const monday = this.getMondayDate(date);
    const sunday = this.getSundayDate(date);
    const year = date.getFullYear();
    const weekStart = `${year}-${String(monday.month).padStart(2, '0')}-${String(monday.day).padStart(2, '0')}`;
    const weekEnd = `${year}-${String(sunday.month).padStart(2, '0')}-${String(sunday.day).padStart(2, '0')}`;
    return { start: weekStart, end: weekEnd };
  },

  getMondayDate(date) {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return {
      month: monday.getMonth() + 1,
      day: monday.getDate()
    };
  },

  getSundayDate(date) {
    const sunday = new Date(date);
    const day = sunday.getDay() || 7;
    sunday.setDate(sunday.getDate() + (7 - day));
    return {
      month: sunday.getMonth() + 1,
      day: sunday.getDate()
    };
  },

  getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  loadHomeData() {
    this.setData({ loading: true });
    Promise.all([
      this.loadBanners(),
      this.loadNews(),
      this.loadMoments(),
      this.loadComments(),
      this.loadGrowth(),
      this.loadCourses(),
    ]).then(() => {
      this.setData({ loading: false });
    }).catch(err => {
      console.error("加载首页数据失败", err);
      this.setData({ loading: false });
    })
  },

  loadBanners() {
    const db = wx.cloud.database();
    return db.collection('banners').where({ status: true }).orderBy('sort', 'asc').get().then(res => {
      this.setData({ banners: res.data });
    }).catch(err => {
      console.error("加载轮播图失败", err);
    });
  },

  loadNews() {
    const db = wx.cloud.database();
    return db.collection('news').where({ status: true }).orderBy('sort', 'asc').orderBy('time', 'desc').limit(5).get().then(res => {
      this.setData({ newsList: res.data });
    }).catch(err => {
      console.error("加载最新动态失败", err);
    });
  },

  loadMoments() {
    const db = wx.cloud.database();
    return db.collection("moments").where({ status: true }).orderBy('sort', 'asc').limit(10).get().then(res => {
      this.setData({ moments: res.data });
    }).catch(err => {
      console.error("加载精彩瞬间失败", err);
    });
  },

  loadComments() {
    const db = wx.cloud.database();
    return db.collection('comment')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()
      .then(res => {
        console.log('Comments loaded:', res.data);
        this.setData({ comments: res.data });
      })
      .catch(err => {
        console.error("加载点评失败", err);
      });
  },

  loadGrowth() {
    const db = wx.cloud.database();
    return db.collection('growth_exp')
      .where({ status: true })
      .orderBy('sort', 'asc')
      .limit(10)
      .get()
      .then(res => {
        console.log('成长案例 loaded:', res.data);
        const growthList = res.data.map(item => {
          let itemCount = 0;
          let coverImage = '';
          if (item.items && item.items.length > 0) {
            itemCount = item.items.length;
            coverImage = item.items[0].url;
          }
          return {
            ...item,
            itemCount,
            coverImage
          };
        });
        this.setData({ growthList });
      })
      .catch(err => {
        console.error("加载成长案例失败", err);
      });
  },

  loadCourses() {
    const db = wx.cloud.database();
    return db.collection('course')
      .where({ status: true })
      .orderBy('sort', 'asc')
      .limit(10)
      .get()
      .then(res => {
        console.log('课程列表 loaded:', res.data);
        this.setData({ courseList: res.data });
      })
      .catch(err => {
        console.error("加载课程失败", err);
      });
  },

  gotoCourseManage() {
    wx.navigateTo({ url: '/pages/coach/course-manage/index' });
  },

  viewCourseDetail(e) {
    const courseId = e.currentTarget.dataset.id;
    if (courseId) {
      wx.navigateTo({ url: `/pages/coach/course-detail/index?id=${courseId}` });
    }
  },

  deleteComment(e) {
    const { id, trainingId } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除点评',
      content: '确定要删除这条点评吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          const db = wx.cloud.database();
          db.collection('comment').doc(id).remove()
            .then(() => {
              if (trainingId) {
                return db.collection('trainings').doc(trainingId).update({
                  data: { comment: { isCommented: false } }
                });
              }
            })
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: '已删除', icon: 'success' });
              this.loadComments();
            })
            .catch(err => {
              wx.hideLoading();
              console.error('删除点评失败', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            });
        }
      }
    });
  },

  viewAllComments() {
    wx.navigateTo({ url: '/pages/coach/all-comments/index' });
  },

  viewCommentDetail(e) {
    const commentId = e.currentTarget.dataset.id;
    if (commentId) {
      wx.navigateTo({ url: `/pages/coach/comment-detail/index?id=${commentId}` });
    }
  },

  viewAllGrowth() {
    wx.navigateTo({ url: '/pages/coach/all-growth/index' });
  },

  viewGrowthDetail(e) {
    const growthId = e.currentTarget.dataset.id;
    if (growthId) {
      wx.navigateTo({ url: `/pages/coach/growth-detail/index?id=${growthId}` });
    }
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.loadCoachInfo();
    setTimeout(() => {
      Promise.all([
        this.loadTodayTrainings(),
        this.loadHomeData()
      ]).then(() => {
        wx.stopPullDownRefresh();
        wx.showToast({ title: '刷新成功', icon: 'success', duration: 1000 });
      }).catch(err => {
        console.error('刷新失败', err);
        wx.stopPullDownRefresh();
        wx.showToast({ title: '刷新失败', icon: 'none' });
      });
    }, 500);
  },

  viewAllNews() {
    wx.navigateTo({ url: "/pages/users/news/index" });
  },

  viewNews(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/users/news-detail/index?id=${id}` });
  },

  viewMoreMoments() {
    wx.navigateTo({ url: "/pages/users/moments/index" });
  },

  viewMoment(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/users/moment-detail/index?id=${id}` });
  },

  gotoChildrenList() {
    wx.navigateTo({ url: '/pages/coach/children/list/index' });
  },

  gotoWeeklyPerformance() {
    wx.navigateTo({ url: '/pages/coach/performance/weekly/index' });
  },

  gotoFeedback() {
    wx.navigateTo({ url: '/pages/coach/feedback/write/index' });
  },

  gotoAppointments() {
    wx.navigateTo({ url: '/pages/coach/appointments/index' });
  },

  gotoContentManage() {
    wx.navigateTo({ url: '/pages/coach/content-manage/index' });
  },

  goToTrainingDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/coach/training-detail/index?id=${id}` });
    }
  },

  goToClass(e) {
    const { id } = e.currentTarget.dataset;
    console.log('进入上课，训练ID:', id);

    if (!id) {
      wx.showToast({ title: '数据错误', icon: 'none' });
      return;
    }

    // 从已加载的训练数据中查找
    const training = this.data.todayTrainings.find(t => t._id === id);
    if (!training) {
      wx.showToast({ title: '未找到训练', icon: 'none' });
      return;
    }

    // 检查是否可以开始上课
    if (!training.canStart && (training.status === 'pending' || !training.status)) {
      wx.showToast({ title: '未到上课时间', icon: 'none' });
      return;
    }

    // 如果已经上课中，直接跳转
    if (training.status === 'in_class') {
      wx.navigateTo({ url: `/pages/coach/in-class/index?trainingId=${id}` });
      return;
    }

    // 如果已经结束，不能再上课
    if (training.status === 'finished') {
      wx.showToast({ title: '课程已结束', icon: 'none' });
      return;
    }

    // 开始上课 - 先守卫（同一学员不能同时上两节课）再更新状态跳转
    const db = wx.cloud.database();
    findActiveClassForChild(db, training.childId, id).then(conflict => {
      if (conflict) {
        // 这孩子还有一节真的在上课中（没点下课）；给不同学员开课不受影响
        wx.showToast({ title: '该学员正在上课中', icon: 'none' });
        return;
      }
      return db.collection('trainings').doc(id).update({
        data: {
          status: 'in_class',
          inClassTime: new Date()
        }
      }).then(() => {
        wx.navigateTo({ url: `/pages/coach/in-class/index?trainingId=${id}` });
        this.loadTodayTrainings();
      });
    }).catch(err => {
      console.error('开始上课失败', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  onShow() {
    this.loadTodayTrainings()
  }
});
