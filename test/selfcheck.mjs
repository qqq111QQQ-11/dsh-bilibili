/**
 * dsh-bilibili 自检：Host 半侧（路由 + 真实网络）+ Web 半侧（bundle 加载）。
 * 纯 Node 运行，不依赖宿主。
 */
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// 测试必须跑在干净的 DSH_HOME 里，避免被本机真实登录态干扰
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-bili-test-'))
const { apply } = await import('../lib/index.js')

const checks = []
const check = async (label, fn) => {
  try { checks.push(['PASS', label, await fn() ?? '']) }
  catch (error) { checks.push(['FAIL', label, error instanceof Error ? error.message : String(error)]) }
}

/* ── Host 半侧 ─────────────────────────────────────────────────────────── */
const routes = new Map()
const webServer = {
  register(spec) {
    if (routes.has(spec.path)) throw new Error('duplicate route ' + spec.path)
    routes.set(spec.path, spec)
    return () => routes.delete(spec.path)
  },
}
const ctx = {
  inject(deps, callback) {
    if (!deps.includes('webServer')) throw new Error('必须依赖 webServer')
    callback({ get: (k) => (k === 'webServer' ? webServer : undefined) })
  },
  logger: { info() {}, warn() {}, error() {} },
  effect() {},
}
apply(ctx, {})

function invoke(method, path, { body, remote = '127.0.0.1' } = {}) {
  const spec = routes.get(path.split('?')[0])
  if (!spec) return Promise.resolve({ status: 404, json: null })
  const req = {
    method,
    url: path,
    headers: { host: '127.0.0.1:5000' },
    socket: { remoteAddress: remote },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body))
    },
  }
  return new Promise((resolve) => {
    let status = 200
    const res = {
      writeHead(code) { status = code },
      end(chunk) { resolve({ status, json: safe(chunk) }) },
    }
    spec.handler(req, res)
  })
}
function safe(text) { try { return JSON.parse(text) } catch { return String(text ?? '') } }

await check('挂载了全部 35 条路由', () => {
  if (routes.size !== 35) throw new Error('实际 ' + routes.size + ' 条')
  return routes.size + ' 条'
})

await check('非本机请求被拒', async () => {
  const r = await invoke('GET', '/plugins/dsh-bilibili/session', { remote: '192.168.1.9' })
  if (r.status !== 403) throw new Error('应 403，实际 ' + r.status)
})

await check('未登录时 /session 返回 loggedIn=false', async () => {
  const r = await invoke('GET', '/plugins/dsh-bilibili/session')
  if (r.status !== 200 || r.json.loggedIn !== false) throw new Error(JSON.stringify(r.json))
})

await check('未登录点赞被拒（-101）', async () => {
  const r = await invoke('POST', '/plugins/dsh-bilibili/like', { body: { bvid: 'BV1xx411c7mD' } })
  if (!r.json || r.json.ok !== false) throw new Error(JSON.stringify(r.json))
  if (String(r.json.error).indexOf('登录') < 0) throw new Error('错误信息不友好: ' + r.json.error)
})

await check('QR 接口真实可用（拿得到二维码内容）', async () => {
  const r = await invoke('GET', '/plugins/dsh-bilibili/login/qr')
  if (!r.json || r.json.ok !== true) throw new Error(JSON.stringify(r.json))
  if (!/^https?:/.test(r.json.url)) throw new Error('url 不像链接: ' + r.json.url)
  if (!r.json.key) throw new Error('缺少 qrcode_key')
  return r.json.url.slice(0, 46) + '…'
})

await check('推荐流真实可用', async () => {
  const r = await invoke('GET', '/plugins/dsh-bilibili/feed')
  if (!r.json || r.json.ok !== true) throw new Error(JSON.stringify(r.json).slice(0, 200))
  const items = r.json.items || []
  if (items.length === 0) throw new Error('推荐流为空')
  const first = items[0]
  if (!/^BV/.test(first.bvid)) throw new Error('bvid 不对: ' + first.bvid)
  if (!first.title) throw new Error('缺少标题')
  return items.length + ' 条，首条：' + first.title.slice(0, 18)
})

