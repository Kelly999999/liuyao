/**
 * 简单的 CSS 动画工具
 */
var Animations = {
  /**
   * 给元素添加动画类
   */
  animate: function(el, className, duration) {
    if (!el) return;
    el.classList.add(className);
    if (duration) {
      setTimeout(function() {
        el.classList.remove(className);
      }, duration);
    }
  },

  /**
   * 淡入效果
   */
  fadeIn: function(el, delay) {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(15px)';
    el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    setTimeout(function() {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, delay || 0);
  },

  /**
   * 创建 DOM 元素
   */
  createElement: function(tag, className, innerHTML) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  },

  /**
   * 安全地设置 innerHTML
   */
  setHTML: function(el, html) {
    if (el) el.innerHTML = html;
  }
};
