// components/edit-profile-modal/index.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    userData: {
      type: Object,
      value: {}
    }
  },

  data: {
    formData: {
      name: '',
      avatarUrl: ''
    },
    submitting: false
  },

  observers: {
    'userData': function(userData) {
      if (userData) {
        this.setData({
          formData: {
            name: userData.name || userData.nickName || '',
            avatarUrl: userData.avatarUrl || ''
          }
        });
      }
    }
  },

  methods: {
    close() {
      this.triggerEvent('close');
    },

    stopPropagation() {},

    // 选择头像
    chooseAvatar() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFiles[0].tempFilePath;
          this.uploadAvatar(tempFilePath);
        }
      });
    },

    // 上传头像到云存储
    uploadAvatar(filePath) {
      wx.showLoading({ title: '上传中...' });
      
      const cloudPath = `avatars/${Date.now()}.jpg`;
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (uploadRes) => {
          this.setData({ 'formData.avatarUrl': uploadRes.fileID });
          wx.hideLoading();
          wx.showToast({ title: '上传成功', icon: 'success' });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('上传失败', err);
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      });
    },

    // 输入昵称
    onNicknameInput(e) {
      this.setData({ 'formData.name': e.detail.value });
    },

    // 确认保存
    confirm() {
      const { name, avatarUrl } = this.data.formData;
      
      if (!name.trim()) {
        wx.showToast({ title: '请输入昵称', icon: 'none' });
        return;
      }

      this.setData({ submitting: true });
      this.triggerEvent('confirm', {
        name: name.trim(),
        avatarUrl: avatarUrl
      });
    }
  }
});