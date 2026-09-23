// pages/users/home/index.js
//
// 家长端首页。只回答三个问题：今天干什么、孩子进步了吗、下一步做什么。
// 内容型版块（最新动态/家长点评/精彩瞬间/课程体系/成长案例/关于我们/加入我们/联系我们）
// 和八宫格入口都已搬到 pages/users/profile/index。
// 「最近进步」是学员卡下方的独立卡片（三种状态都显示）；空闲态（没在上课、
// 也没下节课）再补一块「成长足迹」：课次统计 + 最新反馈。
const {
  getTodayString,
  pickCurrentTraining,
  pickProgressHighlight,
  pickItemProgress,
  elapsedMinutesOf,
  formatDurationText,
  diffInDays
} = require('../../../utils/helper');
const auth = require('../../../utils/auth');

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
    upcomingItemsText: '',  // 「下节课」的训练项目摘要（items 项目名，与反馈卡同口径）
    // 仅「正在上课」状态才有：已进行时长（随定时器走）+ 「开课 14:32 · 王教练」
    elapsedText: '',
    inClassSubText: '',
    // 「最近进步」独立卡（学员卡下方）：三种状态都显示——进步是历史成绩，
    // 跟此刻是否在上课无关；latestFeedback 同样三态常驻，在训练反馈独立卡里展示
    progress: null,
    progressLabel: '',   // 「首次记录」/「最近进步」/「最近变化」
    progressText: '',    // 「50米 快0.3秒」这种拼好的文案（控制台日志还在用）
    progressMetric: '',  // 独立卡排版第一层：项目/指标名（「跳绳」）
    progressDelta: '',   // 独立卡排版第二层：进步量或当前值（「从3组×12次练到5组×17次」）
    progressCompare: '', // 独立卡排版第三层：对比参照（「自9月21日」，票根小戳）
    latestFeedback: null,
    feedbackItemsText: '',  // 「最新训练反馈」标题旁的项目名摘要（如「深蹲、折返跑等5项」）
    feedbackIsToday: false, // 反馈对应的课就是今天上的 → 标题旁加橙色「今日」标

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
    // 冷启动角色闸门。本页是 app.json 的第一个页面（编译/重新打开后永远先落在这里），
    // 而按角色分流的闸门此前只在登录页 onLoad 里——只有打开的是登录页才生效。
    // 已登录的教练/管理员冷启动会一直停在家长端，得补上：上次从哪个端登录，回哪个端。
    // 口径与登录页完全一致（缓存 userRole + isAdmin + entry，resolveLoginEntry 兜底）。
    if (auth.isLoggedIn() && auth.getEntry() !== auth.ENTRY.USER) {
      const user = {
        role: wx.getStorageSync('userRole') || 'user',
        isAdmin: auth.isAdmin()
      };
      const gate = auth.resolveLoginEntry(user, auth.getEntry());
      wx.reLaunch({ url: gate.home });
      return; // 不是本页的场次，别再往下拉家长端数据
    }

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
    // 请求序号：onLoad 链和 onShow 链会并发跑两套本方法（冷启动必然），两条链
    // 的查询快照若不一致，旧快照可能后到、把新数据翻回去（last-resolver-wins）。
    // 只认最新一次的结果，过期的直接丢弃（同 class-records 的 _querySeq 手法）
    const seq = this._statusSeq = (this._statusSeq || 0) + 1;
    const childId = this.data.childInfo && this.data.childInfo._id;
    if (!childId) {
      this.setData({
        currentMode: 'none',
        currentTraining: null,
        upcomingItemsText: '',
        elapsedText: '',
        inClassSubText: '',
        progress: null,
        progressLabel: '',
        progressText: '',
        progressMetric: '',
        progressDelta: '',
        progressCompare: '',
        latestFeedback: null,
        feedbackItemsText: '',
        feedbackIsToday: false,
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
      if (seq !== this._statusSeq) return;   // 过期响应：更新的那次已在跑，别覆盖
      const merged = [...inClassRes.data, ...upcomingRes.data];
      const { mode, training } = pickCurrentTraining(merged, { today: today });

      const isLive = mode === 'in_class';
      this.setData({
        currentMode: mode,
        currentTraining: training,
        upcomingDateText: mode === 'upcoming' ? this.formatUpcomingDate(training.date, today) : '',
        // 「下节课」卡的训练项目行：只有 upcoming 模式用得到，其余态清空防残留
        upcomingItemsText: mode === 'upcoming' ? this.buildItemsText(training) : '',
        elapsedText: isLive ? this.buildElapsedText(training) : '',
        inClassSubText: isLive ? this.buildInClassSubText(training) : ''
      });

      // 非「正在上课」时这个方法自己会先停掉再返回，不必在这里分流
      this.startElapsedTicker();

      // 「最近进步」独立卡三种状态都要（正在上课也显示）；空闲态走
      // loadGrowthHighlights，它内部同样调 loadProgressAndFeedback——
      // 进步/反馈的判定和文案全项目同源，家长在哪儿看到的都是同一句
      if (mode === 'none') {
        return this.loadGrowthHighlights(childId);
      }
      return this.loadProgressAndFeedback(childId);
    }).catch(err => {
      if (seq !== this._statusSeq) return;
      console.error('加载当前情况失败:', err);
      this.stopElapsedTicker();
      // 只重置「当前情况」卡自己；进步/反馈/课次数是独立数据，查询失败时保留
      // 上一次的值——原来一刀切清零且本会话内再无补拉，一次网络抖动整块闪没
      this.setData({
        currentMode: 'none',
        currentTraining: null,
        upcomingItemsText: '',
        elapsedText: '',
        inClassSubText: ''
      });
    });
  },

  /**
   * 课次的训练项目摘要：项目名 ≤2 个全列，>2 个「前两个 + 等N项」，
   * 没有项目退回派生名（name 本就是按项目名拼的），再没有给空串隐藏行。
   * 与「最新训练反馈」旁的项目摘要同一套口径，家长在哪儿看到的项目名都长一样
   */
  buildItemsText(training) {
    const t = training || {};
    const items = (t.items || []).map(it => (it && it.name) || '').filter(Boolean);
    if (items.length > 2) return items.slice(0, 2).join('、') + '等' + items.length + '项';
    if (items.length) return items.join('、');
    return t.name || '';
  },

  /**
   * 加载最近进步 + 最近训练反馈
   * （学员卡下方的独立进步卡 + 训练反馈独立卡共用，判定文案同源）
   */
  loadProgressAndFeedback(childId) {
    // 自己也带序号：loadCurrentStatus 的守卫只能拦住「过期链还没走到这」，
    // 已经在飞的旧查询得靠这个拦（见 loadCurrentStatus 顶部的说明）
    const seq = this._pfSeq = (this._pfSeq || 0) + 1;
    const db = wx.cloud.database();
    const _ = db.command;
    const today = getTodayString();

    return Promise.all([
      // 取最近四条成绩：pickProgressHighlight 相邻两周没进步时会拿更早的当基线
      // （「最近进步」的窗口 ≈ 一个月），两条太少兜不出这个空间
      db.collection('performance')
        .where({ childId: childId })
        .orderBy('weekDate', 'desc')
        .limit(4)
        .get()
        // 三个数据源地位平等：任何一个挂了只降级自己，不许拖垮另外两个
        // （原来 performance/feedbacks 没兜，挂一条整块清空）
        .catch(() => ({ data: [] })),
      // 「最新反馈」= 最近一条创建进库的：同一天多节课时 date 相同，
      // 只按 date 排序并列时取到的不一定是后写的；createdAt 两类反馈
      // 文档（每课/周报）写入时都有。date 作次序兜底（createdAt 极端同刻时）
      db.collection('feedbacks')
        .where({ childId: childId })
        .orderBy('createdAt', 'desc')
        .orderBy('date', 'desc')
        .limit(1)
        .get()
        .catch(() => ({ data: [] })),
      // 教练自定义训练项目的进步（pickItemProgress）：同名项目最近一个月
      // 做得更多了（更多组/每组更多次）就算。这里只粗筛今天及以前、取最近
      // 20 条课次，窗口/同名匹配/只认勾了完成的都在 helper 里判。
      // 已知边界：date 只匹配字符串——Date 类型的历史文档 _.lte('YYYY-MM-DD')
      // 查不出来（BSON 类型序）；但两条写入路径都写字符串、窗口才 30 天，
      // 可接受。反过来去掉过滤的话，desc 排序下未来课次会把 20 个档位占掉，更伤
      db.collection('trainings')
        .where({ childId: childId, date: _.lte(today) })
        .orderBy('date', 'desc')
        .limit(20)
        .get()
        // 项目数据查不出来只降级（回落体测成绩那套），别把进步/反馈整块拖垮
        .catch(() => ({ data: [] }))
    ]).then(([perfRes, fbRes, trainRes]) => {
      if (seq !== this._pfSeq) return;
      // 项目进步优先——「深蹲 从3组练到5组」比体测数字更具体，家长一眼懂；
      // 两套都没有（数据太旧/只有一条/没变化）才是 null，独立卡整卡隐藏
      const progress = pickItemProgress(trainRes.data, { today: today })
        || pickProgressHighlight(perfRes.data, { today: today });
      // 文案在 js 里拼好，wxml 就不必堆嵌套三元
      // 「首次记录」没有 deltaText（没得比）；退步时不叫「进步」，如实说「最近变化」
      let progressLabel = '';
      let progressText = '';
      if (progress) {
        if (progress.mode === 'first') {
          progressLabel = '首次记录';
          progressText = `${progress.metricName} 起点 ${progress.currentText}`;
        } else {
          // 「最近进步」：横向比过所有指标、也纵向比过最近一个月里的基线后选出来的那项
          progressLabel = progress.isImprovement ? '最近进步' : '最近变化';
          // 对比段（自上周/自上次记录）给家长一个参照系；括号里的周区间在首页太长，剥掉
          const comparison = (progress.comparisonText || '').replace(/（.*?）/, '');
          progressText = `${progress.metricName} ${progress.deltaText}${comparison ? ' · ' + comparison : ''}`;
        }
      }

      // 排查用一行日志：卡片不显示时看这里，立刻分清是「数据没达标」还是「查询失败」
      // （课次 0 条 = 查询/权限问题；null = 最近一个月没有「同名+勾选+加了量」的进步）
      console.log('[最近进步] 课次', (trainRes.data || []).length, '条 / 体测', (perfRes.data || []).length, '条 →',
        progress ? (progressLabel + '：' + progressText) : 'null（最近一个月没有达标的进步，卡片隐藏）');

      const latestFeedback = fbRes.data.length ? fbRes.data[0] : null;
      // 「最新训练反馈」标题旁的项目名：反馈文档本身不存项目，有 trainingId
      // 就顺路取一次课次文档，用它的派生名（≤2 项全列，>2「前两个 + 等N项」）；
      // 周报（无 trainingId）/课次已删/没项目 → 空串，标题旁就不显示
      const ensureItemsText = (latestFeedback && latestFeedback.trainingId)
        ? db.collection('trainings').doc(latestFeedback.trainingId).get()
          .then(tRes => {
            const t = (tRes && tRes.data) || {};
            const items = (t.items || []).map(it => (it && it.name) || '').filter(Boolean);
            if (items.length > 2) return items.slice(0, 2).join('、') + '等' + items.length + '项';
            if (items.length) return items.join('、');
            return t.name || '';
          })
          .catch(() => '')
        : Promise.resolve('');

      // 独立卡的三层排版数据；progressText 继续拼好，控制台自诊日志还在用它
      const compareChip = (progress && (progress.comparisonText || '').replace(/（.*?）/, '')) || '';
      return ensureItemsText.then(itemsText => {
        this.setData({
          progress,
          progressLabel,
          progressText,
          progressMetric: progress ? progress.metricName : '',
          // 「首次记录」没有 deltaText，给成绩加「起点」二字——第一次记录是成长线的原点，
          // 跟进步卡的「从X练到Y」同一个叙事：这条线从今天开始画
          progressDelta: progress ? (progress.mode === 'first' ? '起点 ' + progress.currentText : (progress.deltaText || progress.currentText)) : '',
          progressCompare: (progress && progress.mode !== 'first') ? compareChip : '',
          latestFeedback,
          feedbackItemsText: itemsText,
          // 「今日」橙标：反馈对应的课就是今天上的（date 是课次日期）
          feedbackIsToday: !!(latestFeedback && latestFeedback.date === getTodayString())
        });
      });
    }).catch(err => {
      if (seq !== this._pfSeq) return;
      // 进步和反馈是锦上添花，失败不该把「下节课」本身也弄没
      console.error('加载进步/反馈失败:', err);
      this.setData({
        progress: null, progressLabel: '', progressText: '',
        progressMetric: '', progressDelta: '', progressCompare: '',
        latestFeedback: null, feedbackItemsText: '', feedbackIsToday: false
      });
    });
  },

  /**
   * 空闲态「成长足迹」：累计/本月课次（进步/反馈已上移为独立卡，三态常驻）
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
    const seq = this._ghSeq = (this._ghSeq || 0) + 1;
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
      if (seq !== this._ghSeq) return;
      this.setData({ totalTrainings: total, monthTrainings: month });
      this.refreshGrowthEmptyFlag();
    }).catch(err => {
      if (seq !== this._ghSeq) return;
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

  /** 最新反馈 → 反馈详情（只看这一条）；拿不到 id 时退化去列表 */
  goToFeedback() {
    const fb = this.data.latestFeedback;
    if (fb && fb._id) {
      wx.navigateTo({ url: '/pages/users/feedback-detail/index?id=' + fb._id });
    } else {
      wx.navigateTo({ url: '/pages/users/my-feedback/index' });
    }
  },

  /** 下节课卡的「我的课表」→ 家长课表页（catch 断冒泡，不触发整卡的查看详情） */
  goToMySchedule() {
    wx.navigateTo({ url: '/pages/users/trainings/index' });
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
