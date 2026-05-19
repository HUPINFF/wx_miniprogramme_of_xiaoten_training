// pages/coach/comment-detail/index.js
Page({
  data: {
    comment: null,
    training: null,
    photos: [],
    videos: [],
    loading: true
  },

  onLoad(options) {
    const { id } = options;
    console.log('Comment detail page received id:', id);
    if (id) {
      this.loadCommentDetail(id);
    }
  },

  loadCommentDetail(commentId) {
    this.setData({ loading: true });
    const db = wx.cloud.database();

    db.collection('comment').doc(commentId).get()
      .then(res => {
        const comment = res.data;
        this.setData({ comment });

        if (comment.trainingId) {
          return this.loadTraining(comment.trainingId);
        } else {
          this.setData({ loading: false });
        }
      })
      .catch(err => {
        console.error('加载点评详情失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  loadTraining(trainingId) {
    const db = wx.cloud.database();

    db.collection('trainings').doc(trainingId).get()
      .then(res => {
        const training = res.data;
        this.setData({ training });

        if (training) {
          this.processMedia(training);
        }
        this.setData({ loading: false });
      })
      .catch(err => {
        console.error('加载训练详情失败', err);
        this.setData({ loading: false });
      });
  },

  processMedia(training) {
    let photos = [];
    let videos = [];

    if (training.photos && training.photos.length > 0) {
      photos = training.photos;
    }

    if (training.videos && training.videos.length > 0) {
      videos = training.videos;
    }

    this.setData({ photos, videos });
  },

  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({
      current: url,
      urls: this.data.photos
    });
  }
});