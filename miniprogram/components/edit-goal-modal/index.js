// components/edit-goal-modal/index.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    currentGoal: {
      type: String,
      value: ''
    }
  },

  data: {
    tempGoal: '',
    charCount: 0,
    focused: false,
    submitting: false,
    suggestions: ['长高长壮', '提高体能', '备战体考', '养成运动习惯']
  },

  observers: {
    // 每次「打开弹窗」或「目标值变化」都把编辑框重置成最新目标，
    // 避免上次取消前敲了一半的文字被带进下一次打开
    'show, currentGoal': function (show, goal) {
      if (show) {
        const value = goal || '';
        this.setData({ tempGoal: value, charCount: value.length });
      }
    }
  },

  methods: {
    close() {
      this.triggerEvent('close');
    },

    stopPropagation() {},

    onGoalInput(e) {
      const value = e.detail.value || '';
      this.setData({ tempGoal: value, charCount: value.length });
    },

    onGoalFocus() {
      this.setData({ focused: true });
    },

    onGoalBlur() {
      this.setData({ focused: false });
    },

    // 轻点常用标签：没加过就追加（用顿号连接），加过给个提示不重复加
    onChipTap(e) {
      const text = e.currentTarget.dataset.text;
      if (!text) return;

      let goal = (this.data.tempGoal || '').trim();
      if (goal.indexOf(text) !== -1) {
        wx.showToast({ title: '已在目标中', icon: 'none' });
        return;
      }
      goal = goal ? goal + '、' + text : text;
      if (goal.length > 60) goal = goal.slice(0, 60);
      this.setData({ tempGoal: goal, charCount: goal.length });
    },

    confirm() {
      if (this.data.submitting) return;
      this.setData({ submitting: true });
      this.triggerEvent('confirm', { value: this.data.tempGoal });

      // 延迟重置 submitting（保存成功父组件会关弹窗；失败则留在弹窗里可重试）
      setTimeout(() => {
        this.setData({ submitting: false });
      }, 1500);
    }
  }
});
