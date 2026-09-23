// pages/admin/dashboard/index.js — 经营驾驶舱（仅 isAdmin 可见）
//
// 设计取舍：
// - 指标卡全部走 count()，它不受「单次 get 上限 20 条」限制，秒回；
// - 需要去重/求和的（本周待反馈、本月课耗）走 fetchAll，单独一批跑，不阻塞首屏；
// - 趋势图用 CSS 柱，不引图表库。

const auth = require('../../../utils/auth');
const { fetchAll } = require('../../../utils/db');
const { getTodayString, getWeekRange, readIsAdmin } = require('../../../utils/helper');

const LOW_HOURS = 5;              // 低课时阈值，与 pages/coach/children/detail 保持一致
const REFRESH_INTERVAL = 60 * 1000; // onShow 节流：驾驶舱请求多，不能每次进页都全量刷
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

Page({
  data: {
    loading: true,
    heroDate: '',
    today: { total: '--', finished: '--', inClass: '--', waiting: '--' },
    overview: {
      students: '--',
      lowHours: '--',
      pendingFeedback: '--',
      pendingAppointments: '--',
      pendingChangeCoach: '--'
    },
    month: { consumed: '--', recharged: '--' },
    trend: [],
    todoItems: [],
    lastLoadedAt: 0   // onShow 节流用
  },

  onLoad() {
    // 头部日期胶囊：如「9月22日 · 周一」
    const now = new Date();
    const weekLabel = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    this.setData({ heroDate: `${now.getMonth() + 1}月${now.getDate()}日 · 周${weekLabel}` });

    this.assertAdmin().then(me => {
      if (me) this.loadAll();
    });
  },

  onShow() {
    // 首屏由 onLoad 负责，这里只做节流刷新
    if (!this.data.lastLoadedAt) return;
    if (Date.now() - this.data.lastLoadedAt < REFRESH_INTERVAL) return;
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll().then(() => wx.stopPullDownRefresh());
  },

  /**
   * 服务端兜底鉴权
   * 缓存里的 isAdmin 可能过期（在控制台改了但没重登），也可能是被手改的 storage。
   * 所以管理页每次进来都回服务端确认一次。
   */
  assertAdmin() {
    const db = wx.cloud.database();
    return db.collection('users')
      .where({ _openid: auth.getOpenid() })
      .get()
      .then(res => {
        const me = res.data[0];
        if (!me || !readIsAdmin(me)) {
          wx.showModal({
            title: '无权限',
            content: '您没有管理员权限',
            showCancel: false,
            success: () => wx.reLaunch({ url: '/pages/coach/workbench/index' })
          });
          return null;
        }
        // 顺手用服务端的值刷新缓存
        auth.cacheSession(me, 'admin');
        return me;
      })
      .catch(err => {
        console.error('鉴权失败', err);
        wx.showToast({ title: '网络异常', icon: 'none' });
        return null;
      });
  },

  loadAll() {
    this.setData({ loading: true });

    // 第一批：轻量 count，秒回，直接上屏
    return this.loadCounts()
      .then(() => {
        this.setData({ loading: false, lastLoadedAt: Date.now() });
      })
      .catch(err => {
        console.error('驾驶舱加载失败', err);
        this.setData({ loading: false, lastLoadedAt: Date.now() });
      })
      .then(() => {
        // 第二批：需要全量的慢查询，失败也不影响已上屏的卡片
        this.loadSlowStats();
      });
  },

  /** 排课调度中心入口（蓝图第 10 页，独立子页 pages/admin/schedule） */
  onScheduleCenterTap() {
    wx.navigateTo({ url: '/pages/admin/schedule/index' });
  },

  /** 第一批：全部走 count()，并发 8 个（wx.request 并发上限 10） */
  loadCounts() {
    const db = wx.cloud.database();
    const _ = db.command;
    const today = getTodayString();

    return Promise.all([
      db.collection('trainings').where({ date: today }).count(),
      db.collection('trainings').where({ date: today, status: 'finished' }).count(),
      db.collection('trainings').where({ date: today, status: 'in_class' }).count(),
      db.collection('children').count(),
      db.collection('children').where({ remainingHours: _.lte(LOW_HOURS) }).count(),
      // 没有 remainingHours 字段的学员查不到，得单独计一笔，否则新学员会漏
      db.collection('children').where({ remainingHours: _.exists(false) }).count(),
      db.collection('appointments').where({ status: 'pending' }).count(),
      db.collection('changeCoachNew').where({ status: 'pending' }).count()
    ]).then(([tTotal, tFinished, tInClass, students, lowA, lowB, pendAppt, pendChange]) => {
      const total = tTotal.total;
      const finished = tFinished.total;
      const inClass = tInClass.total;
      const lowHours = lowA.total + lowB.total;

      this.setData({
        today: {
          total,
          finished,
          inClass,
          // 只做减法，省一次请求
          waiting: Math.max(total - finished - inClass, 0)
        },
        overview: {
          students: students.total,
          lowHours,
          pendingFeedback: this.data.overview.pendingFeedback, // 第二批填
          pendingAppointments: pendAppt.total,
          pendingChangeCoach: pendChange.total
        }
      });

      this.buildTodoItems();
    });
  },

  /**
   * 第二批：要全量数据的统计
   *
   * 刻意串行三组而不是 Promise.all：趋势图一次就要发 7 个 count，
   * 和另外两条 fetchAll 链叠在一起会逼近 wx.request 的 10 并发上限。
   */
  loadSlowStats() {
    const week = getWeekRange();

    return Promise.all([
      this.countPendingFeedback(week),
      this.sumMonthHours()
    ])
      .then(() => this.loadTrend(week))
      .catch(err => {
        console.error('驾驶舱慢查询失败', err);
      });
  },

  /** 本周待反馈 = 本周已完成的课次里去重后的学员，减去已有反馈的学员 */
  countPendingFeedback(week) {
    const db = wx.cloud.database();
    const _ = db.command;

    return Promise.all([
      fetchAll(db.collection('trainings').where({
        date: _.gte(week.start).and(_.lte(week.end)),
        status: 'finished'
      })),
      fetchAll(db.collection('feedbacks').where({ weekStart: week.start }))
    ]).then(([trainings, feedbacks]) => {
      const doneChildIds = new Set(trainings.map(t => t.childId).filter(Boolean));
      const fedChildIds = new Set(feedbacks.map(f => f.childId).filter(Boolean));
      let pending = 0;
      doneChildIds.forEach(id => {
        if (!fedChildIds.has(id)) pending++;
      });

      this.setData({ 'overview.pendingFeedback': pending });
      this.buildTodoItems();
      return pending;
    });
  },

  /**
   * 本月课耗 / 充值（课时）
   *
   * 注意：库里的 hoursRecords.amount 是「课时数」不是金额。
   * 全项目没有任何金额字段，所以这里不做「营收」，避免给出假数字。
   */
  sumMonthHours() {
    const db = wx.cloud.database();
    const _ = db.command;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return fetchAll(db.collection('hoursRecords').where({ createdAt: _.gte(monthStart) }))
      .then(records => {
        const sum = type => records
          .filter(r => r.type === type)
          .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

        this.setData({
          month: {
            consumed: sum('expense'),
            recharged: sum('income')
          }
        });
      });
  },

  /** 本周 7 天课次趋势 */
  loadTrend(week) {
    const db = wx.cloud.database();
    const todayStr = getTodayString(); // 给今天那根柱子打高亮标
    const days = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(week.startDate);
      d.setDate(d.getDate() + i);
      days.push(getTodayString(d));
    }

    return Promise.all(
      days.map(date => db.collection('trainings').where({ date }).count())
    ).then(results => {
      const counts = results.map(r => r.total);
      const max = Math.max(...counts, 0);

      this.setData({
        trend: counts.map((count, i) => ({
          date: days[i],
          label: WEEK_LABELS[i],
          count,
          isToday: days[i] === todayStr,
          // percent 在 js 里算好，wxml 里做不了除法取整
          percent: max ? Math.round(count / max * 100) : 0
        }))
      });
    });
  },

  /** 「今日需要处理」清单。数量来自上面各统计，点击下钻 */
  buildTodoItems() {
    const o = this.data.overview;
    this.setData({
      todoItems: [
        {
          key: 'feedback',
          icon: '📝',
          title: '本周课后反馈未完成',
          count: o.pendingFeedback,
          url: '/pages/admin/coaches/index'
        },
        {
          key: 'lowHours',
          icon: '⏳',
          title: '学员剩余课时不足 ' + LOW_HOURS + ' 节',
          count: o.lowHours,
          url: '/pages/admin/coaches/index'
        },
        {
          key: 'appointment',
          icon: '📅',
          title: '预约待审批',
          count: o.pendingAppointments,
          url: '/pages/coach/appointments/index'
        },
        {
          key: 'changeCoach',
          icon: '🔄',
          title: '换教练申请待处理',
          count: o.pendingChangeCoach,
          url: '/pages/coach/change-coach-requests/index'
        }
      ]
    });
  },

  onTodoTap(e) {
    const { url, count } = e.currentTarget.dataset;
    if (!url) return;
    // count 未加载完时是字符串 '--'（真值），所以必须按数字判断
    if (typeof count !== 'number' || count <= 0) {
      wx.showToast({ title: '暂无待处理事项', icon: 'none' });
      return;
    }
    wx.navigateTo({ url });
  },

  onCoachesTap() {
    wx.navigateTo({ url: '/pages/admin/coaches/index' });
  }
});
