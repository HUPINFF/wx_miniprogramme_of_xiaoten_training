// pages/users/hours-detail/index.js
const app = getApp();

Page({
  data: {
    childInfo: {},
    currentTab: 'month', // month 或 year
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    pickerValue: '', // picker 组件的 value
    summary: {
      income: 0,
      expense: 0,
      remainingHours: 0  // 当前剩余课时
    },
    records: [],
    groupedRecords: []
  },

  onLoad(options) {
    const childId = options.childId;
    const childName = options.childName;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // 初始化 pickerValue
    this.setData({
      pickerValue: `${year}-${month}`,
      childName: childName || ''
    });

    if (childId) {
      this.loadData(childId);
    }
  },

  // 并行加载数据
  loadData(childId) {
    Promise.all([
      this.loadChildInfo(childId),
      this.loadHoursRecords(childId)
    ]).then(([childData, records]) => {
      this.processRecords(records, childData.remainingHours || 0);
    });
  },

  // 加载孩子信息
  loadChildInfo(childId) {
    const db = wx.cloud.database();
    return db.collection('children').doc(childId).get().then(res => {
      this.setData({ childInfo: res.data });
      return res.data;
    }).catch(err => {
      console.error('加载孩子信息失败', err);
      return {};
    });
  },

  // 加载课时记录
  loadHoursRecords(childId) {
    const db = wx.cloud.database();
    const now = new Date();
    let startDate, endDate;

    if (this.data.currentTab === 'month') {
      startDate = new Date(this.data.currentYear, this.data.currentMonth - 1, 1);
      endDate = new Date(this.data.currentYear, this.data.currentMonth, 1);
    } else {
      startDate = new Date(this.data.currentYear, 0, 1);
      endDate = new Date(this.data.currentYear + 1, 0, 1);
    }

    return db.collection('hoursRecords')
      .where({
        childId: childId,
        createdAt: db.command.gte(startDate).and(db.command.lt(endDate))
      })
      .orderBy('createdAt', 'desc')
      .get().then(res => {
        return res.data;
      }).catch(err => {
        console.error('加载课时记录失败', err);
        return [];
      });
  },

  // 处理记录数据
  processRecords(records, remainingHours) {
    let income = 0;
    let expense = 0;

    records.forEach(record => {
      record.amount = parseFloat(record.amount) || 0;
      record.createdAt = new Date(record.createdAt);
      // 提前格式化日期时间
      record.formattedDate = this.formatDate(record.createdAt);
      record.formattedTime = this.formatTime(record.createdAt);
      record.weekday = this.getWeekday(record.createdAt);
      record.icon = this.getRecordIcon(record.type);
      record.typeName = this.getRecordTypeName(record.type);

      if (record.type === 'income') {
        income += record.amount;
      } else if (record.type === 'expense') {
        expense += record.amount;
      }
    });

    // 按日期分组
    const grouped = {};
    records.forEach(record => {
      const dateKey = record.formattedDate;
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: record.createdAt,
          formattedDate: record.formattedDate,
          weekday: record.weekday,
          records: [],
          dayIncome: 0,
          dayExpense: 0
        };
      }
      grouped[dateKey].records.push(record);
      if (record.type === 'income') {
        grouped[dateKey].dayIncome += record.amount;
      } else {
        grouped[dateKey].dayExpense += record.amount;
      }
    });

    const groupedRecords = Object.values(grouped).sort((a, b) => b.date - a.date);

    this.setData({
      records,
      groupedRecords,
      summary: {
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        remainingHours: remainingHours.toFixed(2)
      }
    });
  },

  // 格式化时间
  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取星期几
  getWeekday(date) {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekdays[date.getDay()];
  },

  // 切换月度/年度
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    // 重新加载数据
    const childId = this.data.childInfo._id;
    if (childId) {
      this.loadData(childId);
    }
  },

  // 日期选择器变化
  onPickerChange(e) {
    const value = e.detail.value;
    const parts = value.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);

    this.setData({
      currentYear: year,
      currentMonth: month,
      pickerValue: value
    });

    // 重新加载数据
    const childId = this.data.childInfo._id;
    if (childId) {
      this.loadData(childId);
    }
  },

  getYears() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }
    return years;
  },

  getDateOptions() {
    const options = [];
    const years = this.getYears();

    if (this.data.currentTab === 'month') {
      const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      years.forEach(year => {
        months.forEach(month => {
          options.push(`${year}年${month}`);
        });
      });
    } else {
      years.forEach(year => {
        options.push(`${year}年`);
      });
    }

    return options;
  },

  // 获取记录类型图标
  getRecordIcon(type) {
    const icons = {
      'income': '💰',
      'expense': '📚',
      'recharge': '💳',
      'deduct': '➖'
    };
    return icons[type] || '📝';
  },

  // 获取记录类型名称
  getRecordTypeName(type) {
    const names = {
      'income': '充值',
      'expense': '消费',
      'recharge': '充值',
      'deduct': '扣减'
    };
    return names[type] || '其他';
  }
});
