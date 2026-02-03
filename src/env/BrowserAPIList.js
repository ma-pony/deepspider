/**
 * JSForge - 浏览器 API 列表
 * 借鉴 v_jstools 的 v_getsetfunc_list.js
 * 用于批量 Hook 和环境代码生成
 */

// Getter/Setter 属性列表 [类名, 属性名]
export const GETSET_LIST = [
  // Navigator
  ['Navigator', 'userAgent'],
  ['Navigator', 'platform'],
  ['Navigator', 'language'],
  ['Navigator', 'languages'],
  ['Navigator', 'cookieEnabled'],
  ['Navigator', 'onLine'],
  ['Navigator', 'hardwareConcurrency'],
  ['Navigator', 'deviceMemory'],
  ['Navigator', 'maxTouchPoints'],
  ['Navigator', 'webdriver'],
  ['Navigator', 'vendor'],
  ['Navigator', 'appVersion'],
  ['Navigator', 'appName'],
  ['Navigator', 'product'],
  ['Navigator', 'productSub'],

  // Screen
  ['Screen', 'width'],
  ['Screen', 'height'],
  ['Screen', 'availWidth'],
  ['Screen', 'availHeight'],
  ['Screen', 'colorDepth'],
  ['Screen', 'pixelDepth'],

  // Document
  ['Document', 'cookie'],
  ['Document', 'domain'],
  ['Document', 'referrer'],
  ['Document', 'title'],
  ['Document', 'URL'],
  ['Document', 'documentElement'],
  ['Document', 'body'],
  ['Document', 'head'],
  ['Document', 'hidden'],
  ['Document', 'visibilityState'],

  // Location
  ['Location', 'href'],
  ['Location', 'protocol'],
  ['Location', 'host'],
  ['Location', 'hostname'],
  ['Location', 'port'],
  ['Location', 'pathname'],
  ['Location', 'search'],
  ['Location', 'hash'],
  ['Location', 'origin'],

  // Window
  ['Window', 'innerWidth'],
  ['Window', 'innerHeight'],
  ['Window', 'outerWidth'],
  ['Window', 'outerHeight'],
  ['Window', 'screenX'],
  ['Window', 'screenY'],
  ['Window', 'devicePixelRatio'],
  ['Window', 'localStorage'],
  ['Window', 'sessionStorage'],
  ['Window', 'name'],

  // HTMLElement
  ['HTMLElement', 'offsetWidth'],
  ['HTMLElement', 'offsetHeight'],
  ['HTMLElement', 'clientWidth'],
  ['HTMLElement', 'clientHeight'],
  ['HTMLElement', 'scrollWidth'],
  ['HTMLElement', 'scrollHeight'],
  ['HTMLElement', 'innerHTML'],
  ['HTMLElement', 'innerText'],
  ['HTMLElement', 'textContent'],

  // Canvas
  ['HTMLCanvasElement', 'width'],
  ['HTMLCanvasElement', 'height'],
  ['CanvasRenderingContext2D', 'fillStyle'],
  ['CanvasRenderingContext2D', 'strokeStyle'],
  ['CanvasRenderingContext2D', 'font'],

  // WebGL
  ['WebGLRenderingContext', 'drawingBufferWidth'],
  ['WebGLRenderingContext', 'drawingBufferHeight'],
];

// 方法列表 [类名, 方法名]
export const FUNC_LIST = [
  // Document
  ['Document', 'getElementById'],
  ['Document', 'getElementsByClassName'],
  ['Document', 'getElementsByTagName'],
  ['Document', 'getElementsByName'],
  ['Document', 'querySelector'],
  ['Document', 'querySelectorAll'],
  ['Document', 'createElement'],
  ['Document', 'createTextNode'],
  ['Document', 'createEvent'],
  ['Document', 'write'],
  ['Document', 'writeln'],

  // Element
  ['Element', 'querySelector'],
  ['Element', 'querySelectorAll'],
  ['Element', 'getAttribute'],
  ['Element', 'setAttribute'],
  ['Element', 'removeAttribute'],
  ['Element', 'hasAttribute'],
  ['Element', 'getBoundingClientRect'],
  ['Element', 'getClientRects'],

  // Canvas
  ['HTMLCanvasElement', 'getContext'],
  ['HTMLCanvasElement', 'toDataURL'],
  ['HTMLCanvasElement', 'toBlob'],
  ['CanvasRenderingContext2D', 'fillRect'],
  ['CanvasRenderingContext2D', 'fillText'],
  ['CanvasRenderingContext2D', 'strokeText'],
  ['CanvasRenderingContext2D', 'measureText'],
  ['CanvasRenderingContext2D', 'getImageData'],
  ['CanvasRenderingContext2D', 'putImageData'],
  ['CanvasRenderingContext2D', 'drawImage'],

  // WebGL
  ['WebGLRenderingContext', 'getParameter'],
  ['WebGLRenderingContext', 'getExtension'],
  ['WebGLRenderingContext', 'getSupportedExtensions'],
  ['WebGLRenderingContext', 'getShaderPrecisionFormat'],
  ['WebGL2RenderingContext', 'getParameter'],

  // Navigator
  ['Navigator', 'getBattery'],
  ['Navigator', 'getGamepads'],
  ['Navigator', 'sendBeacon'],
  ['Navigator', 'vibrate'],

  // Window
  ['Window', 'getComputedStyle'],
  ['Window', 'matchMedia'],
  ['Window', 'requestAnimationFrame'],
  ['Window', 'cancelAnimationFrame'],
  ['Window', 'fetch'],
  ['Window', 'open'],
  ['Window', 'close'],
  ['Window', 'postMessage'],

  // Storage
  ['Storage', 'getItem'],
  ['Storage', 'setItem'],
  ['Storage', 'removeItem'],
  ['Storage', 'clear'],
  ['Storage', 'key'],

  // Performance
  ['Performance', 'now'],
  ['Performance', 'getEntries'],
  ['Performance', 'getEntriesByType'],
  ['Performance', 'getEntriesByName'],

  // Crypto
  ['Crypto', 'getRandomValues'],
  ['SubtleCrypto', 'encrypt'],
  ['SubtleCrypto', 'decrypt'],
  ['SubtleCrypto', 'sign'],
  ['SubtleCrypto', 'verify'],
  ['SubtleCrypto', 'digest'],

  // Event
  ['EventTarget', 'addEventListener'],
  ['EventTarget', 'removeEventListener'],
  ['EventTarget', 'dispatchEvent'],
];

