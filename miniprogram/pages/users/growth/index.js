const app = getApp();

Page({
  data: {
    childInfo: null,
    currentChildId: '',
    currentTab: 'week',
    sportsItems: [
      { key: 'fiftyMeter', name: '50米', unit: '秒', yMin: 5, yMax: 20 },
      { key: 'eightHundredMeter', name: '800米', unit: '分', yMin: 2.5, yMax: 3.5 },
      { key: 'thousandMeter', name: '1000米', unit: '秒', yMin: 120, yMax: 400 },
      { key: 'standingLongJump', name: '立定跳远', unit: '米', yMin: 1, yMax: 3 },
      { key: 'sitUp', name: '仰卧起坐', unit: '个', yMin: 0, yMax: 100 },
      { key: 'sitAndReach', name: '坐位体前屈', unit: '厘米', yMin: 0, yMax: 50 },
      { key: 'ropeSkipping', name: '跳绳', unit: '个', yMin: 50, yMax: 250 },
      { key: 'agility', name: '敏捷', unit: '分', yMin: 0, yMax: 100 },
      { key: 'coordination', name: '协调', unit: '分', yMin: 0, yMax: 100 },
      { key: 'vitalCapacity', name: '肺活量', unit: 'ml', yMin: 1000, yMax: 6000 }
    ],
    selectedSport: 'fiftyMeter',
    chartData: [],
    hasData: false,
    chartWidth: 350,
    timelineData: [],
    timelineLoading: true,
    weekOptions: [],
    compareWeek1: null,
    compareWeek1Index: 0,
    canGenerateCompare: false,
    showCompareChart: false,
    compareWeeks: [],
    allPerformanceData: [],
    compareSport: null,
    compareSportIndex: 0
  },

  onLoad: function (options) {
    this.loadChildData();
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }
  },

  loadChildData: function () {
    var that = this;
    var openid = wx.getStorageSync('openid');

    if (!openid) {
      console.error('用户未登录');
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.cloud.database().collection('children').where({
      parentOpenId: openid
    }).get({
      success: function (res) {
        var children = res.data;
        if (children.length === 0) {
          wx.showToast({ title: '未找到孩子信息', icon: 'none' });
          return;
        }

        var childInfo = children[0];
        that.setData({
          childInfo: childInfo,
          currentChildId: childInfo._id
        });

        that.loadPerformanceData();
        that.loadTimelineData();
      },
      fail: function (err) {
        console.error('加载孩子数据失败', err);
      }
    });
  },

  loadPerformanceData: function () {
    var that = this;
    if (!this.data.currentChildId) {
      return;
    }

    wx.showLoading({ title: '加载中' });

    var collection, fieldName;
    if (this.data.currentTab === 'week') {
      collection = 'performance';
      fieldName = 'weekDate';
    } else {
      collection = 'monthly_performance';
      fieldName = 'month';
    }

    wx.cloud.database().collection(collection)
      .where({ childId: this.data.currentChildId })
      .orderBy(fieldName, 'asc')
      .limit(20)
      .get({
        success: function (res) {
          if (res.data && res.data.length > 0) {
            that.setData({ allPerformanceData: res.data });
            that.generateWeekOptions(res.data);
            that.processChartData(res.data);
          } else {
            that.setData({ hasData: false });
          }
          wx.hideLoading();
        },
        fail: function (err) {
          console.error('加载表现数据失败', err);
          that.setData({ hasData: false });
          wx.hideLoading();
        }
      });
  },

  generateWeekOptions: function (data) {
    var that = this;
    var weekOptions = [];
    data.forEach(function (item, index) {
      var dateStr = '';
      if (item.weekDate) {
        var date = new Date(item.weekDate);
        dateStr = (date.getMonth() + 1) + '/' + date.getDate();
      } else if (item.month) {
        dateStr = item.month;
      }
      weekOptions.push({
        index: index,
        label: '第' + (index + 1) + '周 (' + dateStr + ')',
        dataIndex: index
      });
    });

    var compareWeek1 = weekOptions.length > 0 ? weekOptions[0] : null;
    var canGenerateCompare = weekOptions.length > 1;

    this.setData({
      weekOptions: weekOptions,
      compareWeek1: compareWeek1,
      compareWeek1Index: 0,
      canGenerateCompare: canGenerateCompare
    });
  },

  processChartData: function (data) {
    var that = this;
    var padding = { top: 30, right: 25, bottom: 40, left: 60 };
    var sport = this.data.sportsItems.find(function (item) {
      return item.key === that.data.selectedSport;
    });

    if (!sport) {
      return;
    }

    var currentYear = new Date().getFullYear();
    var chartData = [];
    data.forEach(function (item) {
      var value = item[sport.key];

      if (Array.isArray(value)) {
        value = value.find(function (v) {
          return v !== undefined && v !== null && v !== '';
        });
      }

      if (value === undefined || value === null || value === '') {
        return;
      }

      // 只保留当前年份的数据
      if (that.data.currentTab === 'week') {
        var weekDate = item.weekDate || item.updatedAt;
        if (weekDate) {
          var date = new Date(weekDate);
          var itemYear = date.getFullYear();
          if (itemYear !== currentYear) {
            return;
          }
        }
      } else {
        var itemYear = item.year || new Date().getFullYear();
        if (itemYear !== currentYear) {
          return;
        }
      }

      var parsedValue = that.parseValue(value, sport.key);
      if (parsedValue === null) {
        return;
      }

      var displayValue = that.formatValue(parsedValue, sport.key);
      var label = '';
      if (that.data.currentTab === 'week') {
        var weekDate = item.weekDate || item.updatedAt;
        if (weekDate) {
          var date = new Date(weekDate);
          label = (date.getMonth() + 1) + '/' + date.getDate();
        }
      } else {
        label = (item.year || new Date().getFullYear()) + '/' + item.month;
      }

      chartData.push({
        value: parsedValue,
        displayValue: displayValue,
        label: label
      });
    });

    if (chartData.length > 0) {
      chartData.reverse();
      var minWidth = 350;
      var perPointWidth = 60;
      var chartWidth = Math.max(minWidth, padding.left + chartData.length * perPointWidth + padding.right);
      this.setData({ chartData: chartData, hasData: true, chartWidth: chartWidth });
      this.drawChart(sport, chartData, chartWidth);
    } else {
      this.setData({ hasData: false });
    }
  },

  parseValue: function (value, sportKey) {
    if (typeof value === 'number') {
      if (sportKey === 'standingLongJump') {
        return value / 100;
      }
      return value;
    }

    if (typeof value === 'string') {
      if (sportKey === 'eightHundredMeter') {
        if (value.includes('分')) {
          var parts = value.split('分');
          var minutes = parseFloat(parts[0]) || 0;
          var seconds = 0;
          if (parts[1]) {
            var secMatch = parts[1].match(/(\d+)/);
            seconds = secMatch ? parseFloat(secMatch[1]) : 0;
          }
          return minutes + seconds / 60;
        }
      }

      if (sportKey === 'thousandMeter') {
        if (value.includes('分')) {
          var parts = value.split('分');
          var minutes = parseFloat(parts[0]) || 0;
          var seconds = 0;
          if (parts[1]) {
            var secMatch = parts[1].match(/(\d+)/);
            seconds = secMatch ? parseFloat(secMatch[1]) : 0;
          }
          return minutes * 60 + seconds;
        }
      }

      var match = value.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        var numValue = parseFloat(match[0]);
        if (sportKey === 'standingLongJump') {
          return numValue / 100;
        }
        return numValue;
      }
      return null;
    }

    return null;
  },

  drawChart: function (sport, data, chartWidth) {
    var ctx = wx.createCanvasContext('lineChart');
    var width = chartWidth || 350;
    var height = 220;
    var padding = { top: 30, right: 25, bottom: 40, left: 60 };

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, width, height);

    ctx.setStrokeStyle('#eeeeee');
    ctx.setLineWidth(1);
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (i * (height - padding.top - padding.bottom)) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    var yMin = sport.yMin;
    var yMax = sport.yMax;
    var step = (yMax - yMin) / 4;
    var chartHeight = height - padding.top - padding.bottom;
    var isTimeBased = ['fiftyMeter', 'hundredMeter', 'eightHundredMeter', 'thousandMeter'].indexOf(sport.key) !== -1;

    ctx.setFillStyle('#999999');
    ctx.setFontSize(10);
    ctx.setTextAlign('right');
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (i * chartHeight) / 4;
      var value;
      if (isTimeBased) {
        value = yMin + i * step;
      } else {
        value = yMax - i * step;
      }
      var label = this.formatValue(value, sport.key);
      ctx.fillText(label, padding.left - 8, y + 4);
    }

    ctx.setTextAlign('center');
    var xStep = (width - padding.left - padding.right) / Math.max(data.length - 1, 1);
    for (var i = 0; i < data.length; i++) {
      var x = padding.left + i * xStep;
      ctx.fillText(data[i].label, x, height - 15);
    }

    ctx.setStrokeStyle('#07c160');
    ctx.setLineWidth(2);
    ctx.beginPath();
    var chartHeight = height - padding.top - padding.bottom;
    var isTimeBased = ['fiftyMeter', 'hundredMeter', 'eightHundredMeter', 'thousandMeter'].indexOf(sport.key) !== -1;

    for (var i = 0; i < data.length; i++) {
      var x = padding.left + i * xStep;
      var value = data[i].value;
      if (value < yMin) value = yMin;
      if (value > yMax) value = yMax;

      var y;
      if (isTimeBased) {
        y = padding.top + ((value - yMin) / (yMax - yMin)) * chartHeight;
      } else {
        y = padding.top + ((yMax - value) / (yMax - yMin)) * chartHeight;
      }

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.setFillStyle('#07c160');
    for (var i = 0; i < data.length; i++) {
      var x = padding.left + i * xStep;
      var value = data[i].value;
      if (value < yMin) value = yMin;
      if (value > yMax) value = yMax;

      var y;
      if (isTimeBased) {
        y = padding.top + ((value - yMin) / (yMax - yMin)) * chartHeight;
      } else {
        y = padding.top + ((yMax - value) / (yMax - yMin)) * chartHeight;
      }

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.setFillStyle('#ffffff');
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.setFillStyle('#333333');
      ctx.setFontSize(10);
      ctx.setTextAlign('center');
      ctx.fillText(data[i].displayValue, x, y - 12);
    }

    ctx.draw();
  },

  formatValue: function (value, sportKey) {
    if (sportKey === 'eightHundredMeter') {
      var minutes = Math.floor(value);
      var seconds = Math.round((value - minutes) * 60);
      return minutes + '\'' + seconds + '"';
    }

    if (sportKey === 'thousandMeter') {
      var minutes = Math.floor(value / 60);
      var seconds = Math.round(value % 60);
      return minutes + '\'' + seconds + '"';
    }

    var sport = this.data.sportsItems.find(function (item) {
      return item.key === sportKey;
    });
    return value.toFixed(1) + (sport ? sport.unit : '');
  },

  getSportName: function (sportKey) {
    var sport = this.data.sportsItems.find(function (item) {
      return item.key === sportKey;
    });
    return sport ? sport.name : '';
  },

  switchSport: function (e) {
    var key = e.currentTarget.dataset.key;
    this.setData({ selectedSport: key });
    this.loadPerformanceData();
  },

  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadPerformanceData();
  },

  loadTimelineData: function () {
    var that = this;
    if (!this.data.currentChildId) {
      return;
    }

    this.setData({ timelineLoading: true });

    wx.cloud.database().collection('photosAvideos')
      .where({ childId: this.data.currentChildId })
      .orderBy('yearMonth', 'desc')
      .limit(12)
      .get({
        success: function (res) {
          var timelineData = res.data || [];

          timelineData.forEach(function (item) {
            if (item.yearMonth) {
              var yearMonth = item.yearMonth;
              if (yearMonth.includes('-')) {
                var parts = yearMonth.split('-');
                item.yearMonth = parts[0] + '年' + parts[1] + '月';
              }
            }
          });

          that.setData({
            timelineData: timelineData,
            timelineLoading: false
          });
        },
        fail: function (err) {
          console.error('加载时间轴数据失败', err);
          that.setData({
            timelineData: [],
            timelineLoading: false
          });
        }
      });
  },

  previewPhoto: function (e) {
    var photos = e.currentTarget.dataset.photos;
    var index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: photos[index],
      urls: photos
    });
  },

  playVideo: function (e) {
    var url = e.currentTarget.dataset.url;
    wx.previewMedia({
      sources: [{ url: url, type: 'video' }],
      current: 0,
      showmenu: true
    });
  },

  selectCompareSport: function (e) {
    var index = e.detail.value;
    var sportsItems = this.data.sportsItems;
    if (sportsItems[index]) {
      this.setData({
        compareSport: sportsItems[index],
        compareSportIndex: index
      });
    }
  },

  selectCompareWeek1: function (e) {
    var index = e.detail.value;
    var weekOptions = this.data.weekOptions;
    if (weekOptions[index]) {
      this.setData({
        compareWeek1: weekOptions[index],
        compareWeek1Index: index
      });
    }
  },

  generateComparePoster: function () {
    var that = this;
    var compareSport = this.data.compareSport;
    var compareWeek1 = this.data.compareWeek1;

    if (!compareSport) {
      wx.showToast({ title: '请选择对比项目', icon: 'none' });
      return;
    }

    if (!compareWeek1) {
      wx.showToast({ title: '请选择要对比的周', icon: 'none' });
      return;
    }

    var allData = this.data.allPerformanceData;
    if (allData.length < 2) {
      wx.showToast({ title: '数据不足', icon: 'none' });
      return;
    }

    var week1Data = allData[compareWeek1.dataIndex];
    var week2Data = allData[allData.length - 1];

    if (!week1Data || !week2Data) {
      wx.showToast({ title: '数据不足', icon: 'none' });
      return;
    }

    var dataPoints = [week1Data, week2Data];
    var weekLabels = [compareWeek1.label, '最近1周'];

    this.setData({
      compareWeeks: weekLabels,
      showCompareChart: true
    });

    setTimeout(function () {
      that.drawCompareChart(dataPoints, compareSport);
    }, 100);
  },

  drawCompareChart: function (dataPoints, compareSport) {
    var that = this;
    var ctx = wx.createCanvasContext('compareChart');
    var width = 340;
    var height = 300;
    var padding = { top: 50, right: 40, bottom: 60, left: 50 };
    var chartWidth = width - padding.left - padding.right;
    var chartHeight = height - padding.top - padding.bottom;

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, width, height);

    var sport = compareSport || this.data.sportsItems.find(function (item) {
      return item.key === that.data.selectedSport;
    });

    if (!sport) return;

    var yMin = sport.yMin;
    var yMax = sport.yMax;
    var isTimeBased = ['fiftyMeter', 'hundredMeter', 'eightHundredMeter', 'thousandMeter'].indexOf(sport.key) !== -1;

    ctx.setStrokeStyle('#f0f0f0');
    ctx.setLineWidth(1);
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (i * chartHeight) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    ctx.setFillStyle('#666666');
    ctx.setFontSize(12);
    ctx.setTextAlign('right');
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (i * chartHeight) / 4;
      var value;
      if (isTimeBased) {
        value = yMin + (i * (yMax - yMin) / 4);
      } else {
        value = yMax - (i * (yMax - yMin) / 4);
      }
      var label = this.formatValue(value, sport.key);
      ctx.fillText(label, padding.left - 8, y + 4);
    }

    var colors = ['#ff6b6b', '#07c160'];
    var pointRadius = 8;
    var xStep = chartWidth / (dataPoints.length - 1 || 1);

    var points = [];
    dataPoints.forEach(function (data, index) {
      var value = data[sport.key];
      if (value === undefined || value === null) {
        return;
      }

      var parsedValue = that.parseValue(value, sport.key);
      if (parsedValue === null) {
        return;
      }

      var x = padding.left + index * xStep;
      var normalizedValue;

      if (isTimeBased) {
        normalizedValue = (parsedValue - yMin) / (yMax - yMin);
      } else {
        normalizedValue = (yMax - parsedValue) / (yMax - yMin);
      }

      normalizedValue = Math.max(0, Math.min(1, normalizedValue));
      var y = padding.top + normalizedValue * chartHeight;

      points.push({ x: x, y: y, value: parsedValue });
    });

    if (points.length >= 2) {
      ctx.setStrokeStyle('#07c160');
      ctx.setLineWidth(3);
      ctx.setLineCap('round');
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (var i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();

      points.forEach(function (point, index) {
        ctx.setFillStyle('#ffffff');
        ctx.beginPath();
        ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.setFillStyle(colors[index % colors.length]);
        ctx.beginPath();
        ctx.arc(point.x, point.y, pointRadius - 3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.setFillStyle('#333333');
        ctx.setFontSize(13);
        ctx.setTextAlign('center');
        var label = that.formatValue(point.value, sport.key);
        ctx.fillText(label, point.x, point.y - 15);
      });
    }

    ctx.setFillStyle('#666666');
    ctx.setFontSize(12);
    ctx.setTextAlign('center');
    dataPoints.forEach(function (data, index) {
      var x = padding.left + index * xStep;
      ctx.fillText(that.data.compareWeeks[index] || '', x, height - 25);
    });

    ctx.setFillStyle('#07c160');
    ctx.setFontSize(16);
    ctx.setTextAlign('center');
    ctx.fillText(sport.name + ' 成长对比', width / 2, 25);

    ctx.draw();
  }
});