// pages/users/home/index.js
//
// 家长端首页。只回答三个问题：今天干什么、孩子进步了吗、下一步做什么。
// 内容型版块（最新动态/家长点评/精彩瞬间/课程体系/成长案例/关于我们/加入我们/联系我们）
// 和八宫格入口都已搬到 pages/users/profile/index。
// 空闲态（没在上课、也没下节课）补一块「成长足迹」：课次统计 + 最近进步 + 最新反馈。
const {
  getTodayString,
  pickCurrentTraining,
  pickProgressHighlight,
  elapsedMinutesOf,
  formatDurationText,
  diffInDays
} = require('../../../utils/helper');

// 「正在上课」的正计时刷新间隔。文案最小单位是分钟，每秒重算纯属白渲染；
// 30 秒是折中：最坏情况下卡片上的分钟数比真实值慢半分钟，肉眼看不出。
const ELAPSED_REFRESH_MS = 30000;

Page({

  /**
   * 页面的初始数据
   */
  data: {
    loading: true,  // 控制骨架屏显示
    statusBarHeight: 0,    //状态栏高度
    navBarHeight: 0,       //导航栏总高度
    menuButtonInfo: {},    //胶囊按钮信息

    // 家长信息
    parentInfo: {},
    // 孩子信息
    childInfo: null,

    // 轮播图数据
    banners: [],

    // 当前情况：'in_class'(正在上课) / 'upcoming'(下节课) / 'none'(整卡隐藏)
    currentMode: 'none',
    currentTraining: null,
    upcomingDateText: '',   // 「下节课」的日期友好文案，如「今天」「9月16日」
    // 仅「正在上课」状态才有：已进行时长（随定时器走）+ 「开课 14:32 · 王教练」
    elapsedText: '',
    inClassSubText: '',
    // 仅「下节课」状态才有：最近进步 + 最近训练反馈
    progress: null,
    progressLabel: '',   // 「首次记录」/「最近进步」/「最近变化」
    progressText: '',    // 「50米 快0.3秒」这种拼好的文案
    latestFeedback: null,

    // 仅「空闲」状态才有：成长足迹（课次统计 + 进步/反馈复用上面两个字段）
    totalTrainings: 0,   // 已完成（finished）课次总数
    monthTrainings: 0,   // 本月已完成课次
    isGrowthEmpty: false, // 三块数据全空 → 显示「去预约」引导

    // 登录弹窗
    showLoginModal: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 「正在上课」的正计时句柄。挂在实例上而不是 data 里，避免无谓渲染
    this.elapsedTimer = null;

    // 初始化导航栏信息
    this.initNavBar();

    // 获取家长信息
    this.loadParentInfo();

    // 加载首页数据（包含孩子信息）
    this.loadHomeData();
  },

  /**
   * 初始化导航栏信息
   */
  initNavBar() {
    try {
      const windowInfo = wx.getWindowInfo();
      const statusBarHeight = windowInfo.statusBarHeight;
      const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
      const navBarHeight = menuButtonInfo.bottom;

      this.setData({
        statusBarHeight,
        navBarHeight,
        menuButtonInfo
      });
    } catch (error) {
      console.error('初始化导航栏失败:', error);
    }
  },

  /**
   * 加载家长信息
   */
  loadParentInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo') || {};
      this.setData({ parentInfo: userInfo });
    } catch (error) {
      console.error('加载家长信息失败:', error);
    }
  },

  /**
   * 加载孩子信息
   */
  loadChildInfo() {
    const openid = wx.getStorageSync('openid');

    if (!openid) {
      console.warn('未获取到 openid');
      return Promise.resolve();
    }

    const db = wx.cloud.database();
    return db.collection('children')
      .where({
        parentOpenId: openid
      })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({
            childInfo: res.data[0]
          });
        } else {
          console.log('未找到孩子信息');
          this.setData({ childInfo: null });
        }
      })
      .catch(err => {
        console.error('加载孩子信息失败:', err);
        this.setData({ childInfo: null });
      });
  },

  /**
   * 加载「当前情况」卡片
   *
   * 判定交给 utils/helper 的 pickCurrentTraining（纯函数，有单测）：
   * 优先「正在上课」（status === 'in_class'，即教练点了开始上课），否则「下节课」。
   *
   * 两次查询而不是拉全量：小程序端单次 get() 上限 20 条，
   * 一个孩子的历史训练轻易就超了，全量拉会漏掉未来的课。
   */
  loadCurrentStatus() {
    const childId = this.data.childInfo && this.data.childInfo._id;
    if (!childId) {
      this.setData({
        currentMode: 'none',
        currentTraining: null,
        elapsedText: '',
        inClassSubText: '',
        progress: null,
        progressLabel: '',
        progressText: '',
        latestFeedback: null,
        totalTrainings: 0,
        monthTrainings: 0,
        isGrowthEmpty: false
      });
      this.stopElapsedTicker();
      return Promise.resolve();
    }

    const db = wx.cloud.database();
    const _ = db.command;
    const today = getTodayString();

    return Promise.all([
      // 正在上课的。这里的日期过滤同样只是粗筛（理由见下面的「下节课」查询），
      // 陈旧的（昨天点了开始上课就没再管的）由 pickCurrentTraining 精确剔掉。
      //
      // 故意**不排序也不 limit**：挑哪一节是 pickCurrentTraining 的规则
      // （多条 in_class 时取开始得最晚的那节），在这里再排一次就是第二套规则，
      // 两边一旦不一致就会出现「查询挑了一节、判定想的是另一节」。
      // 带 in_class 且日期没过期的记录本来就极少，直接全取交给它挑。
      db.collection('trainings')
        .where({ childId: childId, status: 'in_class', date: _.gte(today) })
        .get(),
      // 还没上的，按时间取最近一节。
      // 这里的 date 过滤只是粗筛（少读几条），**精确判定在 pickCurrentTraining 里**：
      // 云数据库的字段类型不受控，历史数据里 date 万一是 Date 类型，
      // `_.gte('YYYY-MM-DD')` 会按 BSON 类型序把所有 Date 都放行。
      db.collection('trainings')
        .where({
          childId: childId,
          status: _.in(['pending', 'scheduled']),
          date: _.gte(today)
        })
        .orderBy('date', 'asc')
        .orderBy('startTime', 'asc')
        .limit(1)
        .get()
    ]).then(([inClassRes, upcomingRes]) => {
      const merged = [...inClassRes.data, ...upcomingRes.data];
      const { mode, training } = pickCurrentTraining(merged, { today: today });

      const isLive = mode === 'in_class';
      this.setData({
        currentMode: mode,
        currentTraining: training,
        upcomingDateText: mode === 'upcoming' ? this.formatUpcomingDate(training.date, today) : '',
        elapsedText: isLive ? this.buildElapsedText(training) : '',
        inClassSubText: isLive ? this.buildInClassSubText(training) : ''
      });

      // 非「正在上课」时这个方法自己会先停掉再返回，不必在这里分流
      this.startElapsedTicker();

      // 最近进步 + 最近反馈：下节课和空闲态都要；正在上课时用不上，清掉
      if (mode === 'upcoming') {
        return this.loadProgressAndFeedback(childId);
      }
      if (mode === 'none') {
        return this.loadGrowthHighlights(childId);
      }
      this.setData({
        progress: null,
        progressLabel: '',
        progressText: '',
        latestFeedback: null,
        totalTrainings: 0,
        monthTrainings: 0,
        isGrowthEmpty: false
      });
      return Promise.resolve();
    }).catch(err => {
      console.error('加载当前情况失败:', err);
      this.stopElapsedTicker();
      this.setData({
        currentMode: 'none',
        currentTraining: null,
        elapsedText: '',
        inClassSubText: '',
        progress: null,
        progressLabel: '',
        progressText: '',
        latestFeedback: null,
        totalTrainings: 0,
        monthTrainings: 0,
        isGrowthEmpty: false
      });
    });
  },

  /**
   * 加载最近进步 + 最近训练反馈（「下节课」卡和空闲态「成长足迹」共用）
   */
  loadProgressAndFeedback(childId) {
    const db = wx.cloud.database();

    return Promise.all([
      // 取最近两条成绩：pickProgressHighlight 要两条才能算环比
      db.collection('performance')
        .where({ childId: childId })
        .orderBy('weekDate', 'desc')
        .limit(2)
        .get(),
      db.collection('feedbacks')
        .where({ childId: childId })
        .orderBy('date', 'desc')
        .limit(1)
        .get()
    ]).then(([perfRes, fbRes]) => {
      // 数据太旧 / 只有一条 / 一条都没动，这个函数会返回 null，卡片自行隐藏该行
      const progress = pickProgressHighlight(perfRes.data);
      // 文案在 js 里拼好，wxml 就不必堆嵌套三元
      // 「首次记录」没有 deltaText（没得比）；退步时不叫「进步」，如实说「最近变化」
      let progressLabel = '';
      let progressText = '';
      if (progress) {
        if (progress.mode === 'first') {
          progressLabel = '首次记录';
          progressText = `${progress.metricName} ${progress.currentText}`;
        } else {
          progressLabel = progress.isImprovement ? '最近进步' : '最近变化';
          progressText = `${progress.metricName} ${progress.deltaText}`;
        }
      }

      this.setData({
        progress,
        progressLabel,
        progressText,
        latestFeedback: fbRes.data.length ? fbRes.data[0] : null
      });
    }).catch(err => {
      // 进步和反馈是锦上添花，失败不该把「下节课」本身也弄没
      console.error('加载进步/反馈失败:', err);
      this.setData({ progress: null, progressLabel: '', progressText: '', latestFeedback: null });
    });
  },

  /**
   * 空闲态「成长足迹」：累计/本月课次 + 最近进步 + 最新反馈
   *
   * 只在没课的今天才有这块版面（正在上课/下节课时整卡隐藏，数据也清掉）。
   * 进步和反馈直接复用 loadProgressAndFeedback——和「下节课」卡是同一套
   * 判定、同一套文案，家长在两张卡里看到的必须是同一个数字。
   * 这里只额外数两个数：count() 不受单次 get() 20 条上限约束，正适合数历史课次。
   *
   * date 过滤和「下节课」查询一样是粗筛：date 字段类型不受控，历史数据
   * 万一是 Date 类型，_.gte('YYYY-MM-DD') 会把所有 Date 都放行——
   * 最坏情况是「本月」等于「累计」，宁可多报也不会漏报。
   */
  loadGrowthHighlights(childId) {
    const db = wx.cloud.database();
    const _ = db.command;
    const today = getTodayString();
    const monthStart = `${today.slice(0, 7)}-01`;

    const countFinished = (extraWhere) => db.collection('trainings')
      .where(Object.assign({ childId: childId, status: 'finished' }, extraWhere || {}))
      .count()
      .then((res) => (res && res.total) || 0);

    // loadProgressAndFeedback 自己 catch 了（失败只丢锦上添花的数据），
    // 所以 Promise.all 只可能被两个 count 打穿——那也只损失数字，不炸页面
    return Promise.all([
      countFinished(),
      countFinished({ date: _.gte(monthStart) }),
      this.loadProgressAndFeedback(childId)
    ]).then(([total, month]) => {
      this.setData({ totalTrainings: total, monthTrainings: month });
      this.refreshGrowthEmptyFlag();
    }).catch(err => {
      console.error('加载成长足迹失败:', err);
      this.setData({ totalTrainings: 0, monthTrainings: 0 });
    });
  },

  /**
   * 进步 / 反馈 / 课次三块全空 → 新家长的首页不该只剩「0次」，
   * 给一条去预约的引导。只在数据真正加载成功后判定，加载失败不误报。
   */
  refreshGrowthEmptyFlag() {
    this.setData({
      isGrowthEmpty: !this.data.progress && !this.data.latestFeedback && this.data.totalTrainings === 0
    });
  },

  /** 成长足迹 → 蜕变（成长档案）tab */
  goToGrowth() {
    wx.switchTab({ url: '/pages/users/growth/index' });
  },

  /** 最新反馈 → 我的反馈列表 */
  goToFeedback() {
    wx.navigateTo({ url: '/pages/users/my-feedback/index' });
  },

  /** 新用户引导 → 预约 tab */
  goToBooking() {
    wx.switchTab({ url: '/pages/users/orders/index' });
  },

  /**
   * 「下节课」的日期文案：今天 / 明天 / 9月16日
   *
   * ⚠️ 入参先过 getTodayString 归一化。date 万一是 Date 类型的历史数据，
   *    String() 会得到 "Mon Sep 14 2026 ..."，split('-') 直接解析出 NaN。
   */
  formatUpcomingDate(date, today) {
    const dateText = getTodayString(date);
    if (!dateText) return '';
    if (dateText === today) return '今天';

    const nextDay = new Date(`${today}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    const tomorrow = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    if (dateText === tomorrow) return '明天';

    const parts = dateText.split('-');
    return `${Number(parts[1])}月${Number(parts[2])}日`;
  },

  /**
   * 「正在上课」的大号数字：已进行多久
   *
   * 和详情页头图共用 helper 的 elapsedMinutesOf / formatDurationText，
   * 两处算出来的分钟数必须一致——卡片写「32分钟」，点进去头图也应当是「32分钟」。
   * 教练既没记实际开课时间、又缺计划开始时刻的老数据，如实说「上课中」。
   */
  buildElapsedText(training) {
    const minutes = elapsedMinutesOf(training);
    return minutes === null ? '上课中' : formatDurationText(minutes);
  },

  /**
   * 「正在上课」的副标题：`体能训练 · 开课 14:32 · 王教练`
   *
   * 三段都可能缺，所以拼到哪算哪；一段都没有时给一句兜底，别留一行空白。
   */
  buildInClassSubText(training) {
    const record = training || {};
    const parts = [];
    if (record.name) parts.push(record.name);

    const clock = this.formatInClassClock(record.inClassTime);
    if (clock) parts.push(`开课 ${clock}`);
    if (record.coachName) parts.push(record.coachName);

    return parts.length ? parts.join(' · ') : '教练已开始本次训练';
  },

  /**
   * inClassTime → '14:32'
   *
   * 默认不给日期：同一节课几乎总是当天开的，带上「9月15日」反而占地方。
   * 真跨天了（教练下课忘了点时，首页会一直停在「正在上课」）才补日期，
   * 否则家长会误以为课是今天开的。
   *
   * ⚠️ 字符串只认带时分的 'YYYY-MM-DD HH:mm' / 'YYYY-MM-DDTHH:mm'：
   *    纯日期串会被当 UTC 午夜解析（见 helper 的 toLocalDate 注释），
   *    解析不出来就不显示时间，宁缺毋错。
   */
  formatInClassClock(input) {
    let date = null;
    if (input instanceof Date) {
      date = input;
    } else if (typeof input === 'number') {
      date = new Date(input);
    } else if (typeof input === 'string' && input) {
      const matched = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})/);
      date = matched
        ? new Date(
            parseInt(matched[1], 10), parseInt(matched[2], 10) - 1, parseInt(matched[3], 10),
            parseInt(matched[4], 10), parseInt(matched[5], 10)
          )
        : new Date(input);
    }
    if (!date || isNaN(date.getTime())) return '';

    const pad = n => String(n).padStart(2, '0');
    const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return diffInDays(getTodayString(), date) === 0
      ? clock
      : `${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
  },

  // ==================== 「正在上课」正计时 ====================

  /**
   * 只在「正在上课」时开定时器。非该状态会先停掉再直接返回，
   * 所以调用方不需要自己判断该不该开。
   */
  startElapsedTicker() {
    this.stopElapsedTicker();
    if (this.data.currentMode !== 'in_class' || !this.data.currentTraining) return;

    this.elapsedTimer = setInterval(() => { this.refreshElapsed(); }, ELAPSED_REFRESH_MS);
  },

  stopElapsedTicker() {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  },

  refreshElapsed() {
    const training = this.data.currentTraining;
    if (!training) {
      this.stopElapsedTicker();
      return;
    }

    const elapsedText = this.buildElapsedText(training);
    // 分钟数没变就别 setData —— 半分钟一次的空渲染没必要
    if (elapsedText === this.data.elapsedText) return;

    this.setData({ elapsedText });
  },

  /**
   * 「当前情况」卡片点击 → 训练详情页
   * 「正在上课」和「下节课」共用这一个入口，页面自己按 status 决定显示什么
   */
  goToTrainingDetail(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset.id)
      || (this.data.currentTraining && this.data.currentTraining._id);
    if (!id) return;

    wx.navigateTo({ url: `/pages/users/training-detail/index?id=${id}` });
  },

  /**
   * 加载首页数据
   */
  loadHomeData() {
    // 显示骨架屏
    this.setData({ loading: true });

    // 使用 Promise.allSettled 确保即使部分请求失败也能正常显示
    return Promise.allSettled([
      this.loadBanners(),
      this.loadChildInfo()
    ]).then((results) => {
      // 检查是否所有请求都失败了
      const allFailed = results.every(result => result.status === 'rejected');

      if (allFailed) {
        console.warn('所有数据加载失败，使用默认数据');
        this.loadDefaultData();
      }

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      console.log(`首页数据加载完成: ${successCount}/${results.length} 成功`);

      // 孩子信息就绪后才能判断「当前情况」
      return this.loadCurrentStatus();
    }).then(() => {
      // 无论成功失败，都隐藏骨架屏
      this.setData({ loading: false });

      // 数据加载完成后，检查登录状态，未登录则弹出登录提醒
      this.checkShowLoginModal();
    }).catch(err => {
      console.error('首页数据加载失败:', err);
      this.setData({ loading: false });
    });
  },

  /**
   * 加载轮播图
   */
  loadBanners() {
    const db = wx.cloud.database();
    return db.collection('banners')
      .where({
        status: true
      })
      .orderBy('sort', 'asc')
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ banners: res.data });
          console.log('轮播图加载成功:', res.data.length, '条');
        } else {
          console.log('暂无轮播图数据');
          this.setData({ banners: [] });
        }
      })
      .catch(err => {
        console.error('加载轮播图失败:', err);
        this.setData({ banners: [] });
        throw err;  // 抛出错误以便 Promise.allSettled 捕获
      });
  },

  /**
   * 默认数据（当数据库无数据或加载失败时显示）
   */
  loadDefaultData() {
    this.setData({
      loading: false,
      banners: [
        { image: '/images_2/1.jpg', text: '暑期训练营火热招生中' },
        { image: '/images_2/2.jpg', text: '国家级教练团队' },
        { image: '/images_2/3.jpg', text: '科学训练体系' }
      ]
    });
  },

  // ==================== 登录检查 ====================

  /**
   * 检查登录状态，未登录则跳转登录页
   */
  checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/common/login/index' });
      return false;
    }
    return true;
  },

  /**
   * 数据加载完成后检查登录状态，未登录则弹出登录提醒弹窗
   */
  checkShowLoginModal() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ showLoginModal: true });
    }
  },

  /** 登录弹窗 - 确认 */
  onLoginConfirm() {
    this.setData({ showLoginModal: false });
    wx.navigateTo({ url: '/pages/common/login/index' });
  },

  /** 登录弹窗 - 取消 */
  onLoginCancel() {
    this.setData({ showLoginModal: false });
  },

  /** 阻止冒泡 */
  stopPropagation() {},

  // ==================== 生命周期 ====================

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    console.log('首页渲染完成');
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示都刷新：孩子信息变了、「当前情况」也会变（教练可能刚点了开始上课）。
    // 正计时由 loadCurrentStatus 顺带续上（onHide 时被停过）
    this.loadChildInfo().then(() => this.loadCurrentStatus());
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    // 页面在后台还留着实例，定时器不停会一直空转
    this.stopElapsedTicker();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    this.stopElapsedTicker();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadHomeData().then(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    }).catch(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
        duration: 1500
      });
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '腾鑫体育 - 记录每一次进步',
      path: '/pages/users/home/index',
      imageUrl: '/images_1/logo_20251126_34991.uugai.com-1764133166493.png'
    };
  }
});
