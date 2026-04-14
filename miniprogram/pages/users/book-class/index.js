// pages/users/book-class/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 孩子相关
    children: [],
    selectedChild: {},
    associatedCoach: null,  // 【新增】孩子关联的教练

    // 预约数据
    selectedDate: '2026-04-05',
    minDate: '',
    maxDate: '',
    courseTypes: ['基础体能', '速度训练', '耐力训练', '协调训练', '力量训练', '柔韧训练'],
    selectedCourseType: '',
    timeSlots: ['09:00-10:00', '10:00-11:00', '14:00-15:00', '15:00-16:00', '16:00-17:00'],
    selectedTimeSlot: '',

    // 训练内容
    trainingContent: '',
    // 状态
    submitting: false,
    loading: true
  },


  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 设置日期范围
    this.setDateRange();
    // 设置默认日期为今天
    this.setDefaultDate();
    // 加载孩子列表
    this.loadChildren();
  },

  // 设置日期范围
  setDateRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // 最小日期：今天
    const minDate = `${year}-${month}-${day}`;

    // 最大日期:30天后
    const maxDateObj = new Date();
    maxDateObj.setDate(maxDateObj.getDate() + 30);
    const maxYear = maxDateObj.getFullYear();
    const maxMonth = String(maxDateObj.getMonth() + 1).padStart(2, '0');
    const maxDay = String(maxDateObj.getDate()).padStart(2, '0');
    const maxDate = `${maxYear}-${maxMonth}-${maxDay}`;

    this.setData({
      minDate: minDate,
      maxDate: maxDate
    });
  },

  // 设置默认日期为今天
  setDefaultDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    this.setData({
      selectedDate: `${year}-${month}-${day}`
    });
  },

  // 加载孩子列表
  loadChildren() {
    this.setData({ loading: true });
    
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();

    db.collection('children').where({
      parentOpenId: openid
    }).get().then(res => {
      const children = res.data;
      this.setData({ children: children });

      if (children.length > 0) {
        const selectedChild = children[0];
        this.setData({ selectedChild: selectedChild });
        // 加载孩子关联的教练
        this.loadAssociatedCoach(selectedChild.coachId);
      } else {
        this.setData({ loading: false });
      }
    }).catch(err => {
      console.error('加载孩子失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载孩子信息失败', icon: 'none' });
    });
  },

  // 【新增】加载孩子关联的教练
  loadAssociatedCoach(coachId) {
    if (!coachId) {
      console.error('孩子未关联教练');
      this.setData({ 
        associatedCoach: null,
        loading: false 
      });
      wx.showToast({ title: '孩子暂未分配教练，请联系客服', icon: 'none' });
      return;
    }

    const db = wx.cloud.database();
    
    // 从 coaches 集合查询教练信息
    db.collection('users').doc(coachId).get().then(res => {
      this.setData({ 
        associatedCoach: res.data,
        loading: false 
      });
    }).catch(err => {
      console.error('加载教练信息失败', err);
      // 尝试从 users 集合查询
      db.collection('users').where({
        _id: coachId,
        role: 'coach'
      }).get().then(userRes => {
        if (userRes.data.length > 0) {
          this.setData({ 
            associatedCoach: userRes.data[0],
            loading: false 
          });
        } else {
          this.setData({ 
            associatedCoach: null,
            loading: false 
          });
          wx.showToast({ title: '未找到教练信息', icon: 'none' });
        }
      }).catch(err2 => {
        console.error('从users查询教练失败', err2);
        this.setData({ 
          associatedCoach: null,
          loading: false 
        });
      });
    });
  },

  // 切换孩子
  onChildChange(e) {
    const index = e.detail.value;
    const selectedChild = this.data.children[index];
    this.setData({ selectedChild: selectedChild });
    // 切换孩子时重新加载关联的教练
    this.loadAssociatedCoach(selectedChild.coachId);
    // 清空已选时间段
    this.setData({ selectedTimeSlot: '' });
  },

  // 选择日期
  onDateChange(e) {
    const selectedDate = e.detail.value;
    if (!selectedDate) {
      console.log('selectedDate 为空');
      return;
    }
    const today = this.getTodayString();
    if (selectedDate < today) {
      wx.showToast({ title: '不能选择过去的日期', icon: 'none' });
      return;
    }
    this.setData({ selectedDate });
  },

  // 获取今天的日期字符串
  getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 选择训练类型
  onCourseTypeChange(e) {
    const index = e.detail.value;
    this.setData({ selectedCourseType: this.data.courseTypes[index] });
  },

  // 选择时间段
  onTimeChange(e) {
    const index = e.detail.value;
    this.setData({ selectedTimeSlot: this.data.timeSlots[index] });
  },

