// pages/coach/post-class/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    training: {},
    childInfo: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { id, childId } = options;
    if (id) {
      this.setData({ 'training._id': id });
    }
    if (childId) {
      this.loadChildInfo(childId);
    }
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

  // 录入成绩
  gotoPerformance() {
    const { childInfo, training } = this.data;
    wx.navigateTo({
      url: `/pages/coach/performance/weekly/index?childId=${childInfo._id}&childName=${childInfo.name}&fromPostClass=true&trainingId=${training._id}`
    });
  },

  // 写反馈
  gotoFeedback() {
    const { childInfo, training } = this.data;
    wx.navigateTo({
      url: `/pages/coach/feedback/write/index?childId=${childInfo._id}&childName=${childInfo.name}&fromPostClass=true&trainingId=${training._id}`
    });
  },

  // 上传照片
  gotoUploadPhotos() {
    const { training } = this.data;
    wx.navigateTo({
      url: `/pages/coach/upload-photos/index?trainingId=${training._id}`
    });
  },

  // 上传视频
  gotoUploadVideos() {
    const { training } = this.data;
    wx.navigateTo({
      url: `/pages/coach/upload-videos/index?trainingId=${training._id}`
    });
  },

  // 体质测评
  gotoAssessment() {
    const { childInfo } = this.data;
    wx.navigateTo({
      url: `/pages/coach/assessment/edit/index?childId=${childInfo._id}&childName=${childInfo.name}`
    });
  },

  // 完成记录
  finishRecord() {
    wx.showModal({
      title: '提示',
      content: '确认完成本次课后记录？将扣除学员1课时',
      success: (res) => {
        if (res.confirm) {
          // 先扣减学时，再更新训练状态
          this.deductHours().then(() => {
            this.updateTrainingStatus('finished');
          }).catch(err => {
            console.error('扣除课时失败', err);
            wx.showToast({ title: '扣除失败', icon: 'none' });
          });
        }
      }
    });
  },

  // 扣减学员学时
  deductHours() {
    const { childInfo, training } = this.data;
    const db = wx.cloud.database();

    return db.collection('children').doc(childInfo._id).get().then(res => {
      const child = res.data;
      const currentHours = child.remainingHours || 0;
      const newHours = currentHours - 1;

      if (newHours < 0) {
        wx.showToast({ title: '学时不足，请及时充值', icon: 'none' });
      }

      return db.collection('children').doc(childInfo._id).update({
        data: {
          remainingHours: newHours,
          updatedAt: new Date()
        }
      }).then(() => {
        // 写入课时记录
        return this.addHoursRecord(childInfo._id, 'expense', 1, `训练课程: ${training.name || '训练'}扣减`);
      });
    });
  },

  // 添加课时记录
  addHoursRecord(childId, type, amount, description) {
    const db = wx.cloud.database();
    return db.collection('hoursRecords').add({
      data: {
        childId: childId,
        type: type,
        amount: amount,
        description: description,
        createdAt: new Date()
      }
    }).then(res => {
      console.log('课时记录添加成功:', res);
      return res;
    }).catch(err => {
      console.error('课时记录添加失败:', err);
      return err;
    });
  },

  // 更新训练状态
  updateTrainingStatus(status) {
    const { training } = this.data;
    if (!training._id) return;

    const db = wx.cloud.database();
    db.collection('trainings').doc(training._id).update({
      data: {
        status: status,
        updatedAt: new Date()
      }
    }).then(() => {
      // 发送通知给家长
      this.sendNotificationToParent();
    }).catch(err => {
      console.error('更新训练状态失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  // 发送训练完成通知给家长
  async sendNotificationToParent() {
    const { childInfo, training } = this.data;

    if (!childInfo.parentOpenId) {
      console.error('未找到家长的openid');
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack({ delta: 2 });
      }, 1500);
      return;
    }

    try {
      // 训练完成通知模板ID（需要在微信公众平台配置）
      const templateId = 'e1sXPzlqTt8wP7sskewLntcKdhzfX8EBej3utxSp8W0';

      // 构建消息内容
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const templateData = {
        thing2: { value: childInfo.name },
        thing8: { value: "扣除一课时" },
        time3: { value: timeStr },
        thing1: { value: '腾鑫体育' }
      };

      console.log('发送训练完成通知:', templateData);

      // 发送订阅消息
      const result = await wx.cloud.callFunction({
        name: 'sendSubscribe',
        data: {
          openid: childInfo.parentOpenId,
          templateId: templateId,
          page: 'pages/users/children/index',
          data: templateData
        }
      });

      if (result.result.success) {
        console.log('训练完成通知发送成功');
        wx.showToast({ title: '已通知家长', icon: 'success' });
      } else if (result.result.error?.errCode === 43101) {
        console.log('用户未授权通知');
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        console.error('训练完成通知发送失败', result.result.error);
        wx.showToast({ title: '已保存', icon: 'success' });
      }
    } catch (err) {
      console.error('发送通知失败:', err);
      wx.showToast({ title: '已保存', icon: 'success' });
    }

    setTimeout(() => {
      wx.navigateBack({ delta: 2 });
    }, 1500);
  }
})