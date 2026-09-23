// pages/coach/in-class/index.js
// 上课中：训练项目打卡 + 精彩照片/视频现场录入（选完即传云存储、写回课次文档）。
// 媒体存 classPhotos/classVideos，课后记录写反馈时从这里取。
const MEDIA_CAP = 3;
const itemAI = require('../../../utils/itemAI');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    training: {},
    showConfirmModal: false,
    childInfo: {},
    // 训练项目打卡清单（旧文档无 items 字段则为空，隐藏该区块）
    items: [],
    doneCount: 0,

    // 精彩照片/视频：上课中现场录入，选完即上传并同步课次文档
    photos: [],
    videos: [],
    photoCap: MEDIA_CAP,
    videoCap: MEDIA_CAP,
    uploading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { trainingId, id } = options;
    const targetId = trainingId || id;
    console.log('in-class页面加载, trainingId:', targetId);
    if (targetId) {
      this.loadTrainingInfo(targetId);
    }
  },

  // 加载训练信息
  loadTrainingInfo(trainingId) {
    const db = wx.cloud.database();
    db.collection('trainings').doc(trainingId).get().then(res => {
      console.log('训练数据:', res.data);
      const training = res.data;
      this.setData({ training });

      // 训练项目打卡清单：勾选状态存在课次文档上，退出重进会随文档恢复
      // 组数/个数选填，拼成「3组×12次」展示；没填则为空、行内不显示。
      // sets/reps 必须带进内存对象——persistItems 会把整个数组写回课次文档，
      // 这里丢了就会把文档里的组数/个数洗掉，家长版的完成量也随之消失。
      // performance（上课填的本次表现）与 metric（AI 从表现里抽的成绩数值）同理必须带回，
      // 否则一次勾选就洗掉了。
      const items = (training.items || []).map(it => ({
        name: (it && it.name) || '',
        done: !!(it && it.done),
        sets: (it && it.sets) || '',
        reps: (it && it.reps) || '',
        performance: (it && it.performance) || '',
        metric: (it && it.metric) || null,
        amount: [(it && it.sets) ? it.sets + '组' : '', (it && it.reps) ? it.reps + '次' : ''].filter(Boolean).join('×')
      }));
      // 精彩瞬间同样随课次文档恢复
      this.setData({
        items,
        doneCount: items.filter(it => it.done).length,
        photos: (training.classPhotos || []).filter(Boolean),
        videos: (training.classVideos || []).filter(Boolean)
      });

      // 如果状态是 pending，进入时更新为上课中
      if (training.status === 'pending') {
        this.updateTrainingStatus(trainingId, 'in_class', training);
      }

      // 加载学员信息
      if (training.childId) {
        this.loadChildInfo(training.childId);
      }
    }).catch(err => {
      console.error('加载训练信息失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 更新训练状态
  updateTrainingStatus(trainingId, status, training = null) {
    const db = wx.cloud.database();
    const nextData = {
      status: status,
      updatedAt: new Date()
    };
    // 置为「上课中」时补记实际开课时间，家长端详情页的「开课时间」用这个字段。
    // 已有值就不覆盖：从工作台/课表点开课时已经写过一次了。
    if (status === 'in_class' && !(training && training.inClassTime)) {
      nextData.inClassTime = new Date();
    }

    db.collection('trainings').doc(trainingId).update({
      data: nextData
    }).then(() => {
      console.log('训练状态已更新为:', status);
      // 更新成功后同步更新页面显示
      if (training) {
        this.setData({
          training: {
            ...training,
            status: status
          }
        });
      }
    }).catch(err => {
      console.error('更新训练状态失败', err);
    });
  },

  // 加载学员信息
  loadChildInfo(childId) {
    const db = wx.cloud.database();
    db.collection('children').doc(childId).get().then(res => {
      this.setData({ childInfo: res.data });
    }).catch(err => {
      console.error('加载学员信息失败', err);
    });
  },

  // 勾选/取消训练项目（整行可点），勾选即写库
  onToggleItem(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const items = this.data.items;
    if (!items[idx]) return;
    const next = items.slice();
    next[idx] = Object.assign({}, next[idx], { done: !next[idx].done });
    this.setData({ items: next, doneCount: next.filter(it => it.done).length });
    this.persistItems(next);
  },

  // 把项目勾选状态写回课次文档。快速连点时用队列串行化，
  // 防止两次全量写入乱序、旧快照覆盖新状态。失败静默——课上不打断，课后可补勾。
  persistItems(items) {
    if (!this.data.training || !this.data.training._id) return;
    const db = wx.cloud.database();
    // 只回写数据字段：sets/reps/performance/metric 原样带回；amount 是派生的展示串，不入库
    const clean = items.map(it => ({
      name: it.name || '',
      done: !!it.done,
      sets: it.sets || '',
      reps: it.reps || '',
      performance: (it.performance || '').trim(),
      metric: it.metric || null
    }));
    const write = () => db.collection('trainings').doc(this.data.training._id).update({
      data: { items: clean, updatedAt: new Date() }
    }).catch(err => console.error('保存训练项目失败', err));
    this._saveQueue = (this._saveQueue || Promise.resolve()).then(write);
  },

  // 本次表现（选填文字）：边输边存本地，停手 800ms 后落库（防每个键一次全量写）；
  // 失焦立即落。写进课次文档后家长端/教练端成长页的训练项目层会展示最新一条
  onPerfInput(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const items = this.data.items;
    if (!items[idx]) return;
    const next = items.slice();
    next[idx] = Object.assign({}, next[idx], { performance: e.detail.value });
    this.setData({ items: next });
    if (this._perfTimer) clearTimeout(this._perfTimer);
    this._perfTimer = setTimeout(() => {
      this._perfTimer = null;
      this.persistItems(this.data.items);
    }, 800);
  },

  onPerfBlur(e) {
    if (this._perfTimer) {
      clearTimeout(this._perfTimer);
      this._perfTimer = null;
    }
    this.persistItems(this.data.items);
    this.extractMetric(Number(e && e.currentTarget && e.currentTarget.dataset.index));
  },

  /**
   * 表现文字交给 AI 抽成绩数值（异步不阻塞上课；失败静默——展示端没有数值就
   * 只显文字、不画进步对比）。文字没变不重复抽；抽到后把 metric 并回该项目
   * 整组写回课次文档。页面 navigateTo 走了实例仍活着，下课前的漏抽也能补上。
   */
  extractMetric(idx) {
    const it = this.data.items[idx];
    if (!it || !it.name || !(it.performance || '').trim()) return;
    const text = it.performance.trim();
    if (it.metric && it.metric.text === text) return; // 文字没改过，数值还是新鲜的
    itemAI.parsePerformance(it.name, text).then(metric => {
      if (!metric) return;
      const cur = this.data.items;
      // 抽取期间文字又改了：这份数值对应的是旧文字，丢弃，等下次失焦重抽
      if (!cur[idx] || (cur[idx].performance || '').trim() !== text) return;
      const next = cur.slice();
      next[idx] = Object.assign({}, cur[idx], { metric: Object.assign({}, metric, { text: text }) });
      this.setData({ items: next });
      this.persistItems(next);
    }).catch(() => { /* fail-soft：没有数值就没有对比，不打断上课 */ });
  },

  // ---- 精彩瞬间：上课中拍照/录视频，选完即上传（注意：chooseMedia 不能传 maxDuration，iOS 会弹不出选择器） ----
  addPhoto() {
    if (this.data.uploading) return;
    const remain = MEDIA_CAP - this.data.photos.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多 ' + MEDIA_CAP + ' 张照片', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = (res.tempFiles || []).map(f => f.tempFilePath);
        if (paths.length) this.uploadMedia('photos', paths, 'jpg');
      }
    });
  },

  addVideo() {
    if (this.data.uploading) return;
    const remain = MEDIA_CAP - this.data.videos.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多 ' + MEDIA_CAP + ' 个视频', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = (res.tempFiles || []).map(f => f.tempFilePath);
        if (paths.length) this.uploadMedia('videos', paths, 'mp4');
      }
    });
  },

  // 上传到云存储后把 fileID 列表同步回课次文档（classPhotos / classVideos）
  uploadMedia(field, locals, ext) {
    const training = this.data.training;
    if (!training || !training._id || !training.childId) {
      wx.showToast({ title: '缺少课次信息', icon: 'none' });
      return;
    }
    wx.showLoading({ title: field === 'photos' ? '上传照片...' : '上传视频...', mask: true });
    this.setData({ uploading: true });
    const keeps = this.data[field].filter(p => p && p.indexOf('cloud://') === 0);
    const tasks = locals.map((filePath, i) => {
      return wx.cloud.uploadFile({
        cloudPath: 'trainings/' + training.childId + '/' + Date.now() + '_class_' + field + '_' + i + '.' + ext,
        filePath: filePath
      }).then(res => res.fileID);
    });
    Promise.all(tasks).then(fileIDs => {
      wx.hideLoading();
      const all = keeps.concat(fileIDs);
      this.setData({ uploading: false, [field]: all });
      this.persistMedia(field, all);
    }).catch(err => {
      wx.hideLoading();
      this.setData({ uploading: false });
      console.error('上传失败', err);
      wx.showToast({ title: '上传失败，请重试', icon: 'none' });
    });
  },

  removePhoto(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const photos = this.data.photos.slice();
    photos.splice(idx, 1);
    this.setData({ photos });
    this.persistMedia('photos', photos);
  },

  removeVideo(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const videos = this.data.videos.slice();
    videos.splice(idx, 1);
    this.setData({ videos });
    this.persistMedia('videos', videos);
  },

  persistMedia(field, list) {
    if (!this.data.training || !this.data.training._id) return;
    const db = wx.cloud.database();
    const data = { updatedAt: new Date() };
    data[field === 'photos' ? 'classPhotos' : 'classVideos'] = list;
    const write = () => db.collection('trainings').doc(this.data.training._id).update({
      data
    }).catch(err => console.error('保存媒体失败', err));
    this._saveQueue = (this._saveQueue || Promise.resolve()).then(write);
  },

  previewPhoto(e) {
    const idx = Number(e.currentTarget.dataset.index);
    wx.previewImage({ urls: this.data.photos, current: this.data.photos[idx] });
  },

  previewVideo(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const list = this.data.videos;
    if (!list[idx]) return;
    if (list[idx].indexOf('cloud://') !== 0) {
      wx.previewMedia({ sources: this.toVideoSources(list), current: idx });
      return;
    }
    // 云端 fileID 换临时链接再预览
    wx.cloud.getTempFileURL({ fileList: [list[idx]] }).then(res => {
      const url = res.fileList && res.fileList[0] && res.fileList[0].tempFileURL;
      if (!url) return;
      const urls = list.slice();
      urls[idx] = url;
      wx.previewMedia({ sources: this.toVideoSources(urls), current: idx });
    }).catch(() => {});
  },

  toVideoSources(list) {
    return list.map(u => ({ url: u, type: 'video' }));
  },

  // 点击下课按钮
  onFinishClass() {
    this.setData({ showConfirmModal: true });
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showConfirmModal: false });
  },

  // 确认下课
  confirmDeductHours() {
    const { training } = this.data;
    this.setData({ showConfirmModal: false });
    // 兜底先把本次表现落库（正常情况输入失焦时已写，这里防「输入框还压着键盘就点下课」）；
    // 还没抽取过的表现文字一并丢给 AI（页面跳走实例仍在，回包照常写回）
    this.persistItems(this.data.items);
    this.data.items.forEach((it, i) => this.extractMetric(i));
    // 盖下课时间戳：status 要等课后记录「完成记录」才写 finished，这中间的窗口期
    // 工作台「正在上课」卡靠 classEndedAt 判断已下课（不挡从今日课列表重新进课堂补勾）
    const db = wx.cloud.database();
    db.collection('trainings').doc(training._id).update({
      data: { classEndedAt: new Date() }
    }).catch(err => console.error('记录下课时间失败', err));
    // 直接跳转至课后记录页面，课时在完成记录时扣除
    wx.navigateTo({
      url: `/pages/coach/post-class/index?id=${training._id}&childId=${training.childId}`
    });
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