// pages/users/book-class/index.js
handleSubmit() {
  if (!this.validateForm()) {
    return;
  }

  // const bookTemplateId = 'lDX7gYzMwfCKXY3miw8MI7-W5pbNeOZ6JOFRSOmRaN0';
  const approveTemplateId = '9Be4ZZebgGrs1qW0ZH_oz7Ua9jOUjXWtbddQo5uLKRA';
  // const reminderTemplateId = 'QwUWqkFpZ6hYjH7tT52eTMs-koscqMvlgael3ZDIFBw'

  wx.requestSubscribeMessage({
    tmplIds: [approveTemplateId],
    success: (res) => {
      console.log('授权结果:', res);
      // console.log('-----------',res[reminderTemplateId] === 'accept');
      const approveAccepted = res[approveTemplateId] === 'accept';
      console.log(approveAccepted);
      if (!approveAccepted) {
        // 第二个模板未授权，引导去设置
        wx.showModal({
          title: '开启通知',
          content: '您未授权"预约结果提醒"通知。请前往设置页面手动开启，以便及时收到教练审批结果。',
          confirmText: '去设置',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.openSetting({
                success: () => {
                  // 设置完成后可以重新提交或直接提交
                  this.doSubmit();
                }
              });
            } else {
              this.doSubmit();
            }
          }
        });
      } else {
        this.doSubmit();
      }
      console.log(approveAccepted);
    },
    fail: (err) => {
      console.error('订阅消息请求失败', err);
      this.doSubmit();
    }
  });
},

