// pages/users/training-detail/index.js
//
// 家长端训练详情页。入口是首页「当前情况」卡片（正在上课 / 下节课 两种状态共用）。
// 与教练端 pages/coach/training-detail 的区别：这里额外展示**实际开课时间**、
// **上课教练（含头像和拨号）**、**上课地点**、**本次训练内容**。
const {
  getTrainingStatusMeta,
  parseSessionStart,
  formatDurationText,
  elapsedMinutesOf
} = require('../../../utils/helper');

// 项目里没有 miniprogram/images/ 目录，coach-card 内置的 '/images/default-avatar.png'
// 是死路径（渲染出来就是裂图），所以默认头像用云存储的 fileID。
const DEFAULT_AVATAR = 'cloud://hupin255-5gfbw856b1c861ef.6875-hupin255-5gfbw856b1c861ef-1410552194/default_avatar/6756593ba0eb6a537f7060da8ede3ca8.jpeg';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    loading: true,
    training: null,
    statusText: '',   // 待上课 / 已排课 / 上课中 / 已完成
    statusKey: '',    // pending / scheduled / in_class / finished，决定头图配色与文案
    inClassTimeText: '',  // 实际开课时间，格式 '9月15日 14:32'；教练没记录时为空
    coachInfo: null,  // users 集合里的教练（avatarUrl / name / phone）
    childInfo: null,
    feedback: null,   // 这节课的教练反馈（每课反馈文档，没写/查不到则 null）
    feedbackLoaded: false,  // 反馈查询已出结果（含失败）——「暂无反馈」只在查完之后才许说

    // 头图。本页唯一「大声」的地方，一条训练只讲一件事：
    // 上课中→已经上了多久（活数字）；未开课→还有多久；已结束→这次练的是什么
    isLive: false,
    heroLabel: '',
    heroValue: '',
    heroValueCompact: false,  // 头图值是一整句话时降一档字号
    heroSub: '',
    planTimeText: '',   // 「9月15日 周一 14:30-16:00」

    // 兜成数组，wxml 里就不用到处判空
    photos: [],
    videos: [],
    hasMedia: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { id } = options;
    if (id) {
      this.loadTrainingDetail(id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => { wx.navigateBack(); }, 1500);
    }

    // 「已进行 32 分钟」这类活数字要自己走，句柄挂在实例上（不在 data 里，避免无谓渲染）
    this.ticker = null;
  },

  /**
   * 加载训练详情
   */
  loadTrainingDetail(id) {
    const db = wx.cloud.database();

    db.collection('trainings').doc(id).get().then(res => {
      const training = res.data;
      // 状态文案走 helper 的元数据，四种状态全覆盖（教练端详情页只写了三种）
      const meta = getTrainingStatusMeta(training.status);
      const inClassTimeText = this.formatDateTime(training.inClassTime);
      // 媒体两个来源：上课页现场传的 classPhotos/classVideos（现行流程），
      // 老流程写的 photos/videos（历史文档）。合并展示，别让新文档因为字段改名而空白
      const photos = (training.classPhotos || []).concat(training.photos || []);
      const videos = (training.classVideos || []).concat(training.videos || []);

      this.setData(Object.assign({
        training,
        statusText: meta.text,
        statusKey: meta.key,
        inClassTimeText,
        planTimeText: this.buildPlanTimeText(training),
        photos,
        videos,
        hasMedia: photos.length > 0 || videos.length > 0,
        loading: false
      }, this.buildHero(training, meta, inClassTimeText)));

      // 头图可能是活数字，按秒刷新；不需要的（已完成等）startTicker 自己会跳过
      this.startTicker();

      // 教练/学员/反馈都是附加信息，各自失败不影响主内容
      if (training.coachId) this.loadCoachInfo(training.coachId, training.coachName);
      if (training.childId) this.loadChildInfo(training.childId);
      this.loadFeedback(id, training.childId);
    }).catch(err => {
      console.error('加载训练详情失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => { wx.navigateBack(); }, 1500);
    });
  },

  /**
   * 加载教练信息
   *
   * trainings 记录里只有 coachName，没有头像也没有电话，要按 coachId 再查一次 users。
   * 查不到时用记录里的 coachName + 默认头像兜底，别让教练那块空掉。
   */
  loadCoachInfo(coachId, fallbackName) {
    const db = wx.cloud.database();

    db.collection('users').doc(coachId).get().then(res => {
      const coach = res.data || {};
      this.setData({
        coachInfo: {
          name: coach.name || fallbackName || '',
          avatarUrl: coach.avatarUrl || DEFAULT_AVATAR,
          phone: coach.phone || ''
        }
      });
    }).catch(err => {
      console.error('加载教练信息失败:', err);
      this.setData({
        coachInfo: { name: fallbackName || '', avatarUrl: DEFAULT_AVATAR, phone: '' }
      });
    });
  },

  /**
   * 加载学员信息
   */
  loadChildInfo(childId) {
    const db = wx.cloud.database();

    db.collection('children').doc(childId).get().then(res => {
      this.setData({ childInfo: res.data });
    }).catch(err => {
      // 学员信息只是补充，失败就不显示「学员」那一行
      console.error('加载学员信息失败:', err);
    });
  },

  /**
   * 加载这节课的教练反馈（每课反馈文档，trainingId 指回本次课）
   *
   * 查不到的情况：还没写反馈 / 旧周报形态的文档没有 trainingId（无法按课匹配）/
   * 查询失败。反馈是补充信息，任何一种情况都只是不显示内容，不影响页面其它部分。
   */
  loadFeedback(trainingId, childId) {
    const db = wx.cloud.database();
    const where = { trainingId: trainingId };
    if (childId) where.childId = childId;   // 顺路带上 childId，缩小匹配面

    db.collection('feedbacks').where(where).limit(1).get().then(res => {
      this.setData({ feedback: (res.data || [])[0] || null, feedbackLoaded: true });
    }).catch(err => {
      // 失败也置位：不然已完结且有反馈的课会一直挂着「暂无教练反馈」这个错误陈述
      console.error('加载教练反馈失败:', err);
      this.setData({ feedbackLoaded: true });
    });
  },

  /**
   * 查看完整反馈：照片/视频/朋友圈分享文案都在反馈详情页
   */
  goFeedbackDetail() {
    const fb = this.data.feedback;
    if (!fb || !fb._id) return;
    wx.navigateTo({ url: '/pages/users/feedback-detail/index?id=' + fb._id });
  },

  /**
   * 格式化开课时间为 '9月15日 14:32'
   *
   * 云数据库取回的 inClassTime 是 Date 对象，但也可能是字符串，两种都要认。
   * ⚠️ 纯日期字符串不能直接 new Date()：按规范会被当作 UTC 午夜解析，所以先手工
   *    拆成本地时间再构造（与 utils/helper 的 toLocalDate 同一个理由）。
   */
  formatDateTime(input) {
    if (!input) return '';

    let date;
    if (input instanceof Date) {
      date = input;
    } else if (typeof input === 'string') {
      const matched = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      date = matched
        ? new Date(parseInt(matched[1], 10), parseInt(matched[2], 10) - 1, parseInt(matched[3], 10))
        : new Date(input);
    } else {
      date = new Date(input);
    }

    if (!date || isNaN(date.getTime())) return '';

    const pad = n => String(n).padStart(2, '0');
    return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  /**
   * 'YYYY-MM-DD' → '9月15日'。和 formatDateTime 分开是因为纯日期带个 00:00 很难看
   */
  formatDateOnly(input) {
    const matched = String(input || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!matched) return '';

    return `${parseInt(matched[2], 10)}月${parseInt(matched[3], 10)}日`;
  },

  /**
   * 「9月15日 周一 14:30-16:00」，缺哪段跳哪段
   */
  buildPlanTimeText(training) {
    const parts = [];
    const dateText = this.formatDateOnly(training.date);
    if (dateText) parts.push(dateText);
    if (training.day) parts.push(training.day);
    if (training.startTime) {
      parts.push(training.endTime ? `${training.startTime}-${training.endTime}` : training.startTime);
    }

    return parts.join(' ');
  },

  /**
   * 组装头图。同一个页面在四种状态下要讲四件不同的事，
   * 这是本页唯一「大声」的地方，其余全部退到下面的卡片里：
   *   上课中 → 已经上了多久（活数字，随 ticker 刷新）
   *   已完成 → 这次练的是什么
   *   其余   → 还有多久开始，时间已过就退回静态日期
   */
  buildHero(training, meta, inClassTimeText) {
    const key = meta.key;
    const isLive = key === 'in_class';
    let heroLabel = '';
    let heroValue = '';
    let heroSub = '';

    if (isLive) {
      // 优先用实际开课时间算已进行时长；教练没记录就退回计划开始时间，
      // 两个都没有（老数据）就只说明状态，不编一个假数字出来
      const minutes = elapsedMinutesOf(training);
      heroLabel = '正在进行';
      heroValue = minutes === null ? '上课中' : formatDurationText(minutes);
      heroSub = inClassTimeText ? `开课 ${inClassTimeText}` : '教练已开始本次训练';
    } else if (key === 'finished') {
      heroLabel = '本次训练';
      heroValue = training.coachContent || training.type || '已完成';
      heroSub = inClassTimeText ? `开课 ${inClassTimeText}` : '本次训练已结束';
    } else {
      heroLabel = '距离上课';
      const start = parseSessionStart(training);
      if (start && start.getTime() > Date.now()) {
        const minutes = Math.floor((start.getTime() - Date.now()) / 60000);
        heroValue = minutes >= 24 * 60
          ? `${Math.floor(minutes / (24 * 60))}天`
          : formatDurationText(minutes);
      } else {
        // 时间已过或缺失：别再倒数了，给个静态日期就够
        heroValue = this.formatDateOnly(training.date) || '时间待定';
      }
      heroSub = this.buildPlanTimeText(training);
    }

    // 已完成的头图放的是一整句话（本次训练内容），68rpx 会撑爆好几行。
    // 时长和日期最长也就「1小时12分」6 个字，超过 6 个字一定是句子，降一档字号。
    // 包一层 String()：coachContent 万一落库成数字，.length 会是 undefined
    return { isLive, heroLabel, heroValue, heroSub, heroValueCompact: String(heroValue).length > 6 };
  },

  // ==================== 头图定时器 ====================

  /**
   * 活数字要自己走。只在真的需要倒计时/正计时时才开，别让定时器空转
   */
  startTicker() {
    this.stopTicker();
    if (!this.needsTicker()) return;

    this.ticker = setInterval(() => { this.refreshHero(); }, 1000);
  },

  stopTicker() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  },

  /**
   * 上课中要正计时；未开课且开始时刻还没到才要倒计时；
   * 已完成、时间已过、时间缺失都是静态文案，不需要每秒刷
   */
  needsTicker() {
    const { statusKey, training } = this.data;
    if (!training) return false;
    if (statusKey === 'in_class') return true;
    if (statusKey !== 'pending' && statusKey !== 'scheduled') return false;

    const start = parseSessionStart(training);
    return !!start && start.getTime() > Date.now();
  },

  refreshHero() {
    if (!this.needsTicker()) {
      this.stopTicker();
      return;
    }

    const next = this.buildHero(
      this.data.training,
      getTrainingStatusMeta(this.data.statusKey),
      this.data.inClassTimeText
    );

    // 文案没变就别 setData —— 一秒一次的空渲染没必要
    if (next.heroValue === this.data.heroValue && next.heroSub === this.data.heroSub) return;

    this.setData({
      heroValue: next.heroValue,
      heroSub: next.heroSub,
      heroValueCompact: next.heroValueCompact
    });
  },

  /**
   * 拨打教练电话
   */
  callCoach() {
    const phone = this.data.coachInfo && this.data.coachInfo.phone;
    if (!phone) return;

    wx.makePhoneCall({
      phoneNumber: phone,
      fail: () => {
        wx.showToast({ title: '拨打电话失败', icon: 'none' });
      }
    });
  },

  /**
   * 预览训练照片
   */
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.photos.length ? this.data.photos : [url]
    });
  },

  /**
   * 播放训练视频
   */
  playVideo(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;

    const open = (src) => {
      wx.previewMedia({
        sources: [{ url: src, type: 'video' }],
        current: 0,
        showmenu: true,
        fail: () => {
          wx.showToast({ title: '视频播放失败', icon: 'none' });
        }
      });
    };

    // previewMedia 不认 cloud:// fileID（<image>/<video>/previewImage 可以直接吃），
    // 云存储的文件要先换临时链接。换不出来就明说，别把 fileID 塞给 previewMedia 静默失败
    if (/^cloud:/.test(url)) {
      wx.cloud.getTempFileURL({ fileList: [url] }).then(res => {
        const file = (res.fileList || [])[0];
        const src = file && file.tempFileURL;
        if (!src) {
          wx.showToast({ title: '视频加载失败', icon: 'none' });
          return;
        }
        open(src);
      }).catch(() => {
        wx.showToast({ title: '视频加载失败', icon: 'none' });
      });
    } else {
      open(url);
    }
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
    // 从后台回来时定时器是停的，而且真实时间可能已经跨过开课点，先重算一次再续上
    if (this.data.training) {
      this.refreshHero();
      this.startTicker();
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    this.stopTicker();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    this.stopTicker();
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
    const training = this.data.training || {};
    return {
      title: training.name ? `${training.name} - 训练详情` : '腾鑫体育 - 训练详情',
      path: '/pages/users/home/index'
    };
  }
});
