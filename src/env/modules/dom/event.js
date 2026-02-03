/**
 * DeepSpider - Event 环境模块
 */

export const eventCode = `
(function() {
  function Event(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles || false;
    this.cancelable = options.cancelable || false;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.timeStamp = Date.now();
  }
  Event.prototype = {
    preventDefault: function() { this.defaultPrevented = true; },
    stopPropagation: function() {},
    stopImmediatePropagation: function() {}
  };

  function CustomEvent(type, options = {}) {
    Event.call(this, type, options);
    this.detail = options.detail || null;
  }
  CustomEvent.prototype = Object.create(Event.prototype);

  function MouseEvent(type, options = {}) {
    Event.call(this, type, options);
    this.clientX = options.clientX || 0;
    this.clientY = options.clientY || 0;
    this.button = options.button || 0;
  }
  MouseEvent.prototype = Object.create(Event.prototype);

  function KeyboardEvent(type, options = {}) {
    Event.call(this, type, options);
    this.key = options.key || '';
    this.code = options.code || '';
    this.keyCode = options.keyCode || 0;
  }
  KeyboardEvent.prototype = Object.create(Event.prototype);

  window.Event = Event;
  window.CustomEvent = CustomEvent;
  window.MouseEvent = MouseEvent;
  window.KeyboardEvent = KeyboardEvent;
})();
`;

export default eventCode;
