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
      nickName: '',
      avatarUrl: ''
    },
    submitting: false
  },

  observers: {
    'userData': function(userData) {
      if (userData && userData.nickName !== undefined) {
        this.setData({
          formData: {
            nickName: userData.nickName || '',
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
      this.setData({ 'formData.nickName': e.detail.value });
    },

    // 确认保存
    confirm() {
      const { nickName, avatarUrl } = this.data.formData;
      
      if (!nickName.trim()) {
        wx.showToast({ title: '请输入昵称', icon: 'none' });
        return;
      }

      this.setData({ submitting: true });
      this.triggerEvent('confirm', {
        nickName: nickName.trim(),
        avatarUrl: avatarUrl
      });
    }
  }
});