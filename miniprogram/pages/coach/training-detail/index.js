Page({
  data: {
    training: null,
    childInfo: null
  },

  onLoad(options) {
    const { id } = options;
    console.log('训练详情页加载，ID:', id);
    if (id) {
      this.loadTrainingInfo(id);
    }
  },

  loadTrainingInfo(trainingId) {
    const db = wx.cloud.database();
    db.collection('trainings').doc(trainingId).get().then(res => {
      console.log('训练数据:', res.data);
      const training = res.data;
      this.setData({ training });

      if (training && training.childId) {
        console.log('加载学员信息, childId:', training.childId);
        this.loadChildInfo(training.childId);
      } else {
        console.log('训练数据没有childId或childId为空');
      }
    }).catch(err => {
      console.error('加载训练信息失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  loadChildInfo(childId) {
    if (!childId) {
      console.log('childId为空，跳过加载学员信息');
      return;
    }

    const db = wx.cloud.database();
    db.collection('children').doc(childId).get().then(res => {
      console.log('学员信息:', res.data);
      this.setData({ childInfo: res.data });
    }).catch(err => {
      console.error('加载学员信息失败', err);
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.training.photos || [url]
    });
  },

  playVideo(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewMedia({
      sources: [{
        url: url,
        type: 'video'
      }],
      current: 0,
      showmenu: true
    });
  }
})