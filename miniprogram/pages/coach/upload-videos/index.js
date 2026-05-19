// pages/coach/upload-videos/index.js
Page({

  data: {
    trainingId: '',
    videoUrls: [],
    uploading: false,
    trainingInfo: {}
  },

  onLoad(options) {
    const { trainingId } = options;
    if (trainingId) {
      this.setData({ trainingId });
      this.loadTrainingInfo(trainingId);
    }
  },

  loadTrainingInfo(trainingId) {
    const db = wx.cloud.database();
    db.collection('trainings').doc(trainingId).get().then(res => {
      const training = res.data;
      const videos = training.videos || [];
      const formattedVideos = videos.map(video => ({
        src: video,
        duration: 0
      }));
      this.setData({
        trainingInfo: training,
        videoUrls: formattedVideos
      });
    }).catch(err => {
      console.error('加载训练信息失败', err);
    });
  },

  chooseVideos() {
    const maxCount = 5 - this.data.videoUrls.length;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传5个视频', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      // maxDuration: 120,
      // camera: 'back',
      success: (res) => {
        const tempFiles = res.tempFiles;
        const newVideos = tempFiles.map(file => ({
          src: file.tempFilePath,
          duration: file.duration,
          size: file.size,
          isLocal: true
        }));
        this.setData({
          videoUrls: [...this.data.videoUrls, ...newVideos]
        });
      },
      fail: (err) => {
        console.error('选择视频失败', err);
        wx.showToast({ title: '选择视频失败', icon: 'none' });
      }
    });
  },

  deleteVideo(e) {
    const index = e.currentTarget.dataset.index;
    const videoUrls = [...this.data.videoUrls];
    videoUrls.splice(index, 1);
    this.setData({ videoUrls });
  },

  uploadAndSave() {
    if (this.data.videoUrls.length === 0) {
      wx.showToast({ title: '请先选择视频', icon: 'none' });
      return;
    }

    this.setData({ uploading: true });
    wx.showLoading({ title: '上传中...' });

    const uploadTasks = this.data.videoUrls.map((video, index) => {
      if (!video.isLocal) {
        return Promise.resolve(video.src);
      }
      const cloudPath = `trainings/${this.data.trainingId}/${Date.now()}_${index}.mp4`;
      return wx.cloud.uploadFile({
        cloudPath,
        filePath: video.src
      }).then(res => res.fileID);
    });

    Promise.all(uploadTasks).then(cloudUrls => {
      const db = wx.cloud.database();
      const trainingInfo = this.data.trainingInfo;
      const childId = trainingInfo.childId;
      const date = trainingInfo.date || new Date();
      const yearMonth = date.substring(0, 7);

      const updatePromises = [
        db.collection('trainings').doc(this.data.trainingId).update({
          data: {
            videos: cloudUrls,
            videoCount: cloudUrls.length,
            updatedAt: new Date()
          }
        }),
        this.saveToPhotosAvideos(childId, yearMonth, [], cloudUrls)
      ];

      return Promise.all(updatePromises);
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '上传成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }).catch(err => {
      wx.hideLoading();
      console.error('上传失败', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    }).finally(() => {
      this.setData({ uploading: false });
    });
  },

  saveToPhotosAvideos(childId, yearMonth, newPhotos, newVideos) {
    const db = wx.cloud.database();

    return db.collection('photosAvideos').where({
      childId: childId,
      yearMonth: yearMonth
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const existingDoc = res.data[0];
        const existingPhotos = existingDoc.photos || [];
        const existingVideos = existingDoc.videos || [];
        return db.collection('photosAvideos').doc(existingDoc._id).update({
          data: {
            photos: [...existingPhotos, ...newPhotos],
            photoCount: existingPhotos.length + newPhotos.length,
            videos: [...existingVideos, ...newVideos],
            videoCount: existingVideos.length + newVideos.length,
            updatedAt: new Date()
          }
        });
      } else {
        return db.collection('photosAvideos').add({
          data: {
            childId: childId,
            yearMonth: yearMonth,
            photos: newPhotos,
            photoCount: newPhotos.length,
            videos: newVideos,
            videoCount: newVideos.length,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    });
  }
})
