/**
 * DeepSpider - Document 环境模块（数据驱动）
 */

export function documentCode(data) {
  if (!data) throw new Error('document: 需要真实浏览器数据');
  return `(function() {
  // 元素ID生成器
  let __elId = 0;
  const __elements = new Map();

  // 基础元素类
  function Element(tagName) {
    this.__id__ = 'el_' + (++__elId);
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.children = [];
    this.childNodes = [];
    this.parentNode = null;
    this.parentElement = null;
    this.attributes = {};
    this._attrs = {};
    this.style = {};
    this.classList = {
      _list: [],
      add: function() { var c = arguments; for (var i = 0; i < c.length; i++) if (this._list.indexOf(c[i]) === -1) this._list.push(c[i]); },
      remove: function() { var c = arguments; for (var i = 0; i < c.length; i++) { var idx = this._list.indexOf(c[i]); if (idx > -1) this._list.splice(idx, 1); } },
      contains: function(c) { return this._list.indexOf(c) !== -1; },
      toggle: function(c) { this.contains(c) ? this.remove(c) : this.add(c); }
    };
    this.innerHTML = '';
    this.innerText = '';
    this.textContent = '';
    this.id = '';
    this.className = '';
    this.dataset = {};
    __elements.set(this.__id__, this);
  }

  Element.prototype = {
    getAttribute: function(n) { return this._attrs[n] ?? null; },
    setAttribute: function(n, v) { this._attrs[n] = String(v); if (n === 'id') this.id = v; },
    removeAttribute: function(n) { delete this._attrs[n]; },
    hasAttribute: function(n) { return n in this._attrs; },
    appendChild: function(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
    removeChild: function(c) {
      var i = this.children.indexOf(c);
      if (i > -1) { this.children.splice(i, 1); this.childNodes.splice(i, 1); }
      return c;
    },
    querySelector: function(s) { return null; },
    querySelectorAll: function(s) { return []; },
    getElementsByTagName: function(t) { return []; },
    getElementsByClassName: function(c) { return []; },
    addEventListener: function(t, h, o) {},
    removeEventListener: function(t, h, o) {},
    dispatchEvent: function(e) { return true; },
    cloneNode: function(deep) { return new Element(this.tagName); },
    getBoundingClientRect: function() {
      return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
    }
  };

  // Document 对象
  var document = {
    nodeType: 9,
    nodeName: '#document',
    documentElement: new Element('HTML'),
    head: new Element('HEAD'),
    body: new Element('BODY'),
    title: ${JSON.stringify(data.title || '')},
    cookie: ${JSON.stringify(data.cookie || '')},
    domain: ${JSON.stringify(data.domain || '')},
    URL: ${JSON.stringify(data.URL || '')},
    referrer: ${JSON.stringify(data.referrer || '')},
    readyState: 'complete',
    hidden: false,
    visibilityState: 'visible',

    createElement: function(tag) { return new Element(tag); },
    createTextNode: function(text) { return { nodeType: 3, textContent: text }; },
    createDocumentFragment: function() { return new Element('fragment'); },
    createComment: function(text) { return { nodeType: 8, textContent: text }; },

    getElementById: function(id) { return null; },
    getElementsByTagName: function(tag) { return []; },
    getElementsByClassName: function(cls) { return []; },
    getElementsByName: function(name) { return []; },
    querySelector: function(sel) { return null; },
    querySelectorAll: function(sel) { return []; },

    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return true; },

    write: function() {},
    writeln: function() {},
    open: function() {},
    close: function() {}
  };

  document.documentElement.appendChild(document.head);
  document.documentElement.appendChild(document.body);

  window.document = document;
  window.Element = Element;
})();`;
}

export const documentCovers = [
  'document.nodeType', 'document.nodeName', 'document.documentElement',
  'document.head', 'document.body', 'document.title', 'document.cookie',
  'document.domain', 'document.URL', 'document.referrer', 'document.readyState',
  'document.hidden', 'document.visibilityState',
  'document.createElement', 'document.createTextNode',
  'document.createDocumentFragment', 'document.createComment',
  'document.getElementById', 'document.getElementsByTagName',
  'document.getElementsByClassName', 'document.getElementsByName',
  'document.querySelector', 'document.querySelectorAll',
  'document.addEventListener', 'document.removeEventListener',
  'document.dispatchEvent', 'document.write', 'document.writeln',
];

export default documentCode;
