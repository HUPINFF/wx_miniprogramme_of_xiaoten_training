// pages/admin/schedule/index.js — 排课调度中心（蓝图第 10 页：课程表 → 资源调度中心）
//
// 管理员专属子页：从管理 tab（经营驾驶舱）入口卡跳进来，不在底栏直接露出。
// 多教练日时间轴：翻日/跳任意日 + 全量课次按时间排列 + 冲突红标 + 新建/改课。
// 与 assertAdmin 同款的服务端兜底鉴权照搬 dashboard——URL 直开也要拦。

const auth = require('../../../utils/auth');
const { fetchAll } = require('../../../utils/db');
const scheduleRules = require('../../../utils/scheduleRules');
const { getTodayString, toLocalDate, getTrainingStatusMeta, readIsAdmin } = require('../../../utils/helper');

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

Page({
  data: {
    loading: true,
    selectedDate: '',
    dateLabel: '',
    isToday: true,
    totalCount: 0,
    conflictCount: 0,
    scheduleList: [],
    scheduleLoading: false
  },

  onLoad() {
    this.assertAdmin().then(me => {
      // 鉴权失败（含网络异常）：清掉「加载中」，别让卡片永久转圈
      if (!me) {
        this.setData({ loading: false });
        return;
      }
      // 后续所有读写入口都认这个标志：鉴权没过（含 URL 直开恰好那笔
      // 鉴权请求失败）就不许翻日拉数据、不许新建/改课
      this._authed = true;
      const today = getTodayString();
      this.setData({ selectedDate: today, dateLabel: this.formatDateLabel(today) });
      this.loadSchedule().then(() => {
        // 首次加载完成后再放行 onShow 刷新，避免进页就连查两次
        this._loaded = true;
      });
    });
  },

  onShow() {
    // 从编辑页改课/新建返回时刷新列表；首进由 onLoad 负责
    if (this._loaded) this.loadSchedule();
  },

  onPullDownRefresh() {
    this.loadSchedule().then(() => wx.stopPullDownRefresh());
  },

  /**
   * 服务端兜底鉴权（与 dashboard 同款）：
   * 缓存里的 isAdmin 可能过期，也可能是被手改的 storage，每次进页回服务端确认。
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
        auth.cacheSession(me, 'admin');
        return me;
      })
      .catch(err => {
        console.error('鉴权失败', err);
        wx.showToast({ title: '网络异常', icon: 'none' });
        return null;
      });
  },

  /**
   * 选中日期的全量课次（管理员全局视野，不按 coachId 过滤）。
   * 冲突打标走 scheduleRules.detectConflicts；内部兜错，失败显示空态不炸页。
   */
  loadSchedule() {
    if (!this._authed) return Promise.resolve();
    const db = wx.cloud.database();
    const date = this.data.selectedDate;
    if (!date) return Promise.resolve();

    // 请求序号：翻日/返回刷新/下拉共用本方法，慢网下先发的请求可能后回，
    // 会把别的日期的列表刷进当前日期（同家长首页 _statusSeq 的手法）
    const seq = this._reqSeq = (this._reqSeq || 0) + 1;
    this.setData({ scheduleLoading: true });

    return fetchAll(db.collection('trainings').where({ date: date }))
      .then(docs => {
        if (seq !== this._reqSeq) return;   // 过期响应：更新的那次已在跑，别覆盖
        // startTime 是 'HH:mm' 定长字符串，字典序即时间序；缺失的排最前
        const sorted = docs.slice().sort((a, b) =>
          String(a.startTime || '').localeCompare(String(b.startTime || ''))
        );
        const conflictIds = scheduleRules.detectConflicts(sorted);
        const list = sorted.map(t => {
          const meta = getTrainingStatusMeta(t.status);
          return {
            _id: t._id,
            timeText: (t.startTime || '--:--') + (t.endTime ? '-' + t.endTime : ''),
            name: t.name || t.type || '训练课程',
            childName: t.childName || '学员',
            coachName: t.coachName || '教练',
            location: t.location || '',
            statusText: meta.text,
            statusType: meta.type,
            conflict: conflictIds.has(t._id),
            changed: !!(t.changeLogs && t.changeLogs.length),
            reminded: !!t.reminded
          };
        });
        this.setData({
          scheduleList: list,
          totalCount: list.length,
          conflictCount: Array.from(conflictIds).length,
          scheduleLoading: false,
          loading: false
        });
      })
      .catch(err => {
        if (seq !== this._reqSeq) return;
        console.error('排课时间轴加载失败', err);
        this.setData({ scheduleList: [], totalCount: 0, conflictCount: 0, scheduleLoading: false, loading: false });
      });
  },

  onPrevDay() { this.shiftDate(-1); },
  onNextDay() { this.shiftDate(1); },

  onDatePick(e) {
    if (e.detail.value) this.applyDate(e.detail.value);
  },

  shiftDate(delta) {
    const base = toLocalDate(this.data.selectedDate || getTodayString());
    if (!base) return;
    base.setDate(base.getDate() + delta);
    this.applyDate(getTodayString(base));
  },

  applyDate(dateStr) {
    if (!dateStr || dateStr === this.data.selectedDate) return;
    this.setData({
      selectedDate: dateStr,
      dateLabel: this.formatDateLabel(dateStr),
      isToday: dateStr === getTodayString()
    });
    this.loadSchedule();
  },

  /** '2026-09-21' → '9月21日 周一'（解析失败原样返回，不给 wxml 空串） */
  formatDateLabel(dateStr) {
    const d = toLocalDate(dateStr);
    if (!d) return dateStr;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEKDAY_NAMES[d.getDay()];
  },

  onScheduleTap(e) {
    if (!this._authed) return;
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/coach/training-detail/index?id=' + id });
  },

  onScheduleEdit(e) {
    if (!this._authed) return;
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/coach/trainings/edit/index?id=' + id });
  },

  onAddTraining() {
    if (!this._authed) return;
    wx.navigateTo({ url: '/pages/coach/trainings/edit/index' });
  }
});
