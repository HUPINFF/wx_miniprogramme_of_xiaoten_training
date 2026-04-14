// pages/coach/appointments/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentTab : 'pending',
    pendingList:[],
    approvedList:[],
    rejectedList:[],
    pendingCount:0,
    coachInfo: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadCoachInfo();
    this.loadAppointments();
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
     // 【新增】每次显示页面时刷新预约列表
     if (this.data.coachInfo) {
      this.loadAppointments();
    }
  },

  // 根据openid获取教练信息
  loadCoachInfo() {
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();
    
    db.collection('users').where({
      _openid: openid,
      role: 'coach'
    }).get().then(res => {
      if (res.data.length > 0) {
        const coachInfo = res.data[0];
        this.setData({ coachInfo });
        wx.setStorageSync('coachInfo', coachInfo);
        this.loadAppointments();
      } else {
        console.error('未找到教练信息');
        wx.showToast({ title: '请先登录', icon: 'none' });
      }
    }).catch(err => {
      console.error('获取教练信息失败', err);
    });
  },

  // 加载预约列表
  loadAppointments() {
    const coachInfo = wx.getStorageSync('coachInfo')
    console.log('-==-=-=-=-=',coachInfo);
    const coachId = coachInfo._id
    console.log('-----------',coachId);
    if(!coachId) {
      console.error('未获取到教练信息');
      return;
    }
 
    const db = wx.cloud.database();  
    db.collection('appointments').where({
      coachId:coachId
    }).orderBy('date','desc').get().then(res => {
      this.processAppointments(res.data);
    }).catch(err => {
      console.error('加载预约失败', err);
    });
  },

   // 处理预约数据
   processAppointments(appointments) {
    const pendingList = [];
    const approvedList = [];
    const rejectedList = [];

    appointments.forEach(item => {
      switch (item.status) {
        case 'pending':
          pendingList.push(item);
          break;
        case 'approved':
          approvedList.push(item);
          break;
        case 'rejected':
          rejectedList.push(item);
          break;  
      }
    });
    this.setData({
      pendingList,
      approvedList,
      rejectedList,
      pendingCount: pendingList.length
    });
   },

    // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  // 同意预约
  approveAppointment(e) {
    const id = e.currentTarget.dataset.id;
    const appointment = this.data.pendingList.find(item => item._id === id);

    if(!appointment) return;

    wx.showModal({
      title: '确认同意',
      content: `确定同意${appointment.childName}的预约吗？`,
      success:(res) => {
        if(res.confirm) {
          this.doApprove(id,appointment);
        }
      }
    });
  },

  // 执行同意
  doApprove(id,appointment) {
    wx.showLoading({title: '处理中...'});

    const db = wx.cloud.database();

    // 更新预约状态
    db.collection('appointments').doc(id).update({
      data:{
        status:'approved',
        updatedAt: new Date()
      }
    }).then( async () => {
      wx.hideLoading();
      wx.showToast({ title: '已同意', icon: 'success' });
      
      // 【新增】创建训练记录
      await this.createTrainingRecord(appointment);

       // 【新增】发送审批通过通知给家长
       this.sendApprovalNotification(appointment, 'approved');
      this.loadAppointments();
    }).catch(err => {
      console.error('同意失败', err);
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },  

  // 拒绝预约
  rejectAppointment(e) {
    const id = e.currentTarget.dataset.id;
    console.log(id);
    const appointment = this.data.pendingList.find(item => item._id === id);

    if(!appointment) return;

    wx.showModal({
      title:'确认拒绝',
      content:`确定拒绝${appointment.childName}的预约吗？`,
      success: (res) => {
        if(res.confirm) {
          const db = wx.cloud.database();
          db.collection('appointments').doc(id).update({
            data:{
              status: 'rejected',
              remark: '教练拒绝',
              updatedAt: new Date()
            }
          }).then(() => {
            wx.showToast({ title: '已拒绝', icon: 'success' });
             // 【新增】发送拒绝通知给家长
            this.sendApprovalNotification(appointment, 'rejected');
            this.loadAppointments();
          }).catch(err => {
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

   // 【新增】扣减学员学时
   deductChildHours(childId, trainingHours) {
    const db = wx.cloud.database();
    return db.collection('children').doc(childId).get().then(res => {
      const child = res.data;
      const currentHours = child.remainingHours || 0;
      const newHours = currentHours - trainingHours;
      
      if (newHours < 0) {
        wx.showToast({ title: '学时不足，请及时充值', icon: 'none' });
      }
      
      return db.collection('children').doc(childId).update({
        data: {
          remainingHours: newHours,
          updatedAt: new Date()
        }
      });
    });
  },

  // 【新增】创建训练记录
  async createTrainingRecord(appointment) {
    try {
      const db = wx.cloud.database();

      // 获取孩子的信息
      const childRes = await db.collection('children').doc(appointment.childId).get();
      const child = childRes.data;

      // 检查是否已存在训练记录（避免重复创建）
      const existingTraining = await db.collection('trainings').where({
        childId: appointment.childId,
        date: appointment.date,
        startTime: appointment.startTime
      }).get();

      if (existingTraining.data.length > 0) {
        console.log('训练记录已存在，跳过创建');
        return existingTraining.data[0];
      }

      // 计算时长
      // const duration = this.calculateDuration(appointment.startTime, appointment.endTime);

      // 预约时长固定为1小时
      const duration = '60分钟';
      const trainingHours = 1;  // 1小时 = 1课时

      // 构建训练数据
      const trainingData = {
        childId: appointment.childId,
        childName: appointment.childName,
        childAvatar: child.avatar || '',
        coachId: appointment.coachId,
        coachName: appointment.coachName,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        duration: duration,
        trainingHours: trainingHours,  // 【新增】记录课时
        type: appointment.courseType || '基础体能',
        name: `${appointment.courseType || '体能训练'}课`,
        focus: '',
        difficulty: '',
        trainingContent: appointment.trainingContent || '',  // 【新增】家长填写的训练内容
        status: 'scheduled',        // 已安排
        reminded: false,             // 未提醒（用于定时任务）
        photos: [],
        photoCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('trainings').add({
        data: trainingData
      });

      console.log('训练记录创建成功:', result._id);

      // 【新增】扣减学员学时（1小时 = 1课时）
      await this.deductChildHours(appointment.childId, trainingHours);

      // 更新预约记录，关联训练ID
      await db.collection('appointments').doc(appointment._id).update({
        data: {
          trainingId: result._id,
          updatedAt: new Date()
        }
      });

      return result;
    } catch (err) {
      console.error('创建训练记录失败:', err);
      return null;
    }
  },

  // 【新增】计算训练时长
  calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return '60分钟';

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const minutes = endTotal - startTotal;

    if (minutes === 60) return '60分钟';
    if (minutes === 90) return '90分钟';
    if (minutes === 120) return '120分钟';
    return `${minutes}分钟`;
  },

  async sendApprovalNotification(appointment, status) {
    const db = wx.cloud.database();
  
    try {
      // 1. 查询孩子的信息，获取家长的openid
      const childRes = await db.collection('children').doc(appointment.childId).get();
      const parentOpenId = childRes.data.parentOpenId;
      
      if (!parentOpenId) {
        console.error('未找到家长的openid');
        return;
      }
      
      // 2. 使用审批结果模板ID
      const templateId = '9Be4ZZebgGrs1qW0ZH_oz7Ua9jOUjXWtbddQo5uLKRA';
      
      // 3. 构建预约时间
      const appointmentTime = `${appointment.date} ${appointment.startTime}`;
      
      // 4. 根据状态设置预约结果
      let resultText = status === 'approved' ? '已通过' : '已拒绝';
      
      // 5. 模板数据（匹配字段：time2 和 phrase4）
      const templateData = {
        time2: { value: appointmentTime },           // 预约时间
        phrase4: { value: resultText }               // 预约结果
      };
      
      console.log('发送审批通知数据:', templateData);
      
      // 6. 发送订阅消息
      const result = await wx.cloud.callFunction({
        name: 'sendSubscribe',
        data: {
          openid: parentOpenId,
          templateId: templateId,
          page: 'pages/users/my-appointments/index',
          data: templateData
        }
      });
      
      if (result.result.success) {
        console.log('审批通知发送成功');
      } else if (result.result.error?.errCode === 43101) {
        console.log('用户未授权审批通知');
      } else {
        console.error('审批通知发送失败', result.result.error);
      }
    } catch (err) {
      console.log('发送通知失败:', err);
    }
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
    this.loadAppointments().then(() => {
      wx.stopPullDownRefresh();
    });
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