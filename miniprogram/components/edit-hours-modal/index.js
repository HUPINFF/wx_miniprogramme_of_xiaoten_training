// components/edit-hours-modal/index.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    childId: {
      type: String,
      value: ''
    },
    childName: {
      type: String,
      value: ''
    },
    currentHours: {
      type: Number,
      value: 0
    }
  },

  data: {
    tempHours: 0,
    submitting: false
  },

  observers: {
    'currentHours': function(hours) {
      this.setData({ tempHours: hours });
    }
  },

  methods: {
    close() {
      this.triggerEvent('close');
    },

    stopPropagation() {},

    onHoursInput(e) {
      this.setData({ tempHours: e.detail.value });
    },

    confirm() {
      const newHours = parseInt(this.data.tempHours);
      if (isNaN(newHours) || newHours < 0) {
        wx.showToast({ title: '请输入有效的学时数', icon: 'none' });
        return;
      }

      this.setData({ submitting: true });
      this.triggerEvent('confirm', {
        childId: this.properties.childId,
        remainingHours: newHours
      });

      // 延迟重置 submitting（假设父组件操作在1.5秒内完成）
      setTimeout(() => {
        this.setData({ submitting: false });
      }, 1500);
    },
  }
});