// HTML 标签到类的映射
export const HTML_TAG_MAP = {
  HTMLElement: ['abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'cite', 'code', 'dd', 'dfn', 'dt', 'em', 'figcaption', 'figure', 'footer', 'header', 'hgroup', 'i', 'kbd', 'main', 'mark', 'nav', 'noscript', 'rp', 'rt', 'ruby', 's', 'samp', 'section', 'small', 'strong', 'sub', 'summary', 'sup', 'u', 'var', 'wbr'],
  HTMLAnchorElement: ['a'],
  HTMLAreaElement: ['area'],
  HTMLAudioElement: ['audio'],
  HTMLBRElement: ['br'],
  HTMLBaseElement: ['base'],
  HTMLBodyElement: ['body'],
  HTMLButtonElement: ['button'],
  HTMLCanvasElement: ['canvas'],
  HTMLDListElement: ['dl'],
  HTMLDataElement: ['data'],
  HTMLDataListElement: ['datalist'],
  HTMLDetailsElement: ['details'],
  HTMLDialogElement: ['dialog'],
  HTMLDivElement: ['div'],
  HTMLEmbedElement: ['embed'],
  HTMLFieldSetElement: ['fieldset'],
  HTMLFormElement: ['form'],
  HTMLFrameSetElement: ['frameset'],
  HTMLHRElement: ['hr'],
  HTMLHeadElement: ['head'],
  HTMLHeadingElement: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  HTMLHtmlElement: ['html'],
  HTMLIFrameElement: ['iframe'],
  HTMLImageElement: ['img'],
  HTMLInputElement: ['input'],
  HTMLLIElement: ['li'],
  HTMLLabelElement: ['label'],
  HTMLLegendElement: ['legend'],
  HTMLLinkElement: ['link'],
  HTMLMapElement: ['map'],
  HTMLMetaElement: ['meta'],
  HTMLMeterElement: ['meter'],
  HTMLOListElement: ['ol'],
  HTMLObjectElement: ['object'],
  HTMLOptGroupElement: ['optgroup'],
  HTMLOptionElement: ['option'],
  HTMLOutputElement: ['output'],
  HTMLParagraphElement: ['p'],
  HTMLPictureElement: ['picture'],
  HTMLPreElement: ['pre'],
  HTMLProgressElement: ['progress'],
  HTMLQuoteElement: ['blockquote', 'q'],
  HTMLScriptElement: ['script'],
  HTMLSelectElement: ['select'],
  HTMLSlotElement: ['slot'],
  HTMLSourceElement: ['source'],
  HTMLSpanElement: ['span'],
  HTMLStyleElement: ['style'],
  HTMLTableCaptionElement: ['caption'],
  HTMLTableCellElement: ['td', 'th'],
  HTMLTableColElement: ['col', 'colgroup'],
  HTMLTableElement: ['table'],
  HTMLTableRowElement: ['tr'],
  HTMLTableSectionElement: ['thead', 'tbody', 'tfoot'],
  HTMLTemplateElement: ['template'],
  HTMLTextAreaElement: ['textarea'],
  HTMLTimeElement: ['time'],
  HTMLTitleElement: ['title'],
  HTMLTrackElement: ['track'],
  HTMLUListElement: ['ul'],
  HTMLVideoElement: ['video'],
};

// 获取类的原型链
export function getPrototypeChain(className) {
  const chains = {
    'HTMLDivElement': ['HTMLDivElement', 'HTMLElement', 'Element', 'Node', 'EventTarget'],
    'HTMLCanvasElement': ['HTMLCanvasElement', 'HTMLElement', 'Element', 'Node', 'EventTarget'],
    'HTMLInputElement': ['HTMLInputElement', 'HTMLElement', 'Element', 'Node', 'EventTarget'],
    'Document': ['Document', 'Node', 'EventTarget'],
    'Window': ['Window', 'EventTarget'],
    'Navigator': ['Navigator'],
    'Screen': ['Screen'],
    'Location': ['Location'],
  };
  return chains[className] || [className];
}

export default {
  GETSET_LIST,
  FUNC_LIST,
  HTML_TAG_MAP,
  getPrototypeChain,
};