// 【新增】输入训练内容
onTrainingContentInput(e) {
  this.setData({ trainingContent: e.detail.value });
},

  // 表单验证
  validateForm() {
    if (!this.data.selectedChild._id) {
      wx.showToast({ title: '请选择孩子', icon: 'none' });
      return false;
    }

    if (!this.data.associatedCoach) {
      wx.showToast({ title: '孩子未关联教练，无法预约', icon: 'none' });
      return false;
    }

    if (!this.data.selectedDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return false;
    }

    if (!this.data.selectedTimeSlot) {
      wx.showToast({ title: '请选择时间段', icon: 'none' });
      return false;
    }

    if (!this.data.selectedCourseType) {
      wx.showToast({ title: '请选择训练类型', icon: 'none' });
      return false;
    }

    return true;
  },


  // 提交预约
  doSubmit() {
    // 验证孩子
    if (!this.data.selectedChild._id) {
      wx.showToast({ title: '请选择孩子', icon: 'none' });
      return;
    }

    // 验证教练
    if (!this.data.associatedCoach) {
      wx.showToast({ title: '孩子未关联教练，无法预约', icon: 'none' });
      return;
    }

    // 验证日期
    if (!this.data.selectedDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }

    // 验证时间段
    if (!this.data.selectedTimeSlot) {
      wx.showToast({ title: '请选择时间段', icon: 'none' });
      return;
    }

    // 验证训练类型
    if (!this.data.selectedCourseType) {
      wx.showToast({ title: '请选择训练类型', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    const db = wx.cloud.database();
    const openid = wx.getStorageSync('openid');

    // 拆分时间段
    const [startTime, endTime] = this.data.selectedTimeSlot.split('-');

    // 构建预约数据
    const appointmentsData = {
      childId: this.data.selectedChild._id,
      childName: this.data.selectedChild.name,
      coachId: this.data.associatedCoach._id,
      coachName: this.data.associatedCoach.name,
      date: this.data.selectedDate,
      startTime: startTime,
      endTime: endTime,
      status: 'pending',
      courseType: this.data.selectedCourseType,
      trainingContent: this.data.trainingContent || '',  // 【新增】训练内容
      remark: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('提交预约数据:', appointmentsData);

    // 检查是否已存在相同时间段的预约
    db.collection('appointments').where({
      childId: this.data.selectedChild._id,
      date: this.data.selectedDate,
      startTime: startTime,
      status: db.command.in(['pending', 'approved'])
    }).get().then(res => {
      if (res.data.length > 0) {
        wx.showToast({ title: '该时间段已有预约', icon: 'none' });
        this.setData({ submitting: false });
        return Promise.reject('已存在预约');
      }
      return db.collection('appointments').add({ data: appointmentsData });
    }).then((res) => {
      wx.showToast({
        title: '预约成功，等待教练确认',
        icon: "success"
      });

      // 【新增】预约成功后发送订阅消息
      this.sendNotification(res._id);
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }).catch(err => {
      if (err !== '已存在预约') {
        console.error('预约失败', err);
        wx.showToast({
          title: '预约失败',
          icon: "none"
        });
      }
    }).finally(() => {
      this.setData({ submitting: false });
    });
  },

  // 【新增】发送预约成功通知
  async sendNotification(appointmentId) {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      console.error('未获取到openid');
      return;
    }

    const { selectedChild, selectedDate, selectedTimeSlot, selectedCourseType } = this.data;
    const [startTime] = selectedTimeSlot.split('-');
    
    // 模板ID（替换为你在微信公众平台申请的）
    const templateId = 'lDX7gYzMwfCKXY3miw8MI7-W5pbNeOZ6JOFRSOmRaN0';  // TODO: 替换为实际的模板ID
    
    // 模板数据（根据你申请的模板字段调整）
    // 常见模板字段类型：thing、date、time、number、amount、phone、car、name
    const templateData = {
      // thing1: { value: selectedCourseType || '体能训练' },  // 课程名称
      // date2: { value: selectedDate },                       // 预约日期
      time1: { value: startTime },                          // 预约时间
      // thing4: { value: selectedChild.name },                // 学员姓名
      // thing5: { value: '请等待教练确认' }                    // 温馨提示
      thing3:{value:'腾鑫体育'}
    };
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'sendSubscribe',
        data: {
          openid: openid,
          templateId: templateId,
          page: 'pages/users/my-appointments/index',
          data: templateData
        }
      });
      
      if (result.result.success) {
        console.log('订阅消息发送成功');
      } else {
        console.error('订阅消息发送失败', result.result.error);
      }
    } catch (err) {
      console.error('调用云函数失败', err);
    }
    // 【新增】预约成功后，询问是否开启上课提醒
    this.requestReminderAuth();
  },

  // 新增，请求上课提醒授权
  requestReminderAuth() {
    const reminderTemplateId  = 'QwUWqkFpZ6hYjH7tT52eTMs-koscqMvlgael3ZDIFBw';

    wx.showModal({
      title: '开启上课提醒',
      content: '开启后，我们会在上课前1小时提醒您，避免错过课程',
      confirmText: '开启提醒',
      cancelText: '暂不',
      success: (modalRes) => {
        if(modalRes.confirm) {
          wx.requestSubscribeMessage({
            tmplIds: [reminderTemplateId],
            success:(res) => {
              console.log(res[reminderTemplateId]);
              if(res[reminderTemplateId] === 'accept') {
                wx.showToast({ title: '已开启上课提醒', icon: 'success' });
                 // 可以保存授权状态到数据库
                this.saveReminderAuthStatus(true);
              }else {
                wx.showToast({ title: '您拒绝了提醒', icon: 'none' });
                this.saveReminderAuthStatus(false);
              }
            },
            fail:(err) => {
              console.error('订阅失败', err);
              wx.showToast({ title: '授权失败', icon: 'none' });
            }
          })
        }else {
          console.log('用户暂不开启上课提醒');
        }
      }
    })
  },



  /**
   * 生命周期函数--监听页面初次渲染完成
   */// 【可选】保存用户授权状态到数据库
saveReminderAuthStatus(accepted) {
  const openid = wx.getStorageSync('openid');
  const db = wx.cloud.database();
  
  db.collection('users').where({
    _openid: openid
  }).get().then(res => {
    if (res.data.length > 0) {
      db.collection('users').doc(res.data[0]._id).update({
        data: {
          reminderEnabled: accepted,
          updatedAt: new Date()
        }
      });
    }
  });
},


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