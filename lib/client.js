/**
 * dsh-bilibili — Web 半侧（手写 ModuleLoader bundle，无需构建）
 *
 * 只 require('react')；所有网络请求走 Host 的 /plugins/dsh-bilibili/*。
 * QR 生成库由 Host 以静态脚本提供，避免把 50KB 源码塞进这个 bundle。
 */
window.__ModuleLoader__.load({
  id: 'dsh-bilibili',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement

    var API = '/plugins/dsh-bilibili'
    var BUILD = 13 // 面板右下可见：用来确认页面是不是最新客户端

    /* ── 样式 ──────────────────────────────────────────────────────────── */
    var CSS = [
      '.__bl_wrap{--bl-pink:#fb7299;--bl-blue:#00aeec;display:flex;flex-direction:column;gap:16px;max-width:1180px;font-size:15px}',
      '.__bl_root{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#30363d);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#0d1117);color:var(--dsw-alias-label-primary,#e6edf3)}',
      '.__bl_bar{display:flex;align-items:center;gap:12px;padding:12px 16px;background:linear-gradient(90deg,rgba(251,114,153,.20),rgba(0,174,236,.12) 55%,transparent),var(--dsw-alias-bg-layer-2,#161b22);border-bottom:1px solid var(--dsw-alias-border-l2,#30363d);flex-wrap:wrap}',
      '.__bl_relRow{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-top:6px}',
      '.__bl_relCard{border:1px solid var(--dsw-alias-border-l2,#30363d);border-radius:8px;overflow:hidden;cursor:pointer;background:var(--dsw-alias-bg-layer-2,#161b22)}',
      '.__bl_relCard:hover{border-color:var(--bl-pink)}',
      '.__bl_relCover{width:100%;aspect-ratio:16/10;object-fit:cover;display:block;background:#000}',
      '.__bl_relTitle{font-size:13px;line-height:1.4;padding:6px 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.__bl_logo{font-weight:700;font-size:18px;color:var(--bl-pink);letter-spacing:.5px;display:flex;align-items:center;gap:8px}',
      '.__bl_sub{font-size:13px;color:var(--dsw-alias-label-tertiary,#8b949e)}',
      '.__bl_spacer{flex:1 1 auto}',
      '.__bl_btn{border:1px solid var(--dsw-alias-border-l2,#30363d);background:var(--dsw-alias-bg-layer-3,#21262d);color:var(--dsw-alias-label-primary,#e6edf3);border-radius:8px;padding:8px 16px;font:inherit;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}',
      '.__bl_btn:hover:not(:disabled){border-color:var(--bl-pink)}',
      '.__bl_btn:disabled{opacity:.5;cursor:default}',
      '.__bl_btnPink{background:var(--bl-pink);border-color:var(--bl-pink);color:#fff}',
      '.__bl_btnBlue{background:var(--bl-blue);border-color:var(--bl-blue);color:#fff}',
      '.__bl_tabs{display:flex;gap:6px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,#30363d)}',
      '.__bl_tab{border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-tertiary,#8b949e);border-radius:8px;padding:8px 16px;font:inherit;font-size:14px;cursor:pointer}',
      '.__bl_tabOn{background:rgba(251,114,153,.14);color:var(--bl-pink);border-color:rgba(251,114,153,.4);font-weight:600}',
      '.__bl_body{padding:16px;min-height:520px;max-height:760px;overflow:auto}',
      '.__bl_grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}',
      '.__bl_card{border:1px solid var(--dsw-alias-border-l2,#30363d);border-radius:10px;overflow:hidden;cursor:pointer;background:var(--dsw-alias-bg-layer-2,#161b22);display:flex;flex-direction:column}',
      '.__bl_card:hover{border-color:var(--bl-pink);transform:translateY(-1px)}',
      '.__bl_cover{width:100%;aspect-ratio:16/10;object-fit:cover;background:#000;display:block}',
      '.__bl_cardBody{padding:10px 12px;display:flex;flex-direction:column;gap:6px}',
      '.__bl_title{font-size:14px;font-weight:600;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.__bl_meta{font-size:12px;color:var(--dsw-alias-label-tertiary,#8b949e);display:flex;gap:12px;flex-wrap:wrap;font-variant-numeric:tabular-nums}',
      '.__bl_login{display:flex;gap:24px;padding:24px;align-items:flex-start;flex-wrap:wrap}',
      '.__bl_qr{border:10px solid #fff;border-radius:12px;background:#fff;width:236px;height:236px;display:flex;align-items:center;justify-content:center}',
      '.__bl_qr svg{display:block;width:100%;height:100%}',
      '.__bl_field{display:flex;flex-direction:column;gap:6px;width:100%;max-width:460px}',
      '.__bl_input{border:1px solid var(--dsw-alias-border-l2,#30363d);background:var(--dsw-alias-bg-layer-3,#21262d);color:var(--dsw-alias-label-primary,#e6edf3);border-radius:8px;padding:9px 12px;font:inherit;font-size:14px;outline:none;width:100%;box-sizing:border-box}',
      '.__bl_input:focus{border-color:var(--bl-pink)}',
      '.__bl_textarea{min-height:84px;resize:vertical;font-family:inherit}',
      '.__bl_err{color:#f85149;font-size:13px;line-height:1.6;word-break:break-word}',
      '.__bl_ok{color:#3fb950;font-size:13px}',
      '.__bl_empty{padding:64px 16px;text-align:center;color:var(--dsw-alias-label-tertiary,#8b949e);font-size:14px}',
      '.__bl_detail{display:flex;flex-direction:column;gap:14px}',
      '.__bl_frameWrap{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden}',
      '.__bl_frame{width:100%;height:100%;border:0;display:block}',
      '.__bl_actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
      '.__bl_cmt{border-top:1px solid var(--dsw-alias-border-l2,#30363d);padding-top:12px;display:flex;flex-direction:column;gap:12px}',
      '.__bl_cmtRow{display:flex;gap:10px;align-items:flex-start}',
      '.__bl_avatar{width:34px;height:34px;border-radius:50%;flex:0 0 auto;object-fit:cover;background:#30363d}',
      '.__bl_cmtBody{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}',
      '.__bl_cmtUser{font-size:13px;color:var(--bl-blue);font-weight:600}',
      '.__bl_cmtText{font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word}',
      '.__bl_toast{position:fixed;right:24px;bottom:24px;z-index:9999;background:var(--dsw-alias-bg-layer-3,#21262d);color:var(--dsw-alias-label-primary,#e6edf3);border:1px solid var(--dsw-alias-border-l2,#30363d);border-radius:10px;padding:10px 16px;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.35)}',
      '.__bl_searchRow{display:flex;gap:10px;margin-bottom:14px}',
      '.__bl_tags{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center}',
      '.__bl_chip{border:1px solid var(--dsw-alias-border-l2,#30363d);background:var(--dsw-alias-bg-layer-3,#21262d);color:var(--dsw-alias-label-primary,#e6edf3);border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}',
      '.__bl_chip:hover{border-color:var(--bl-pink)}',
      '.__bl_userHead{display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:4px 0}',
      '.__bl_userFace{width:84px;height:84px;border-radius:50%;object-fit:cover;border:2px solid var(--dsw-alias-border-l2,#30363d);background:#000;flex:0 0 auto}',
      '.__bl_userName{font-size:20px;font-weight:700}',
      '.__bl_dyn{border:1px solid var(--dsw-alias-border-l2,#30363d);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;background:var(--dsw-alias-bg-layer-2,#161b22)}',
      '.__bl_faceLink{cursor:pointer}',
      '.__bl_tag{font-size:11px;padding:1px 8px;border-radius:999px;background:rgba(251,114,153,.15);color:var(--bl-pink)}',
    ].join('\n')
    var tagId = 'dsh-bilibili/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      var styleTag = document.createElement('style')
      styleTag.dataset.plugin = 'dsh-bilibili'
      styleTag.dataset.pluginCss = tagId
      styleTag.textContent = CSS
      document.head.appendChild(styleTag)
    }

    /* ── HTTP ──────────────────────────────────────────────────────────── */
    async function api(path, options) {
      var response = await fetch(API + path, Object.assign({ cache: 'no-store' }, options || {}))
      var payload = null
      try { payload = await response.json() } catch (e) { payload = null }
      if (!response.ok) throw new Error((payload && payload.error) || ('HTTP ' + response.status))
      return payload
    }
    function postJson(path, body) {
      return api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
    }

    /* ── QR 库加载 ─────────────────────────────────────────────────────── */
    var qrPromise = null
    function loadQrLib() {
      if (window.qrcode) return Promise.resolve(window.qrcode)
      if (qrPromise) return qrPromise
      qrPromise = new Promise(function (resolve, reject) {
        var el = document.createElement('script')
        el.src = API + '/vendor/qrcode.js'
        el.onload = function () {
          if (window.qrcode) resolve(window.qrcode)
          else reject(new Error('QR 库加载后没有暴露 window.qrcode'))
        }
        el.onerror = function () { reject(new Error('QR 库加载失败')) }
        document.head.appendChild(el)
      })
      return qrPromise
    }

    /* ── 工具 ──────────────────────────────────────────────────────────── */
    function fmtNum(n) {
      var v = Number(n) || 0
      if (v < 10000) return String(v)
      if (v < 100000000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + ' 万'
      return (v / 100000000).toFixed(1).replace(/\.0$/, '') + ' 亿'
    }
    function fmtTime(sec) {
      var s = Number(sec) || 0
      if (s < 60) return s + 's'
      var m = Math.floor(s / 60)
      if (m < 60) return m + ':' + String(s % 60).padStart(2, '0')
      return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
    }
    function ago(ts) {
      var t = Number(ts) * 1000
      if (!t) return ''
      var d = Date.now() - t
      if (d < 60000) return '刚刚'
      if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前'
      if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前'
      if (d < 2592000000) return Math.floor(d / 86400000) + ' 天前'
      return new Date(t).toLocaleDateString('zh-CN')
    }

    function Btn(props) {
      return h('button', {
        type: 'button',
        className: '__bl_btn' + (props.kind === 'pink' ? ' __bl_btnPink' : props.kind === 'blue' ? ' __bl_btnBlue' : ''),
        disabled: props.disabled,
        onClick: props.onClick,
        title: props.title,
      }, props.children)
    }

    function Toast(props) {
      if (!props.text) return null
      return h('div', { className: '__bl_toast' }, props.text)
    }

    /**
     * 真正的错误边界。
     *
     * 函数组件的 try/catch 只能接住自己函数体里抛的错；React 在协调子树时
     * 抛的错会一路冒到 root，把整个 DSH 界面卸掉（就是黑屏）。只有 class
     * 组件的 getDerivedStateFromError 能拦住它。
     */
    function makeBoundary() {
      if (!React || !React.Component) return null
      return class PanelBoundary extends React.Component {
        constructor(props) {
          super(props)
          this.state = { error: null }
        }
        static getDerivedStateFromError(error) {
          return { error: error }
        }
        componentDidCatch(error, info) {
          try { console.error('[dsh-bilibili] 面板渲染异常：', error, info && info.componentStack) } catch (e) {}
        }
        render() {
          if (this.state.error) {
            var message = this.state.error && this.state.error.message ? this.state.error.message : String(this.state.error)
            return h('div', { className: '__bl_wrap' },
              h('div', { className: '__bl_root' },
                h('div', { className: '__bl_body', style: { padding: 24, lineHeight: 1.8 } },
                  h('div', { style: { fontSize: 17, fontWeight: 700, marginBottom: 12 } }, '哔哩哔哩面板出错了'),
                  h('div', { className: '__bl_err' }, message),
                  h('div', { className: '__bl_sub', style: { marginTop: 12 } },
                    '界面其余部分不受影响。刷新页面可重试，或在插件里卸载 dsh-bilibili。'))))
          }
          return this.props.children
        }
      }
    }

    /* ── 扫码登录 ──────────────────────────────────────────────────────── */
    function LoginView(props) {
      var [phase, setPhase] = React.useState('loading') // loading | waiting | scanned | expired | error | success
      var [pollDebug, setPollDebug] = React.useState('')
      var [qrKey, setQrKey] = React.useState('')
      var [qrRaw, setQrRaw] = React.useState('')
      var [qrImg, setQrImg] = React.useState('')
      var [error, setError] = React.useState('')
      var [cookie, setCookie] = React.useState('')
      var [busy, setBusy] = React.useState(false)
      var [rememberSms, setRememberSms] = React.useState(true) // 手机号登录的记住
      var [rememberQr, setRememberQr] = React.useState(true) // 扫码登录的记住
      var [rememberCookie, setRememberCookie] = React.useState(true) // Cookie 导入的记住
      var timerRef = React.useRef(null)

      var stop = function () { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

      // 世代号：每次 start 加一。重叠启动（连点刷新/组件重复挂载）时，
      // 旧世代的生成结果和轮询结果全部作废，杜绝两把钥匙交叉轮询 →
      // 旧钥匙 180 秒后误报「二维码已过期」。
      var generationRef = React.useRef(0)
      var pollCountRef = React.useRef(0)

      var start = React.useCallback(async function () {
        stop()
        generationRef.current += 1
        var myGen = generationRef.current
        setPhase('loading'); setError('')
        try {
          var data = await api('/login/qr?remember=' + (rememberQr ? '1' : '0'))
          if (myGen !== generationRef.current) return // 换代了，丢弃
          if (!data || data.ok === false) throw new Error((data && data.error) || '获取二维码失败')
          setQrKey(data.key)
          setQrRaw(data.url || '')
          // 二维码用 data URL 交给 React 渲染。
          // 绝不能用 innerHTML 往 React 管的节点里写 —— 那会删掉 React 的子节点，
          // 下次更新时报 removeChild 失败。
          var painted = false
          try {
            var qrcode = await loadQrLib()
            var qr = qrcode(0, 'M')
            qr.addData(data.url)
            qr.make()
            var dataUrl = ''
            try { dataUrl = qr.createDataURL(6, 2) } catch (e1) { dataUrl = '' }
            if (dataUrl) { setQrImg(dataUrl); painted = true }
          } catch (e) {
            painted = false
          }
          if (myGen !== generationRef.current) return // 画码期间换代了，丢弃
          if (!painted) {
            // 画不出来就退化成可点的链接，绝不留一块黑
            setPhase('error')
            setError('二维码画不出来，点下面的按钮用链接登录（功能一样）')
            return
          }
          setPhase('waiting')
          timerRef.current = setInterval(function () {
            if (myGen !== generationRef.current) { stop(); return }
            api('/login/qr/poll?key=' + encodeURIComponent(data.key)).then(function (r) {
              if (myGen !== generationRef.current) return // 旧世代结果一律丢弃
              if (!r || r.ok === false) return
              // 把轮询的真实状态亮出来：报 bug 时照抄这行，直接定位
              setPollDebug(String(r.code ?? '') + ' ' + String(r.state ?? '') + ' · 第 ' + (pollCountRef.current += 1) + ' 次轮询')
              if (r.state === 'scanned') setPhase('scanned')
              if (r.state === 'expired') {
                // B 站二维码只有 180 秒寿命，过期自动换新码，不用手动点
                stop()
                setPhase('expired')
                setTimeout(start, 400)
              }
              if (r.state === 'success') { stop(); setPhase('success'); props.onLoggedIn(r) }
            }).catch(function () {})
          }, 2000)
        } catch (e) {
          if (myGen !== generationRef.current) return
          setPhase('error')
          setError(e && e.message ? e.message : String(e))
        }
      }, [rememberQr])

      React.useEffect(function () { start(); return stop }, [start])

      var importCookie = async function () {
        if (busy || !cookie.trim()) return
        setBusy(true); setError('')
        try {
          var r = await postJson('/login/cookie', { cookie: cookie.trim(), remember: rememberCookie })
          if (r && r.ok && r.loggedIn) { props.onLoggedIn(r) }
          else setError((r && r.error) || '导入失败')
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy(false) }
      }

      /* ── 手机号 + 极验登录 ─────────────────────────────────────────── */
      var [tel, setTel] = React.useState('')
      var [smsCode, setSmsCode] = React.useState('')
      var [smsPhase, setSmsPhase] = React.useState('idle')
      var [smsMsg, setSmsMsg] = React.useState('')
      var [captchaKey, setCaptchaKey] = React.useState('')
      var geeRef = React.useRef(null)
      var geePromise = null

      /**
       * 完整复刻 PiliPlus 的极验流程（lib/pages/login/geetest/geetest_webview_dialog.dart）：
       *   ① fullpage.0.0.0.js 提供 window.Geetest
       *   ② gettype.php?gt=..&callback=.. 用 JSONP 拿完整配置（**这步漏了就会卡死**）
       *   ③ Geetest(Object.assign({gt, challenge, ...}, config.data))
       *      串联 onSuccess / onError / onClose / onReady，ready 后 verify()
       */
      var loadScriptOnce = function (src) {
        return new Promise(function (resolve, reject) {
          var el = document.createElement('script')
          el.src = src
          el.onload = function () { resolve() }
          el.onerror = function () { reject(new Error('脚本加载失败：' + src)) }
          document.head.appendChild(el)
        })
      }

      var acquireGeetest = async function (gt, challenge) {
        if (!window.Geetest) {
          await loadScriptOnce('https://static.geetest.com/static/js/fullpage.0.0.0.js')
        }
        if (!window.Geetest) throw new Error('极验脚本没有暴露 window.Geetest')

        var ts = Date.now()
        // 回调名必须严格是 geetest_<数字>。多一个下划线（geetest_cb_...）
        // 会被极验判成 jsonp xss（error_05）从而拒绝返回配置。
        var cbName = 'geetest_' + ts
        var config = await new Promise(function (resolve, reject) {
          window[cbName] = function (data) { resolve(data) }
          loadScriptOnce('https://api.geetest.com/gettype.php?gt=' + encodeURIComponent(gt) + '&callback=' + cbName)
            .catch(reject)
          setTimeout(function () { reject(new Error('极验配置超时')) }, 12000)
        }).finally(function () { try { delete window[cbName] } catch (e) {} })

        if (!config || config.status !== 'success') {
          throw new Error('极验配置异常：' + JSON.stringify(config || {}).slice(0, 120))
        }

        var options = Object.assign({
          gt: gt,
          challenge: challenge,
          offline: false,
          new_captcha: true,
          product: 'bind',
          width: '100%',
          https: true,
          protocol: 'https://',
        }, config.data || {})

        return new Promise(function (resolve, reject) {
          try {
            var instance = window.Geetest(options)
            instance.onSuccess(function () { resolve(instance.getValidate() || {}) })
            instance.onError(function (err) { reject(new Error('极验出错：' + JSON.stringify(err || {}).slice(0, 100))) })
            instance.onClose(function () { reject(new Error('已关闭验证')) })
            instance.onReady(function () { try { instance.verify() } catch (e) { reject(e) } })
          } catch (e) {
            reject(e)
          }
        })
      }

      var sendCode = async function (cap, v) {
        setSmsPhase('sending'); setSmsMsg('')
        try {
          var r = await postJson('/login/sms/send', {
            tel: tel.trim(),
            token: cap.token,
            challenge: (v && v.geetest_challenge) || cap.challenge,
            validate: (v && v.geetest_validate) || '',
            seccode: (v && v.geetest_seccode) || '',
          })
          if (r && r.ok) { setSmsPhase('sent'); setCaptchaKey(r.captchaKey || ''); setSmsMsg('验证码已发送，注意查收') }
          else { setSmsPhase('error'); setSmsMsg(((r && r.error) || '发送失败') + (r && r.code ? '（' + r.code + '）' : '')) }
        } catch (e) { setSmsPhase('error'); setSmsMsg(e && e.message ? e.message : String(e)) }
      }

      var startSms = async function () {
        if (!/^1\d{10}$/.test(tel.trim())) { setSmsMsg('先填 11 位手机号'); setSmsPhase('error'); return }
        setSmsPhase('geetest'); setSmsMsg('')
        try {
          var cap = await api('/login/captcha')
          if (!cap || cap.ok === false) throw new Error((cap && cap.error) || '取验证码参数失败')
          var result = await acquireGeetest(cap.gt, cap.challenge)
          await sendCode(cap, result)
        } catch (e) {
          setSmsPhase('error')
          setSmsMsg(e && e.message ? e.message : String(e))
        }
      }

      var verifySms = async function () {
        if (busy) return
        setBusy(true); setSmsMsg('')
        try {
          var r = await postJson('/login/sms/verify', { tel: tel.trim(), code: smsCode.trim(), captchaKey: captchaKey, remember: rememberSms })
          if (r && r.ok && r.loggedIn) props.onLoggedIn(r)
          else setSmsMsg(((r && r.error) || '登录失败') + (r && r.code ? '  [code ' + r.code + ']' : ''))
        } catch (e) { setSmsMsg(e && e.message ? e.message : String(e)) }
        finally { setBusy(false) }
      }

      var hint = {
        loading: '正在获取二维码…',
        waiting: '用哔哩哔哩 App 扫码登录',
        scanned: '已扫码，请在手机上点「确认登录」',
        expired: '二维码已过期，正在自动刷新…',
        error: '二维码加载失败',
        success: '登录成功',
      }[phase] || ''

      return h('div', { className: '__bl_login', style: { flexDirection: 'column' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          props.onBack ? h('button', {
            type: 'button',
            className: '__bl_btn',
            onClick: props.onBack,
          }, '← 先随便刷刷') : null,
          h('div', { style: { fontSize: 17, fontWeight: 700 } }, '登录哔哩哔哩')),

        /* ① 手机号登录 —— 不折叠，永远展开 */
        h('div', { className: '__bl_field', style: { maxWidth: 520 } },
          h('div', { style: { fontSize: 15, fontWeight: 600 } }, '手机号登录'),
          h('input', {
            className: '__bl_input',
            type: 'tel',
            placeholder: '手机号（11 位）',
            value: tel,
            maxLength: 11,
            onChange: function (e) { setTel(e.target.value.replace(/\D/g, '')) },
          }),
          h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            h(Btn, { disabled: smsPhase === 'sending' || !/^1\d{10}$/.test(tel.trim()), onClick: startSms },
              smsPhase === 'sending' ? '发送中…' : '获取验证码'),
            h('input', {
              className: '__bl_input',
              style: { flex: '1 1 130px', width: 'auto' },
              placeholder: '短信验证码',
              value: smsCode,
              maxLength: 8,
              onChange: function (e) { setSmsCode(e.target.value.replace(/\D/g, '')) },
            }),
            h(Btn, { kind: 'pink', disabled: busy || smsCode.length < 4, onClick: verifySms }, busy ? '登录中…' : '登录')),
          h('div', { ref: geeRef, style: { minHeight: 4 } }),
          smsMsg ? h('div', { className: '__bl_sub' }, smsMsg) : null,
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' } },
            h('input', { type: 'checkbox', checked: rememberSms, onChange: function (e) { setRememberSms(e.target.checked) } }),
            '记住账号（手机号登录）')),

        /* ② 二维码 —— 不折叠，永远展开 */
        h('div', { className: '__bl_field' },
          h('div', { style: { fontSize: 15, fontWeight: 600 } }, '扫码登录'),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' } },
            h('div', { className: '__bl_qr' },
              qrImg
                ? h('img', { src: qrImg, alt: '登录二维码', style: { width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' } })
                : h('span', { className: '__bl_sub' }, phase === 'loading' ? '…' : '无')),
            h('div', { className: '__bl_sub' }, hint),
          pollDebug ? h('div', { className: '__bl_sub', style: { fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 11 } }, '轮询：' + pollDebug) : null,
            qrRaw ? h('a', {
              className: '__bl_btn',
              href: qrRaw,
              target: '_blank',
              rel: 'noreferrer noopener',
              style: { textDecoration: 'none' },
            }, '用链接登录 ↗') : null,
            (phase === 'expired' || phase === 'error') ? h(Btn, { onClick: start }, '刷新二维码') : null,
            h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' } },
              h('input', { type: 'checkbox', checked: rememberQr, onChange: function (e) { setRememberQr(e.target.checked) } }),
              '记住账号（扫码登录）'))),

        error ? h('div', { className: '__bl_err' }, error) : null,

        /* ④ 手动导入 Cookie —— 不折叠，永远展开 */
        h('div', { className: '__bl_field' },
          h('div', { style: { fontSize: 15, fontWeight: 600 } }, '手动粘贴 Cookie'),
          h('textarea', {
            className: '__bl_input __bl_textarea',
            placeholder: 'SESSDATA=xxx; bili_jct=xxx; DedeUserID=xxx',
            value: cookie,
            onChange: function (e) { setCookie(e.target.value) },
          }),
          h('div', { className: '__bl_sub' }, '在浏览器登录 bilibili.com → F12 → Network → 任意请求的 Cookie 头整段复制。'),
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' } },
            h('input', { type: 'checkbox', checked: rememberCookie, onChange: function (e) { setRememberCookie(e.target.checked) } }),
            '记住账号（Cookie 导入）'),
          h(Btn, { disabled: busy || !cookie.trim(), onClick: importCookie }, busy ? '导入中…' : '导入 Cookie')))
    }

    /* ── 视频卡片 ──────────────────────────────────────────────────────── */
    function VideoCard(props) {
      var v = props.video
      return h('div', { className: '__bl_card', onClick: function () { props.onOpen(v) } },
        v.pic ? h('img', { className: '__bl_cover', src: v.pic + (v.pic.indexOf('@') >= 0 ? '' : '@640w_400h_1c'), alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }) : h('div', { className: '__bl_cover' }),
        h('div', { className: '__bl_cardBody' },
          h('div', { className: '__bl_title' }, v.title),
          h('div', { className: '__bl_meta' },
            h('span', null, '▶ ' + fmtNum(v.stat && v.stat.view)),
            h('span', null, '💬 ' + fmtNum(v.stat && v.stat.danmaku)),
            v.owner && v.owner.name ? h('span', null, '@' + v.owner.name) : null,
            v.duration ? h('span', null, fmtTime(v.duration)) : null)))
    }

    /* ── 视频详情 ──────────────────────────────────────────────────────── */
    function DetailView(props) {
      var v = props.video
      var loggedIn = props.loggedIn !== false
      var [detail, setDetail] = React.useState(null)
      var [cmts, setCmts] = React.useState({ items: [], total: 0, loading: true })
      var [text, setText] = React.useState('')
      var [busy, setBusy] = React.useState('')
      var [liked, setLiked] = React.useState(false)
      var [fav, setFav] = React.useState(false)
      var [msg, setMsg] = React.useState('')
      var [related, setRelated] = React.useState([])
      var [reportOpen, setReportOpen] = React.useState(false)
      var [reportReason, setReportReason] = React.useState('2')
      var [reportDesc, setReportDesc] = React.useState('')
      var [qualities, setQualities] = React.useState([])
      var [allQualities, setAllQualities] = React.useState([])
      var [vip, setVip] = React.useState(false)
      var [qn, setQn] = React.useState(32) // 默认 480P 起步，想高清自己切
      var [relOpen, setRelOpen] = React.useState(false)

      var REPORT_REASONS = [
        ['2', '色情低俗'], ['4', '血腥暴力'], ['5', '人身攻击'],
        ['6', '青少年不良信息'], ['7', '引战'], ['1', '违法违规'],
        ['3', '赌博诈骗'], ['8', '其他'],
      ]

      React.useEffect(function () {
        var alive = true
        setRelated([])
        api('/related?bvid=' + encodeURIComponent(v.bvid))
          .then(function (r) { if (alive && r && r.ok) setRelated(r.items || []) })
          .catch(function () {})
        return function () { alive = false }
      }, [v.bvid])

      // 清晰度档位：按当前账号身份拿 support_formats（大会员自动包含 4K/杜比）
      React.useEffect(function () {
        if (!loggedIn) return
        var c = (detail && detail.cid) || v.cid
        if (!c) return
        var alive = true
        api('/qualities?bvid=' + encodeURIComponent(v.bvid) + '&cid=' + encodeURIComponent(c))
          .then(function (r) {
            if (!alive || !r || !r.ok) return
            setQualities(r.formats || [])
            setAllQualities(r.all || [])
            setVip(r.vip === true)
            var list = r.formats || []
            // 默认 480P 起步；没有 480P 就用最低可用档
            var p480 = list.filter(function (f) { return f.quality === 32 })[0]
            var pick = p480 || list[0]
            if (pick) setQn(pick.quality)
          })
          .catch(function () {})
        return function () { alive = false }
      }, [detail && detail.cid, loggedIn, v.bvid])

      React.useEffect(function () {
        var alive = true
        api('/video?bvid=' + encodeURIComponent(v.bvid)).then(function (r) {
          if (!alive) return
          if (r && r.ok) {
            setDetail(r.video)
            setFav(Boolean(r.video && r.video.favorited))
            setLiked(Boolean(r.video && r.video.liked))
          }
          loadComments()
        }).catch(function () {})
        return function () { alive = false }
      }, [v.bvid])

      var loadComments = function () {
        setCmts({ items: [], total: 0, loading: true })
        api('/comments?aid=' + encodeURIComponent((detail && detail.aid) || v.aid) + '&pn=1').then(function (r) {
          setCmts({ items: (r && r.items) || [], total: (r && r.total) || 0, loading: false })
        }).catch(function () { setCmts({ items: [], total: 0, loading: false }) })
      }

      React.useEffect(function () { if (detail && detail.aid) loadComments() }, [detail && detail.aid])

      var flash = function (t) { setMsg(t); setTimeout(function () { setMsg('') }, 3200) }
      // B 站账号未转正时互动接口报「账号未转正」——翻译成人话
      var friendly = function (t) {
        t = String(t || '')
        if (t.indexOf('未转正') >= 0) {
          return t + '（你的账号还没转正：新注册账号需要去 B 站「我的」页完成转正答题，通过后才能发评论 / 弹幕 / 投币）'
        }
        return t
      }

      var doLike = async function () {
        if (busy) return
        if (!loggedIn) { flash('点赞需要先登录'); if (props.onNeedLogin) props.onNeedLogin(); return }
        setBusy('like')
        try {
          var r = await postJson('/like', { bvid: v.bvid, like: !liked })
          if (r && r.ok) { setLiked(r.liked); flash(r.liked ? '已点赞' : '已取消点赞') }
          else flash((r && r.error) || '点赞失败')
        } catch (e) { flash(e.message || '点赞失败') }
        finally { setBusy('') }
      }

      var doComment = async function () {
        if (busy || !text.trim()) return
        if (!loggedIn) { flash('评论需要先登录'); if (props.onNeedLogin) props.onNeedLogin(); return }
        setBusy('comment')
        try {
          var r = await postJson('/comment', { aid: (detail && detail.aid) || v.aid, message: text.trim() })
          if (r && r.ok) { setText(''); flash('评论已发布'); loadComments() }
          else flash(friendly((r && r.error) || '评论失败'))
        } catch (e) { flash(friendly(e.message || '评论失败')) }
        finally { setBusy('') }
      }

      var doRepost = async function () {
        if (busy) return
        if (!loggedIn) { flash('转发需要先登录'); if (props.onNeedLogin) props.onNeedLogin(); return }
        setBusy('repost')
        try {
          var r = await postJson('/repost', { bvid: v.bvid, text: '转发视频：' + v.title })
          flash(r && r.ok ? '已转发到动态' : ((r && r.error) || '转发失败'))
        } catch (e) { flash(e.message || '转发失败') }
        finally { setBusy('') }
      }

      var doCoin = async function () {
        if (busy) return
        if (!loggedIn) { flash('投币需要先登录'); if (props.onNeedLogin) props.onNeedLogin(); return }
        setBusy('coin')
        try {
          var r = await postJson('/coin', { bvid: v.bvid })
          flash(r && r.ok ? '已投币 1 枚' : ((r && r.error) || '投币失败'))
        } catch (e) { flash(e && e.message ? e.message : '投币失败') }
        finally { setBusy('') }
      }

      var doFav = async function () {
        if (busy) return
        if (!loggedIn) { flash('收藏需要先登录'); if (props.onNeedLogin) props.onNeedLogin(); return }
        setBusy('fav')
        try {
          var aid = (detail && detail.aid) || v.aid
          var r = await postJson('/favorite', { aid: String(aid), fav: !fav })
          if (r && r.ok) { setFav(r.favorited); flash(r.favorited ? '已收藏 ⭐' : '已取消收藏') }
          else flash((r && r.error) || '收藏失败')
        } catch (e) { flash(e && e.message ? e.message : '收藏失败') }
        finally { setBusy('') }
      }

      var doReport = async function () {
        if (busy) return
        if (!loggedIn) { flash('举报需要先登录'); if (props.onNeedLogin) props.onNeedLogin(); return }
        setBusy('report')
        try {
          var r = await postJson('/report', {
            aid: (detail && detail.aid) || v.aid,
            title: (detail && detail.title) || v.title,
            reasonId: reportReason,
            desc: reportDesc.trim(),
          })
          if (r && r.ok) { setReportOpen(false); setReportDesc(''); flash('举报已提交') }
          else flash((r && r.error) || '举报失败')
        } catch (e) { flash(e && e.message ? e.message : '举报失败') }
        finally { setBusy('') }
      }

      var d = detail || v
      var cid = d.cid || v.cid || ''
      var streamUrl = API + '/stream?bvid=' + encodeURIComponent(v.bvid) + '&cid=' + encodeURIComponent(cid) + '&qn=' + qn
      // 登录 → 直连高清（1080p）；未登录 → 官方 iframe（480p）
      var [playerMode, setPlayerMode] = React.useState(loggedIn && cid ? 'stream' : 'embed')
      var embedUrl = 'https://player.bilibili.com/player.html?bvid=' + v.bvid
        + '&autoplay=1&danmaku=0&high_quality=1&as_wide=1'

      var player
      if (playerMode === 'stream' && cid) {
        player = h('video', {
          className: '__bl_frame',
          src: streamUrl,
          controls: true,
          autoPlay: true,
          playsInline: true,
          onError: function () { setPlayerMode('embed') },
        })
      } else {
        player = h('iframe', {
          className: '__bl_frame',
          src: embedUrl,
          allowFullScreen: true,
          allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture',
          referrerPolicy: 'no-referrer',
        })
      }

      return h('div', { className: '__bl_detail' },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          h(Btn, { onClick: props.onBack }, '← 返回'),
          h('div', { className: '__bl_title', style: { fontSize: 17, flex: 1 } }, d.title)),
        h('div', { className: '__bl_frameWrap' }, player),
        h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
          loggedIn ? h('button', {
            type: 'button',
            className: '__bl_sub',
            style: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13 },
            onClick: function () { setPlayerMode(playerMode === 'stream' ? 'embed' : 'stream') },
          }, playerMode === 'stream' ? '切官方播放器（弹幕）' : '切直连高清') : null,
          (playerMode === 'stream' && allQualities.length > 0) ? h('select', {
            className: '__bl_input',
            style: { width: 'auto', maxWidth: 250, padding: '6px 10px' },
            value: String(qn),
            onChange: function (e) {
              var q = Number(e.target.value)
              var tier = allQualities.filter(function (t) { return t.quality === q })[0] || {}
              if (tier.needVip && !vip) { flash('该清晰度需要大会员，请前往客户端充值后使用'); return }
              if (tier.needLogin && !loggedIn) { flash('该清晰度需要登录'); return }
              setQn(q)
            },
          }, allQualities.map(function (t) {
            var avail = qualities.some(function (f) { return f.quality === t.quality })
            var label = t.label
            if (t.needVip) label += ' · 👑大会员'
            else if (t.needLogin) label += ' · 🔒登录'
            if (!avail) label += '（本视频无此档）'
            return h('option', { key: t.quality, value: String(t.quality) }, label)
          })) : null,
          h('div', { className: '__bl_sub' },
            loggedIn
              ? (playerMode === 'stream' ? '直连播放：登录后的清晰度，可在下拉里换挡' : '官方播放器：无登录态（480p）')
              : '未登录用官方播放器（480p）。登录后自动切直连高清。')),
        /* UP 主信息：头像 + 账号名，点击进主页 */
        d.owner && d.owner.name ? h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 0' } },
          d.owner.face
            ? h('img', {
              className: '__bl_userFace __bl_faceLink',
              style: { width: 48, height: 48, borderWidth: 1 },
              src: String(d.owner.face).replace(/^http:/, 'https:'),
              alt: '',
              referrerPolicy: 'no-referrer',
              onClick: function () { if (props.onOpenUser && d.owner.mid) props.onOpenUser({ mid: d.owner.mid, name: d.owner.name }) },
            })
            : null,
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
            h('button', {
              type: 'button',
              style: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 16, fontWeight: 700, textAlign: 'left', color: 'var(--dsw-alias-label-primary,#e6edf3)' },
              onClick: function () { if (props.onOpenUser && d.owner.mid) props.onOpenUser({ mid: d.owner.mid, name: d.owner.name }) },
            }, d.owner.name),
            h('div', { className: '__bl_sub' }, d.owner.mid ? 'UP 主 · 点击查看主页' : 'UP 主')),
          d.owner.mid ? h(Btn, { onClick: function () { props.onOpenUser({ mid: d.owner.mid, name: d.owner.name }) } }, '主页 ›') : null) : null,

        /* 原生式操作栏：数据和交互按钮同一行 */
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 0 2px' } },
          h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
            h(Btn, { kind: liked ? 'pink' : '', disabled: busy === 'like', onClick: doLike }, busy === 'like' ? '处理中…' : (liked ? '❤ 已点赞' : '🤍 点赞')),
            h(Btn, { disabled: busy === 'coin', onClick: doCoin }, busy === 'coin' ? '投币中…' : '🪙 投币'),
            h(Btn, { kind: fav ? 'pink' : '', disabled: busy === 'fav', onClick: doFav }, busy === 'fav' ? '处理中…' : (fav ? '⭐ 已收藏' : '⭐ 收藏')),
            h(Btn, { kind: 'blue', disabled: busy === 'repost', onClick: doRepost }, busy === 'repost' ? '转发中…' : '↗ 转发到动态'),
            h(Btn, { disabled: busy === 'report', onClick: function () { setReportOpen(!reportOpen) } }, '🚩 举报')),
          h('div', { className: '__bl_meta' },
            h('span', null, '▶ ' + fmtNum(d.stat && d.stat.view)),
            h('span', null, '👍 ' + fmtNum(d.stat && d.stat.like)),
            h('span', null, '💬 ' + fmtNum(d.stat && d.stat.reply)),
            h('span', null, '🪙 ' + fmtNum(d.stat && d.stat.coin)),
            h('span', null, '⭐ ' + fmtNum(d.stat && d.stat.favorite)),
            d.pubdate ? h('span', null, ago(d.pubdate)) : null),
          h('a', { className: '__bl_btn', href: 'https://www.bilibili.com/video/' + v.bvid, target: '_blank', rel: 'noreferrer noopener', style: { textDecoration: 'none' } }, '在浏览器打开')),
        reportOpen ? h('div', { className: '__bl_field', style: { maxWidth: 460 } },
          h('select', {
            className: '__bl_input',
            value: reportReason,
            onChange: function (e) { setReportReason(e.target.value) },
          }, REPORT_REASONS.map(function (pair) {
            return h('option', { key: pair[0], value: pair[0] }, pair[1])
          })),
          h('textarea', {
            className: '__bl_input __bl_textarea',
            placeholder: '举报说明（选填，最多 200 字）',
            value: reportDesc,
            maxLength: 200,
            onChange: function (e) { setReportDesc(e.target.value) },
          }),
          h('div', { style: { display: 'flex', gap: 10 } },
            h(Btn, { kind: 'pink', disabled: busy === 'report', onClick: doReport }, busy === 'report' ? '提交中…' : '提交举报')))
          : null,
        d.desc ? h('div', { className: '__bl_sub', style: { lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' } }, d.desc) : null,
        related.length ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          h('button', {
            type: 'button',
            className: '__bl_sub',
            style: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontSize: 13 },
            onClick: function () { setRelOpen(!relOpen) },
          }, (relOpen ? '▾ 相关推荐 ' : '▸ 相关推荐 ') + related.length + ' 个'),
          relOpen ? h('div', { className: '__bl_relRow' }, related.map(function (r) {
            return h('div', { key: r.bvid, className: '__bl_relCard', onClick: function () { if (props.onOpen) props.onOpen(r) } },
              r.pic
                ? h('img', { className: '__bl_relCover', src: r.pic + '@480w_300h_1c', alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' })
                : h('div', { className: '__bl_relCover' }),
              h('div', { className: '__bl_relTitle' }, r.title))
          })) : null) : null,
        h('div', { className: '__bl_cmt' },
          h('div', { style: { fontSize: 16, fontWeight: 700 } }, '评论 ' + (cmts.total ? '(' + fmtNum(cmts.total) + ')' : '')),
          h('div', { className: '__bl_cmtRow' },
            h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 } },
              props.user && props.user.level === 0 ? h('div', { className: '__bl_sub', style: { lineHeight: 1.7 } },
                '⚠ 你的账号还未转正，暂时不能发评论 / 弹幕 / 投币。',
                h('a', {
                  href: 'https://www.bilibili.com/',
                  target: '_blank',
                  rel: 'noreferrer noopener',
                  style: { marginLeft: 4 },
                }, '去 B 站「我的」页完成转正答题 ↗')) : null,
              h('textarea', {
                className: '__bl_input __bl_textarea',
                placeholder: '发一条友善的评论…',
                value: text,
                maxLength: 500,
                onChange: function (e) { setText(e.target.value) },
              }),
              h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
                h(Btn, { kind: 'pink', disabled: busy === 'comment' || !text.trim(), onClick: doComment }, busy === 'comment' ? '发布中…' : '发表评论'),
                h('span', { className: '__bl_sub' }, text.length + '/500')))),
          cmts.loading ? h('div', { className: '__bl_sub' }, '正在加载评论…') : null,
          cmts.items.map(function (c) {
            return h('div', { className: '__bl_cmtRow', key: c.rpid },
              c.avatar
                ? h('img', {
                  className: '__bl_avatar __bl_faceLink',
                  src: c.avatar,
                  alt: '',
                  referrerPolicy: 'no-referrer',
                  onClick: function () { if (c.mid && props.onOpenUser) props.onOpenUser({ mid: c.mid, name: c.user }) },
                })
                : h('div', { className: '__bl_avatar' }),
              h('div', { className: '__bl_cmtBody' },
                h('div', { className: '__bl_cmtUser' },
                  h('button', {
                    type: 'button',
                    style: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--bl-blue)', fontWeight: 600 },
                    onClick: function () { if (c.mid && props.onOpenUser) props.onOpenUser({ mid: c.mid, name: c.user }) },
                  }, c.user),
                  h('span', { className: '__bl_sub', style: { marginLeft: 8 } }, ago(c.ctime))),
                h('div', { className: '__bl_cmtText' }, c.message),
                h('div', { className: '__bl_meta', style: { marginTop: 2 } }, h('span', null, '👍 ' + c.like))))
          }),
          !cmts.loading && cmts.items.length === 0 ? h('div', { className: '__bl_sub' }, '还没有评论') : null),
        h(Toast, { text: msg }))
    }

    /* ── UP 主主页 ────────────────────────────────────────────────────── */
    function UserView(props) {
      var [card, setCard] = React.useState(null)
      var [videos, setVideos] = React.useState([])
      var [dyns, setDyns] = React.useState([])
      var [tab, setTab] = React.useState('videos')
      var [following, setFollowing] = React.useState(false)
      var [busy, setBusy] = React.useState('')
      var [msg, setMsg] = React.useState('')
      var [msgOpen, setMsgOpen] = React.useState(false)
      var [msgText, setMsgText] = React.useState('')
      var [msgSending, setMsgSending] = React.useState(false)
      var [msgHistory, setMsgHistory] = React.useState([])
      var [msgMe, setMsgMe] = React.useState(0)
      var flash = function (t) { setMsg(t); setTimeout(function () { setMsg('') }, 3200) }

      // 单独抽出来：关注切换后重新拉名片，按钮和粉丝数实时同步
      var loadCard = function () {
        api('/user?mid=' + encodeURIComponent(props.mid)).then(function (r) {
          if (r && r.ok) { setCard(r.card); setFollowing(r.card && r.card.following) }
        }).catch(function () {})
      }

      React.useEffect(function () {
        setCard(null); setVideos([]); setDyns([]); setMsgOpen(false); setMsgHistory([])
        loadCard()
        api('/uservideos?mid=' + encodeURIComponent(props.mid)).then(function (r) {
          if (r && r.ok) setVideos(r.items || [])
        }).catch(function () {})
        api('/userdynamics?mid=' + encodeURIComponent(props.mid)).then(function (r) {
          if (r && r.ok) setDyns(r.items || [])
        }).catch(function () {})
      }, [props.mid])

      var doFollow = async function () {
        if (!props.loggedIn) { flash('关注需要先登录'); return }
        if (busy) return
        setBusy('follow')
        try {
          var r = await postJson('/follow', { mid: String(props.mid), act: following ? '2' : '1' })
          if (r && r.ok) {
            setFollowing(r.following)
            flash(r.following ? '已关注' : '已取消关注')
            loadCard() // 粉丝数 / 关注状态从服务端再同步一次
          } else flash((r && r.error) || '操作失败')
        } catch (e) { flash(e && e.message ? e.message : '操作失败') }
        finally { setBusy('') }
      }

      var loadHistory = function () {
        api('/message/history?mid=' + encodeURIComponent(props.mid)).then(function (r) {
          if (r && r.ok) { setMsgHistory(r.items || []); setMsgMe(r.me || 0) }
        }).catch(function () {})
      }

      var doSendMsg = async function () {
        if (!props.loggedIn) { flash('发私信需要先登录'); return }
        var text = msgText.trim()
        if (!text || msgSending) return
        setMsgSending(true)
        try {
          var r = await postJson('/message/send', { mid: String(props.mid), text: text })
          if (r && r.ok) {
            setMsgText('')
            setMsgHistory(function (prev) { return prev.concat([{ sender: msgMe, content: text, time: Date.now() / 1000 }]) })
            flash('私信已发送')
          } else {
            flash('私信失败：' + ((r && r.error) || '未知错误') + (r && r.code ? '（code ' + r.code + '）' : ''))
          }
        } catch (e) { flash(e && e.message ? e.message : '发送失败') }
        finally { setMsgSending(false) }
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          h(Btn, { onClick: props.onBack }, '← 返回'),
          h('div', { style: { fontSize: 16, fontWeight: 700 } }, 'UP 主主页')),
        card ? h('div', { className: '__bl_userHead' },
          card.face ? h('img', { className: '__bl_userFace', src: String(card.face).replace(/^http:/, 'https:'), alt: '', referrerPolicy: 'no-referrer' }) : null,
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
              h('span', { className: '__bl_userName' }, card.name || props.name || ''),
              card.level ? h('span', { className: '__bl_tag' }, 'Lv' + card.level) : null,
              card.official ? h('span', { className: '__bl_tag', style: { color: '#d29922' } }, card.official) : null),
            h('div', { className: '__bl_meta' },
              h('span', null, '粉丝 ' + fmtNum(card.fans)),
              h('span', null, '关注 ' + fmtNum(card.attention)),
              h('span', null, 'UID ' + (card.mid || props.mid))),
            card.sign ? h('div', { className: '__bl_sub' }, card.sign) : null),
          h('div', { style: { marginLeft: 'auto', display: 'flex', gap: 10 } },
            h(Btn, { kind: following ? '' : 'pink', disabled: busy === 'follow', onClick: doFollow }, busy === 'follow' ? '处理中…' : (following ? '已关注' : '+ 关注')),
            h(Btn, { onClick: function () { var next = !msgOpen; setMsgOpen(next); if (next) loadHistory() } }, '私信'))) : h('div', { className: '__bl_sub' }, '正在加载…'),
        msg ? h('div', { className: '__bl_sub' }, msg) : null,
        msgOpen ? h('div', { className: '__bl_field' },
          h('div', { style: { maxHeight: 220, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 } },
            msgHistory.length === 0 ? h('div', { className: '__bl_sub' }, '暂无历史（若对方不接受陌生人私信，发送也会被拒）') : null,
            msgHistory.map(function (m, i) {
              var mine = m.sender === msgMe
              return h('div', {
                key: i,
                style: {
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  background: mine ? 'rgba(0,174,236,.18)' : 'var(--dsw-alias-bg-layer-3,#21262d)',
                  borderRadius: 10,
                  padding: '6px 10px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                },
              }, m.content)
            })),
          h('div', { style: { display: 'flex', gap: 8 } },
            h('input', {
              className: '__bl_input',
              placeholder: '发条私信…',
              value: msgText,
              onChange: function (e) { setMsgText(e.target.value) },
              onKeyDown: function (e) { if (e.key === 'Enter') doSendMsg() },
            }),
            h(Btn, { kind: 'pink', disabled: msgSending || !msgText.trim(), onClick: doSendMsg }, msgSending ? '发送中…' : '发送'))) : null,
        h('div', { className: '__bl_tabs' },
          h('button', { type: 'button', className: tab === 'videos' ? '__bl_tab __bl_tabOn' : '__bl_tab', onClick: function () { setTab('videos') } }, '视频 ' + videos.length),
          h('button', { type: 'button', className: tab === 'dyn' ? '__bl_tab __bl_tabOn' : '__bl_tab', onClick: function () { setTab('dyn') } }, '动态 ' + dyns.length)),
        msg ? h('div', { className: '__bl_sub' }, msg) : null,
        tab === 'videos'
          ? h('div', { style: { maxHeight: 560, overflow: 'auto' } },
              h('div', { className: '__bl_grid' }, videos.map(function (v) {
                return h(VideoCard, { key: v.bvid, video: v, onOpen: props.onOpen })
              })))
          : (dyns.length === 0
              ? h('div', { className: '__bl_sub' }, '没有动态，或动态接口被风控（稍后再试）')
              : h('div', { style: { maxHeight: 560, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 } }, dyns.map(function (d) {
                  return h('div', { key: d.id, className: '__bl_dyn' },
                    h('div', { className: '__bl_meta' },
                      h('span', { className: '__bl_tag' }, d.type),
                      d.time ? h('span', null, ago(d.time)) : null),
                    d.text ? h('div', { style: { fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' } }, d.text) : null,
                    d.bvid ? h(Btn, { onClick: function () { props.onOpen({ bvid: d.bvid, title: String(d.text || '').slice(0, 30) }) } }, '看视频 ↗') : null)
                }))))
    }

    /* ── 主面板 ────────────────────────────────────────────────────────── */
    var TABS = [['feed', '推荐'], ['search', '搜索']]

    /* 登录后的个人主页：1:1 大头像 + 账号信息 */
    function ProfileView(props) {
      var u = props.user || {}
      var [tab, setTab] = React.useState('videos')
      var [items, setItems] = React.useState([])
      var [loading, setLoading] = React.useState(false)
      var [error, setError] = React.useState('')

      var load = async function (which) {
        setTab(which)
        setLoading(true); setItems([]); setError('')
        try {
          var r
          if (which === 'videos') r = await api('/uservideos?mid=' + encodeURIComponent(u.mid))
          else if (which === 'dyn') r = await api('/userdynamics?mid=' + encodeURIComponent(u.mid))
          else if (which === 'fav') r = await api('/myfavorites')
          else r = await api('/myfollowings')
          if (r && r.ok) setItems(r.items || [])
          else setError((r && r.error) || '加载失败')
        } catch (e) { setError(e && e.message ? e.message : '加载失败') }
        finally { setLoading(false) }
      }

      React.useEffect(function () { if (u.mid) load('videos') }, [u.mid])

      var content
      if (tab === 'followings') {
        content = h('div', { style: { maxHeight: 520, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 } },
          items.map(function (f) {
            return h('div', { key: f.mid, style: { display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--dsw-alias-border-l2,#30363d)', borderRadius: 10, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2,#161b22)' } },
              f.face ? h('img', { className: '__bl_avatar __bl_faceLink', src: String(f.face).replace(/^http:/, 'https:'), alt: '', referrerPolicy: 'no-referrer', onClick: function () { if (props.onOpenUser) props.onOpenUser({ mid: f.mid, name: f.name }) } }) : null,
              h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 } },
                h('button', { type: 'button', style: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 600, textAlign: 'left', color: 'var(--dsw-alias-label-primary,#e6edf3)' }, onClick: function () { if (props.onOpenUser) props.onOpenUser({ mid: f.mid, name: f.name }) } }, f.name),
                f.sign ? h('div', { className: '__bl_sub', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, f.sign) : null),
              h(Btn, { onClick: function () { if (props.onOpenUser) props.onOpenUser({ mid: f.mid, name: f.name }) } }, '主页 ›'))
          }))
      } else if (tab === 'dyn') {
        content = h('div', { style: { maxHeight: 520, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 } },
          items.map(function (d) {
            return h('div', { key: d.id, className: '__bl_dyn' },
              h('div', { className: '__bl_meta' },
                h('span', { className: '__bl_tag' }, d.type),
                d.time ? h('span', null, ago(d.time)) : null),
              d.text ? h('div', { style: { fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' } }, d.text) : null,
              d.bvid ? h(Btn, { onClick: function () { if (props.onOpen) props.onOpen({ bvid: d.bvid, title: String(d.text || '').slice(0, 30) }) } }, '看视频 ↗') : null)
          }))
      } else {
        content = h('div', { style: { maxHeight: 520, overflow: 'auto' } },
          h('div', { className: '__bl_grid' }, items.map(function (v) {
            return h(VideoCard, { key: v.bvid, video: v, onOpen: props.onOpen || (function () {}) })
          })))
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        h('div', { style: { display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' } },
          u.face
            ? h('img', { src: u.face, alt: '', referrerPolicy: 'no-referrer', style: { width: 160, height: 160, objectFit: 'cover', borderRadius: 14, border: '1px solid var(--dsw-alias-border-l2,#30363d)', flex: '0 0 auto' } })
            : h('div', { style: { width: 160, height: 160, borderRadius: 14, background: 'var(--dsw-alias-bg-layer-3,#21262d)' } }),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 240 } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
              h('span', { style: { fontSize: 22, fontWeight: 700 } }, u.uname || ''),
              u.level ? h('span', { className: '__bl_tag' }, 'Lv' + u.level) : null,
              u.vip ? h('span', { className: '__bl_tag', style: { background: 'rgba(251,192,45,.18)', color: '#fbc02d' } }, '大会员') : null),
            h('div', { className: '__bl_sub' }, 'UID ' + (u.mid || '')),
            h('div', { className: '__bl_meta' },
              h('span', null, '🪙 硬币 ' + (u.coins || 0)),
              h('span', null, '等级 Lv' + (u.level || 0))),
            h('a', { className: '__bl_btn', href: 'https://space.bilibili.com/' + (u.mid || ''), target: '_blank', rel: 'noreferrer noopener', style: { textDecoration: 'none', alignSelf: 'flex-start' } }, '打开个人空间 ↗'))),
        h('div', { className: '__bl_tabs' },
          h('button', { type: 'button', className: tab === 'videos' ? '__bl_tab __bl_tabOn' : '__bl_tab', onClick: function () { load('videos') } }, '我发布的'),
          h('button', { type: 'button', className: tab === 'dyn' ? '__bl_tab __bl_tabOn' : '__bl_tab', onClick: function () { load('dyn') } }, '我的动态'),
          h('button', { type: 'button', className: tab === 'fav' ? '__bl_tab __bl_tabOn' : '__bl_tab', onClick: function () { load('fav') } }, '我收藏的'),
          h('button', { type: 'button', className: tab === 'followings' ? '__bl_tab __bl_tabOn' : '__bl_tab', onClick: function () { load('followings') } }, '我关注的')),
        loading ? h('div', { className: '__bl_sub' }, '正在加载…') : null,
        error ? h('div', { className: '__bl_sub' }, error) : null,
        !loading && !error && items.length === 0 ? h('div', { className: '__bl_sub' }, '这里还是空的') : null,
        content)
    }

    function Panel() {
      var [session, setSession] = React.useState(null)
      var [booting, setBooting] = React.useState(true)
      var [tab, setTab] = React.useState('feed')
      var [list, setList] = React.useState({ items: [], loading: false, error: '' })
      var [term, setTerm] = React.useState('')
      var [detail, setDetail] = React.useState(null)
      var [userPage, setUserPage] = React.useState(null)
      var [msg, setMsg] = React.useState('')
      var [showLogin, setShowLogin] = React.useState(false)
      var [hot, setHot] = React.useState([])

      var flash = function (t) { setMsg(t); setTimeout(function () { setMsg('') }, 2600) }

      var loadSession = React.useCallback(async function () {
        setBooting(true)
        try { setSession(await api('/session')) } catch (e) { setSession({ ok: false, loggedIn: false }) }
        finally { setBooting(false) }
      }, [])

      React.useEffect(function () { loadSession() }, [])
      React.useEffect(function () {
        api('/hotsearch').then(function (r) { if (r && r.ok) setHot(r.items || []) }).catch(function () {})
      }, [])

      var loadTab = React.useCallback(async function (which, keyword) {
        setList({ items: [], loading: true, error: '' })
        try {
          var data
          if (which === 'search') {
            if (!keyword || !keyword.trim()) { setList({ items: [], loading: false, error: '' }); return }
            data = await api('/search?q=' + encodeURIComponent(keyword.trim()))
          } else if (which === 'follow') {
            data = await api('/followfeed')
          } else {
            data = await api('/feed')
          }
          if (data && data.ok === false) setList({ items: [], loading: false, error: data.error || '加载失败' })
          else setList({ items: (data && data.items) || [], loading: false, error: '' })
        } catch (e) {
          setList({ items: [], loading: false, error: e && e.message ? e.message : String(e) })
        }
      }, [])

      React.useEffect(function () { if (!detail) loadTab(tab) }, [tab, detail])

      var onLoggedIn = function (result) {
        setSession({ ok: true, loggedIn: true, user: result.user, version: (session && session.version) || '1.0.0' })
        setShowLogin(false)
        flash('登录成功')
      }

      var logout = async function () {
        var ok = false
        try {
          var r = await postJson('/logout', {})
          ok = Boolean(r && r.ok)
        } catch (e) { ok = false }
        if (!ok) {
          // 主机端没退成（比如页面还连在旧宿主上），明确告诉用户，
          // 不再静默假装退出——否则重启后“账号又回来了”
          flash('退出失败：主机没有响应。请完全重启 DSH 后再退一次')
        }
        setSession({ ok: true, loggedIn: false, user: null })
        setDetail(null)
      }

      var loggedIn = Boolean(session && session.loggedIn)
      var user = session && session.user

      // 未登录也能刷：只有点赞 / 评论 / 转发需要账号
      var body
      if (booting) body = h('div', { className: '__bl_empty' }, '正在加载…')
      else if (showLogin) body = h(LoginView, { onLoggedIn: onLoggedIn, onBack: function () { setShowLogin(false) } })
      else if (detail) body = h(DetailView, {
        video: detail,
        loggedIn: loggedIn,
        user: user || null,
        onNeedLogin: function () { setShowLogin(true) },
        onOpen: function (next) { setDetail(next) },
        onOpenUser: function (u) { setDetail(null); setUserPage(u) },
        onBack: function () { setDetail(null) },
      })
      else if (userPage) body = h(UserView, {
        mid: userPage.mid,
        name: userPage.name,
        loggedIn: loggedIn,
        onOpen: function (v) { setUserPage(null); setDetail(v) },
        onBack: function () { setUserPage(null) },
      })
      else if (tab === 'me') body = h(ProfileView, {
        user: user || {},
        onOpen: function (v) { setDetail(v) },
        onOpenUser: function (x) { setUserPage(x) },
      })
      else {
        body = h(React.Fragment, null,
          tab === 'search' ? h('div', { className: '__bl_searchRow' },
            h('input', {
              className: '__bl_input',
              placeholder: '搜索视频，回车确认',
              value: term,
              onChange: function (e) { setTerm(e.target.value) },
              onKeyDown: function (e) { if (e.key === 'Enter') loadTab('search', term) },
            }),
            h(Btn, { kind: 'pink', onClick: function () { loadTab('search', term) } }, '搜索')) : null,
          tab === 'search' && hot.length > 0 ? h('div', { className: '__bl_tags' },
            h('span', { className: '__bl_sub' }, '🔥 热点：'),
            hot.map(function (w) {
              return h('button', {
                type: 'button',
                key: w.keyword,
                className: '__bl_chip',
                onClick: function () { setTerm(w.keyword); loadTab('search', w.keyword) },
              }, w.show)
            })) : null,
          list.error ? h('div', { className: '__bl_err' }, list.error) : null,
          list.loading ? h('div', { className: '__bl_empty' }, '正在加载…') : null,
          !list.loading && !list.error && list.items.length === 0
            ? h('div', { className: '__bl_empty' }, tab === 'search' ? '输入关键词后回车搜索' : '暂无内容')
            : null,
          h('div', { className: '__bl_grid' }, list.items.map(function (v) {
            if (v.kind === 'live') {
              return h('div', { key: 'live-' + v.roomid, className: '__bl_card' },
                v.pic ? h('img', { className: '__bl_cover', src: v.pic, alt: '', referrerPolicy: 'no-referrer' }) : h('div', { className: '__bl_cover' }),
                h('div', { className: '__bl_cardBody' },
                  h('div', { className: '__bl_title' }, '🔴 ' + v.title),
                  h('div', { className: '__bl_meta' }, h('span', null, v.owner && v.owner.name)),
                  h('a', { className: '__bl_btn', href: v.liveUrl || ('https://live.bilibili.com/' + v.roomid), target: '_blank', rel: 'noreferrer noopener', style: { textDecoration: 'none', textAlign: 'center' } }, '看直播 ↗')))
            }
            return h(VideoCard, { key: v.bvid, video: v, onOpen: function (x) { setDetail(x) } })
          })))
      }

      return h('div', { className: '__bl_wrap' },
        h('div', { className: '__bl_root' },
          h('div', { className: '__bl_bar' },
            h('div', { className: '__bl_logo' }, '哔哩哔哩',
              h('span', { className: '__bl_sub', style: { fontSize: 11, marginLeft: 6, fontWeight: 400 } }, 'build ' + BUILD)),
            session && session.loggedIn
              ? h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                user && user.face ? h('img', { className: '__bl_avatar', src: user.face, alt: '', referrerPolicy: 'no-referrer' }) : null,
                h('span', { style: { fontSize: 14, fontWeight: 600 } }, (user && user.uname) || '已登录'),
                user && user.level ? h('span', { className: '__bl_tag' }, 'Lv' + user.level) : null)
              : h('span', { className: '__bl_sub' }, '未登录 · 可直接浏览'),
            h('div', { className: '__bl_spacer' }),
            session && session.loggedIn
              ? h(Btn, { onClick: logout }, '退出登录')
              : h(Btn, { kind: 'pink', onClick: function () { setShowLogin(true) } }, '登录'),
            h(Btn, { onClick: function () { if (detail) setDetail(null); else loadTab(tab, term) } }, '刷新')),
          !detail && !showLogin && !userPage ? h('div', { className: '__bl_tabs' }, (loggedIn ? TABS.concat([['follow', '关注'], ['me', '我的']]) : TABS).map(function (pair) {
            return h('button', {
              key: pair[0],
              type: 'button',
              className: '__bl_tab' + (tab === pair[0] ? ' __bl_tabOn' : ''),
              onClick: function () { setTab(pair[0]) },
            }, pair[1])
          })) : null,
          h('div', { className: '__bl_body' }, body)),
        h('div', { className: '__bl_sub' }, 'dsh-bilibili v' + ((session && session.version) || '1.0.0') + ' · Cookie 仅存本机 · 接口只对 127.0.0.1 开放'),
        h(Toast, { text: msg }))
    }

    /* ── 插件 ──────────────────────────────────────────────────────────── */
    var inject = ['slots']
    var PanelBoundary = makeBoundary()
    var PanelHost = function () {
      var panel = h(Panel, {})
      return PanelBoundary ? h(PanelBoundary, null, panel) : panel
    }

    function apply(ctx) {
      try {
        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register(
            { name: 'settings.section', id: 'bilibili', order: 28, label: '哔哩哔哩' },
            function () { return h(PanelHost, {}) })
        })
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) console.error('[dsh-bilibili] 注册设置分区失败：', error)
      }
      try {
        ctx.slots.inject('settings.plugins.tab', function () {
          return ctx.slots.register(
            { name: 'settings.plugins.tab', id: 'bilibili', order: 52, label: '哔哩哔哩' },
            function () { return h(PanelHost, {}) })
        })
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) console.error('[dsh-bilibili] 注册插件标签页失败：', error)
      }
    }

    module.exports = { name: 'dsh-bilibili-client', inject: inject, apply: apply }
    return module.exports
  },
})