await check('未登录也能搜索（WBI 签名）', async () => {
  const r = await invoke('GET', '/plugins/dsh-bilibili/search?q=' + encodeURIComponent('原神'))
  if (!r.json || r.json.ok !== true) throw new Error(JSON.stringify(r.json).slice(0, 200))
  const items = r.json.items || []
  if (items.length === 0) throw new Error('搜索结果为空（未登录应能搜到）')
  return items.length + ' 条，首条：' + String(items[0].title).slice(0, 18)
})

await check('热点推荐真实可用', async () => {
  const r = await invoke('GET', '/plugins/dsh-bilibili/hotsearch')
  if (!r.json || r.json.ok !== true) throw new Error(JSON.stringify(r.json).slice(0, 200))
  const items = r.json.items || []
  if (items.length === 0) throw new Error('热点列表为空（修复：bili() 已剥 data.data，不能再套一层）')
  return r.json.title + ' · ' + items.length + ' 条，首条：' + String(items[0].show).slice(0, 16)
})

await check('视频详情真实可用', async () => {  const r = await invoke('GET', '/plugins/dsh-bilibili/video?bvid=BV1GJ411x7h7')
  if (!r.json || r.json.ok !== true) throw new Error(JSON.stringify(r.json).slice(0, 200))
  const v = r.json.video
  if (!v || !v.aid) throw new Error('缺少 aid')
  return v.title.slice(0, 20) + ' | aid=' + v.aid
})

await check('评论列表真实可用', async () => {
  const r = await invoke('GET', '/plugins/dsh-bilibili/comments?aid=80433022')
  if (!r.json || r.json.ok !== true) throw new Error(JSON.stringify(r.json).slice(0, 200))
  return (r.json.items || []).length + ' 条评论'
})

await check('QR 生成库能通过路由取到', async () => {
  const r = await invoke('GET', '/plugins/dsh-bilibili/vendor/qrcode.js')
  if (r.status !== 200) throw new Error('HTTP ' + r.status)
  const size = typeof r.json === 'string' ? r.json.length : 0
  if (size < 10000) throw new Error('内容太小: ' + size)
  return Math.round(size / 1024) + ' KB'
})

/* ── Web 半侧 ──────────────────────────────────────────────────────────── */
const clientSrc = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
let registration = null
const fakeWindow = { __ModuleLoader__: { load(reg) { registration = reg } } }
const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: Symbol('Fragment'),
  useState: (v) => [v, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (v) => ({ current: v }),
}
const fakeDocument = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, textContent: '', style: {} }),
  head: { appendChild: () => {} },
}
try {
  const run = new Function('window', 'document', 'matchMedia', 'fetch', 'console', clientSrc)
  run(fakeWindow, fakeDocument, () => ({ matches: true }), () => ({ then: () => {}, catch: () => {} }), console)
} catch (error) {
  checks.push(['FAIL', 'client bundle 执行', error.message])
}

await check('client 注册 id 等于包名', () => {
  if (!registration) throw new Error('没有调用 __ModuleLoader__.load')
  if (registration.id !== 'dsh-bilibili') throw new Error('id=' + registration.id)
})

let exported = null
await check('client factory 能返回导出（module bug 体检）', () => {
  exported = registration.factory((n) => {
    if (n === 'react') return React
    throw new Error('意外 require: ' + n)
  })
  if (!exported || typeof exported.apply !== 'function') throw new Error('缺少 apply')
  return Object.keys(exported).join(', ')
})

await check('client apply 注册了面板', () => {
  const seen = []
  exported.apply({
    slots: {
      inject(name, cb) { seen.push('inject:' + name); cb() },
      register(options) { seen.push('register:' + options.name); return () => {} },
    },
  })
  if (seen.length < 4) throw new Error('注册次数不足: ' + seen.join(','))
  return seen.join(' | ')
})

for (const [state, label, detail] of checks) console.log(`${state}  ${label}${detail ? '  → ' + detail : ''}`)
const failed = checks.filter((row) => row[0] === 'FAIL').length
console.log(`\n${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
