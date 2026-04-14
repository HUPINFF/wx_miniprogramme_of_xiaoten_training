// components/coach-card/index.js
Component({
  properties: {
    // 教练信息
    coachInfo: {
      type: Object,
      value: {
        name: '',
        bio: '',
        avatarUrl: ''
      }
    },
    // 是否可编辑
    editable: {
      type: Boolean,
      value: true
    }
  },

  data: {
    isEditing: false,      // 是否编辑模式
    editName: '',
    editBio: '',
    editAvatarUrl: '',
    loading: false
  },

  methods: {
    // 进入编辑模式
    startEdit() {
      if (!this.properties.editable) return;
      
      this.setData({
        isEditing: true,
        editName: this.properties.coachInfo.name || '',
        editBio: this.properties.coachInfo.bio || '',
        editAvatarUrl: this.properties.coachInfo.avatarUrl || ''
      });
    },

    // 取消编辑
    cancelEdit() {
      this.setData({ isEditing: false });
    },

    // 输入姓名
    onNameInput(e) {
      this.setData({ editName: e.detail.value });
    },

    // 输入简介
    onBioInput(e) {
      this.setData({ editBio: e.detail.value });
    },

    // 选择头像
    chooseAvatar() {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFilePaths[0];
          this.uploadAvatar(tempFilePath);
        }
      });
    },

    // 上传头像
    uploadAvatar(filePath) {
      wx.showLoading({ title: '上传中...' });
      
      const cloudPath = `coach_avatars/${Date.now()}.png`;
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (res) => {
          console.log('上传成功，fileID:', res.fileID);  // 打印 fileID
          this.setData({ editAvatarUrl: res.fileID });
          wx.hideLoading();
          wx.showToast({ title: '上传成功', icon: 'success' });
        },
        fail: (err) => {
          console.error('上传失败', err);
          wx.hideLoading();
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      });
    },

    // 保存编辑
    async saveEdit() {
      const { editName, editBio, editAvatarUrl } = this.data;
      
      if (!editName.trim()) {
        wx.showToast({ title: '请填写姓名', icon: 'none' });
        return;
      }

      this.setData({ loading: true });
      wx.showLoading({ title: '保存中...' });

      const db = wx.cloud.database();
      const coachId = this.properties.coachInfo._id;

      const updateData = {
        name: editName.trim(),
        bio: editBio.trim(),
        updatedAt: new Date()
      };
      
      if (editAvatarUrl) {
        updateData.avatarUrl = editAvatarUrl;
      }

      try {
        await db.collection('users').doc(coachId).update({ data: updateData });
        
        // 更新本地缓存
        const updatedCoach = { ...this.properties.coachInfo, ...updateData };
        wx.setStorageSync('coachInfo', updatedCoach);
        
        // 触发父组件更新
        this.triggerEvent('update', { coachInfo: updatedCoach });
        
        wx.hideLoading();
        wx.showToast({ title: '保存成功', icon: 'success' });
        
        // 退出编辑模式
        this.setData({ isEditing: false });
      } catch (err) {
        console.error('保存失败', err);
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      } finally {
        this.setData({ loading: false });
      }
    }
  }
});