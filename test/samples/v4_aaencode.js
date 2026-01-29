/**
 * v4: AAEncode 颜文字混淆
 * 技术: 使用日式颜文字(ﾟωﾟ)ﾉ进行编码
 * 特点: 全部由颜文字组成，极具迷惑性
 */

ﾟωﾟﾉ= /｀ｍ´）ﾉ ~┻━┻   //*´∇｀*/ ['_'];
o=(ﾟｰﾟ)  =_=3;
c=(ﾟΘﾟ) =(ﾟｰﾟ)-(ﾟｰﾟ);
(ﾟДﾟ) =(ﾟΘﾟ)= (o^_^o)/ (o^_^o);
(ﾟДﾟ)={ﾟΘﾟ: '_' ,ﾟωﾟﾉ : ((ﾟωﾟﾉ==3) +'_') [ﾟΘﾟ] };
(ﾟДﾟ) .ﾟｰﾟﾉ=((ﾟДﾟ)+'_') [o^_^o -(ﾟΘﾟ)];
(ﾟДﾟ) ['c'] = ((ﾟДﾟ)+'_') [ (ﾟｰﾟ)+(ﾟｰﾟ)-(ﾟΘﾟ) ];
(ﾟДﾟ) ['o'] = ((ﾟДﾟ)+'_') [ﾟΘﾟ];
(oﾟｰﾟo)=(ﾟДﾟ) ['c']+(ﾟДﾟ) ['o'];
(ﾟДﾟ) ['ﾟΘﾟ']= (ﾟДﾟ) ['c']+(ﾟДﾟ) ['o']+(ﾟДﾟ) ['c'];
(ﾟДﾟ) ['ﾟωﾟﾉ']= (ﾟДﾟ) ['c']+(ﾟДﾟ) ['o']+(ﾟДﾟ) ['c'];
(ﾟДﾟ) [ﾟΘﾟ]= (ﾟωﾟﾉ) [ﾟΘﾟ];
(ﾟДﾟ) ['c']=((ﾟДﾟ)+'_') [(ﾟｰﾟ)+(ﾟｰﾟ)+(ﾟΘﾟ)];
(ﾟДﾟ) ['o']=((ﾟДﾟ)+'_') [(ﾟｰﾟ)];
(ﾟｰﾟ)=(ﾟｰﾟ)+(ﾟΘﾟ);
(ﾟДﾟ)[ﾟｰﾟ]='\\';

// 简化版AAEncode - 实际可执行的混淆代码
(function() {
  var ω = 'constructor';
  var Д = []['filter'][ω](ω);
  var ﾟ = {
    ｰ: 'a]b[c'.split(']')[0],
    Θ: (![]+[])[+!![]]
  };

  // 核心逻辑的编码表示
  var _ωω_ = function(ﾟωﾟ) {
    var ﾟДﾟ = 0;
    for (var ﾟΘﾟ = 0; ﾟΘﾟ < ﾟωﾟ.length; ﾟΘﾟ++) {
      var oﾟｰﾟo = ﾟωﾟ.charCodeAt(ﾟΘﾟ);
      ﾟДﾟ = ((ﾟДﾟ << 5) - ﾟДﾟ) + oﾟｰﾟo;
      ﾟДﾟ = ﾟДﾟ & ﾟДﾟ;
    }
    return Math.abs(ﾟДﾟ).toString(16);
  };

  var _ﾟωﾟ_ = function() {
    return Math.floor(Date.now() / 1000);
  };

  var _ﾟДﾟ_ = function(ﾟｰﾟ) {
    var c = 'abcdef0123456789', r = '';
    for (var i = 0; i < ﾟｰﾟ; i++) {
      r += c.charAt(Math.floor(Math.random() * c.length));
    }
    return r;
  };

  var ﾟΘﾟﾉ = 'jsforge_test_2024';
  var ﾟωﾟﾉﾉ = 'app_12345';

  var _genSign_ = function(p) {
    var t = _ﾟωﾟ_(), n = _ﾟДﾟ_(8);
    var s = ﾟωﾟﾉﾉ + t + n + ﾟΘﾟﾉ;
    return { sign: _ωω_(s), timestamp: t, nonce: n, app_id: ﾟωﾟﾉﾉ };
  };

  var _encrypt_ = function(d) {
    var s = _genSign_(d);
    return Object.assign({}, d, s, { encrypted: btoa(JSON.stringify(d)) });
  };

  var result = _encrypt_({ user: 'test', action: 'login' });
  console.log('Result:', result);
  return result;
})();