// pages/coach/upload-photos/index.js
Page({

  data: {
    trainingId: '',
    photoUrls: [],
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
      this.setData({
        trainingInfo: training,
        photoUrls: training.photos || []
      });
    }).catch(err => {
      console.error('加载训练信息失败', err);
    });
  },

  choosePhotos() {
    const maxCount = 9 - this.data.photoUrls.length;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles;
        const tempFilePaths = tempFiles.map(file => file.tempFilePath);
        this.setData({
          photoUrls: [...this.data.photoUrls, ...tempFilePaths]
        });
      },
      fail: (err) => {
        console.error('选择照片失败', err);
        wx.showToast({ title: '选择照片失败', icon: 'none' });
      }
    });
  },

  deletePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photoUrls = [...this.data.photoUrls];
    photoUrls.splice(index, 1);
    this.setData({ photoUrls });
  },

  previewPhoto(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.photoUrls[index],
      urls: this.data.photoUrls
    });
  },

  uploadAndSave() {
    if (this.data.photoUrls.length === 0) {
      wx.showToast({ title: '请先选择照片', icon: 'none' });
      return;
    }

    this.setData({ uploading: true });
    wx.showLoading({ title: '上传中...' });

    const uploadTasks = this.data.photoUrls.map((filePath, index) => {
      if (filePath.startsWith('cloud://')) {
        return Promise.resolve(filePath);
      }
      const cloudPath = `trainings/${this.data.trainingId}/${Date.now()}_${index}.jpg`;
      return wx.cloud.uploadFile({
        cloudPath,
        filePath
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
            photos: cloudUrls,
            photoCount: cloudUrls.length,
            updatedAt: new Date()
          }
        }),
        this.saveToPhotosAvideos(childId, yearMonth, cloudUrls, [])
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
