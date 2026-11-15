/**
 * dsh-bilibili — Host 半侧
 * ---------------------------------------------------------------------------
 * 在 DeepSeek Harness 里刷哔哩哔哩。
 *
 * 只 import node 内置模块：插件在 profile 里解析不到第三方包，静态 import
 * 失败会让整个插件树起不来（DSH 启动全有或全无）。
 *
 * 所有请求都由 Host 发出，Cookie 只存在
 *   $DSH_HOME/dsh-bilibili/session.json（0600）
 * 浏览器侧永远拿不到 Cookie 原文，只拿到登录状态和昵称。
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-bilibili'

const NS = 'dsh-bilibili'
const BASE = '/plugins/dsh-bilibili'
const VERSION = '1.0.0'
const TIMEOUT_MS = 20000

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const REFERER = 'https://www.bilibili.com/'

const API = 'https://api.bilibili.com'
const PASSPORT = 'https://passport.bilibili.com'

/* ── 会话存储 ─────────────────────────────────────────────────────────────── */

function sessionPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'dsh-bilibili', 'session.json')
}

/** @type {{ cookies: Record<string,string>, user: any, savedAt: number }} */
let session = { cookies: {}, user: null, savedAt: 0 }

/** 发短信时下发的 captcha_key，登录时必用。
 *  存在 Host 侧，页面刷新 / 重开面板都不会丢（丢了就是 86205 验证码失效）。 */
let lastCaptchaKey = ''

/**
 * 是否把会话写入磁盘。默认 true（程序自身的保存）；
 * 登录流程会按「记住账号」勾选临时改它：不勾 → 本次登录只留在内存，
 * DSH 重启后自动回到未登录。
 */
let persistSession = true

/** 调试追踪：记录每次登录相关请求与 B 站原始响应。
 *  内存保留最近 50 条，同时落盘 ~/.dsh/dsh-bilibili/debug.log。 */
const debugRing = []

function trace(step, detail) {
  const entry = { at: new Date().toISOString(), step, detail }
  debugRing.unshift(entry)
  if (debugRing.length > 50) debugRing.length = 50
  try {
    const home = process.env.DSH_HOME || join(homedir(), '.dsh')
    const file = join(home, 'dsh-bilibili', 'debug.log')
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')
  } catch { /* 追踪失败不影响主流程 */ }
}

function loadSession() {
  try {
    const parsed = JSON.parse(readFileSync(sessionPath(), 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.cookies && typeof parsed.cookies === 'object') {
      session = {
        cookies: Object.fromEntries(Object.entries(parsed.cookies).filter(([, v]) => typeof v === 'string')),
        user: parsed.user && typeof parsed.user === 'object' ? parsed.user : null,
        savedAt: Number(parsed.savedAt) || 0,
      }
    }
  } catch {
    /* 没有会话文件就是未登录 */
  }
}

function saveSession() {
  if (!persistSession) return
  const file = sessionPath()
  const tmp = `${file}.${process.pid}.tmp`
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(tmp, JSON.stringify({ version: 1, ...session }, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, file)
  } catch (error) {
    warn(`保存会话失败: ${error?.message || error}`)
  }
}

function clearSession() {
  session = { cookies: {}, user: null, savedAt: 0 }
  try { unlinkSync(sessionPath()) } catch {}
}

function cookieHeader() {
  return Object.entries(session.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

function csrf() {
  return session.cookies.bili_jct || ''
}

function isLoggedIn() {
  // 只认 SESSDATA。原来还要求 session.user，而 user 要等 /nav 确认后才有：
  // 登录刚成功那一刻 user 还没写入 → isLoggedIn()=false → /nav 不带 cookie
  // → nav 报未登录 → 前端把“成功”判成“登录失败”。死循环依赖，必须拆开。
  return Boolean(session.cookies.SESSDATA)
}

/* ── 小工具 ───────────────────────────────────────────────────────────────── */

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function isLocalRequest(req) {
  const remote = req.socket?.remoteAddress
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) return false
  if (req.headers?.host) {
    try {
      const host = new URL(`http://${req.headers.host}`)
      if (host.username || host.password) return false
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname)) return false
    } catch { return false }
  }
  if (!req.headers?.origin) return true
  try {
    const origin = new URL(req.headers.origin)
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host
  } catch { return false }
}

async function readBody(req, limit = 64 * 1024) {
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > limit) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  if (!bytes) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  try { return JSON.parse(text) } catch { return { text } }
}

function query(req) {
  return new URL(req.url || '/', 'http://local').searchParams
}

function md5(text) {
  return createHash('md5').update(text).digest('hex')
}

let logger = console
function warn(msg) { try { logger?.warn?.(`[${NS}] ${msg}`) } catch {} }
function info(msg) { try { logger?.info?.(`[${NS}] ${msg}`) } catch {} }

/* ── 请求哔哩哔哩 ─────────────────────────────────────────────────────────── */

function headers(extra = {}) {
  const h = {
    'user-agent': UA,
    referer: REFERER,
    origin: 'https://www.bilibili.com',
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
    ...extra,
  }
  // 只在已登录时带 Cookie。匿名请求带 buvid 会让搜索返回 0 条
  // （实测：不带 20 条，带 buvid3 后 code 0 但结果为空）。
  if (isLoggedIn()) {
    const cookie = cookieHeader()
    if (cookie) h.cookie = cookie
  }
  return h
}

async function bili(path, { method = 'GET', form, raw = false, base = API } = {}) {
  const url = base + path
  let response
  try {
    response = await fetch(url, {
      method,
      headers: headers(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      body: form ? new URLSearchParams(form).toString() : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw Object.assign(new Error(/abort|timeout/i.test(message) ? `连接哔哩哔哩超时（${message}）` : `连接哔哩哔哩失败：${message}`), { code: -1 })
  }
  absorbCookies(response)
  const text = await response.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = { code: -1, message: text.slice(0, 200) } }
  if (raw) return data
  if (!data || typeof data.code !== 'number') throw Object.assign(new Error('哔哩哔哩返回了无法解析的内容'), { code: -1 })
  if (data.code !== 0) {
    const error = new Error(data.message || `哔哩哔哩错误 ${data.code}`)
    error.code = data.code
    throw error
  }
  return data.data
}

/** 把 Set-Cookie 吸收进会话（登录成功、buvid 下发都靠它）。 */
function absorbCookies(response) {
  let list = []
  try {
    if (typeof response.headers.getSetCookie === 'function') list = response.headers.getSetCookie()
  } catch {}
  if (!list.length) {
    const single = response.headers.get('set-cookie')
    if (single) list = [single]
  }
  let changed = false
  for (const line of list) {
    const pair = String(line).split(';')[0]
    const index = pair.indexOf('=')
    if (index <= 0) continue
    const key = pair.slice(0, index).trim()
    const value = pair.slice(index + 1).trim()
    if (!key) continue
    if (session.cookies[key] !== value) {
      session.cookies[key] = value
      changed = true
    }
  }
  if (changed) saveSession()
  return changed
}

/** 没有 buvid3 时补一个，否则不少接口会返回 -352 风控。 */
async function ensureBuvid() {
  if (session.cookies.buvid3) return
  try {
    const spi = await bili('/x/frontend/finger/spi')
    if (spi?.b_3) session.cookies.buvid3 = spi.b_3
    if (spi?.b_4) session.cookies.buvid4 = spi.b_4
    saveSession()
  } catch {}
}

/* ── WBI 签名 ─────────────────────────────────────────────────────────────── */

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
]

let wbiCache = { key: '', at: 0 }

async function wbiKey() {
  if (wbiCache.key && Date.now() - wbiCache.at < 60 * 60 * 1000) return wbiCache.key
  // 注意：/nav 在未登录时返回 code -101，但 data 里照样带 wbi_img，
  // 所以这里必须用 raw 模式，不能走会抛错的 bili()。
  const nav = await bili('/x/web-interface/nav', { raw: true })
  const imgUrl = nav?.data?.wbi_img?.img_url || ''
  const subUrl = nav?.data?.wbi_img?.sub_url || ''
  const imgKey = imgUrl.split('/').pop().split('.')[0]
  const subKey = subUrl.split('/').pop().split('.')[0]
  if (!imgKey || !subKey) throw new Error('拿不到 WBI 签名密钥')
  const raw = imgKey + subKey
  const key = MIXIN_KEY_ENC_TAB.map((i) => raw[i]).join('').slice(0, 32)
  wbiCache = { key, at: Date.now() }
  return key
}

async function signedQuery(params) {
  const key = await wbiKey()
  const wts = Math.round(Date.now() / 1000)
  const withTime = { ...params, wts }
  const query = Object.keys(withTime)
    .sort()
    .map((k) => {
      const value = String(withTime[k]).replace(/[!'()*]/g, '')
      return `${encodeURIComponent(k)}=${encodeURIComponent(value)}`
    })
    .join('&')
  return `${query}&w_rid=${md5(query + key)}`
}

/* ── 数据整形 ─────────────────────────────────────────────────────────────── */

function pickStat(stat = {}) {
  return {
    view: stat.view ?? 0,
    danmaku: stat.danmaku ?? 0,
    reply: stat.reply ?? 0,
    like: stat.like ?? 0,
    coin: stat.coin ?? 0,
    favorite: stat.favorite ?? 0,
    share: stat.share ?? 0,
  }
}

function pickVideo(video) {
  if (!video || !video.bvid) return null
  return {
    bvid: video.bvid,
    aid: video.aid ?? 0,
    cid: video.cid ?? video.pages?.[0]?.cid ?? 0,
    title: String(video.title || '').replace(/<[^>]+>/g, ''),
    pic: String(video.pic || '').startsWith('//') ? `https:${video.pic}` : String(video.pic || ''),
    desc: String(video.description || video.desc || '').slice(0, 300),
    duration: video.duration ?? 0,
    pubdate: video.pubdate ?? 0,
    owner: { mid: video.owner?.mid ?? 0, name: video.owner?.name || '', face: video.owner?.face || '' },
    stat: pickStat(video.stat),
  }
}

/** 秒数转 "MM:SS"。 */
function parseDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function pickComment(reply) {
  return {
    rpid: reply.rpid_str || String(reply.rpid),
    mid: reply.member?.mid ?? 0,
    user: reply.member?.uname || '',
    avatar: reply.member?.avatar || '',
    message: reply.content?.message || '',
    like: reply.like ?? 0,
    ctime: reply.ctime ?? 0,
    replies: Array.isArray(reply.replies) ? reply.replies.slice(0, 3).map((r) => ({
      rpid: r.rpid_str || String(r.rpid),
      mid: r.member?.mid ?? 0,
      user: r.member?.uname || '',
      message: r.content?.message || '',
      ctime: r.ctime ?? 0,
    })) : [],
  }
}

/* ── 句柄 ─────────────────────────────────────────────────────────────────── */

function makeHandlers(vendorDir) {
  const needLogin = () => {
    if (!isLoggedIn()) throw Object.assign(new Error('请先扫码登录'), { code: -101 })
  }

  const sessionInfo = async (req, res) => {
    // 有 SESSDATA 但没有用户信息时（例如旧版本登录成功后没存 user），
    // 现场补一次 nav，让界面直接显示昵称头像。
    if (isLoggedIn() && !session.user) {
      try {
        const payload = await bili('/x/web-interface/nav', { raw: true })
        const nav = payload?.data || null
        if (nav?.isLogin) {
          session.user = {
            mid: nav.mid, uname: nav.uname, face: nav.face,
            level: nav.level_info?.current_level ?? 0, vip: nav.vipStatus === 1, coins: nav.money ?? 0,
          }
          session.savedAt = Date.now()
          saveSession()
          trace('sessionInfo.refill', { uname: nav.uname, mid: nav.mid })
        }
      } catch { /* 补不到就下次再补 */ }
    }
    json(res, 200, {
      ok: true,
      version: VERSION,
      loggedIn: isLoggedIn(),
      user: session.user || null,
      savedAt: session.savedAt || 0,
    })
  }

  const navRefresh = async (req, res) => {
    try {
      await ensureBuvid()
      const payload = await bili('/x/web-interface/nav', { raw: true })
      const nav = payload?.data || null
      if (nav?.isLogin) {
        session.user = {
          mid: nav.mid,
          uname: nav.uname,
          face: nav.face,
          level: nav.level_info?.current_level ?? 0,
          vip: nav.vipStatus === 1,
          coins: nav.money ?? 0,
        }
        session.savedAt = Date.now()
        saveSession()
      } else if (!nav?.isLogin) {
        session.user = null
        saveSession()
      }
      json(res, 200, { ok: true, loggedIn: Boolean(nav?.isLogin), user: session.user })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  const logout = async (req, res) => {
    clearSession()
    // 退出后禁止任何落盘：buvid 等后续吸收都不再写文件，
    // 保证「退出登录 → 重启 → 干净」绝对成立
    persistSession = false
    json(res, 200, { ok: true })
  }

  const qrGenerate = async (req, res) => {
    // 勾了「记住账号」才落盘；不勾本次登录只留在内存
    persistSession = query(req).get('remember') === '1'
    try {
      // 二维码会话靠 Cookie 串联：generate 下发的 cookie 必须在 poll 时带回，
      // 否则 B 站认不出 qrcode_key，一律回 86038「二维码已失效」。
      // 所以这里显式带上当前会话 cookie（哪怕还没登录）。
      const ch = cookieHeader()
      const response = await fetch(`${PASSPORT}/x/passport-login/web/qrcode/generate`, {
        headers: headers(ch ? { cookie: ch } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      absorbCookies(response)
      const payload = await response.json().catch(() => null)
      if (!payload || payload.code !== 0) {
        return json(res, 200, { ok: false, error: payload?.message || '生成二维码失败' })
      }
      json(res, 200, { ok: true, url: payload.data.url, key: payload.data.qrcode_key })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message })
    }
  }

  const qrPoll = async (req, res) => {
    const key = query(req).get('key') || ''
    if (!key) return json(res, 400, { ok: false, error: '缺少 key' })
    try {
      const ch = cookieHeader()
      const response = await fetch(`${PASSPORT}/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(key)}&source=main-fe-header`, {
        headers: headers(ch ? { cookie: ch } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      absorbCookies(response)
      const payload = await response.json().catch(() => null)
      const code = payload?.data?.code
      if (code === 0) {
        // 成功：有时 cookie 只在跳转 url 里，兜底解析一次
        const jump = payload?.data?.url || ''
        if (jump && !session.cookies.SESSDATA) {
          try {
            const u = new URL(jump)
            for (const k of ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid']) {
              const v = u.searchParams.get(k)
              if (v) session.cookies[k] = v
            }
          } catch {}
        }
        // 关键：code=0 即登录已成功。后面的用户信息补全绝不能失败——
        // 一旦抛错，客户端会把「已成功」当失败，继续轮询已被消费的 key，
        // 直到 86038 报「二维码已过期」。这就是「确认完弹过期」的根因。
        try {
          await ensureBuvid()
          const navPayload = await bili('/x/web-interface/nav', { raw: true })
          const nav = navPayload?.data || null
          if (nav?.isLogin) {
            session.user = {
              mid: nav.mid, uname: nav.uname, face: nav.face,
              level: nav.level_info?.current_level ?? 0, vip: nav.vipStatus === 1, coins: nav.money ?? 0,
            }
            session.savedAt = Date.now()
            saveSession()
          }
        } catch { /* 补全失败不改变已登录的事实 */ }
        return json(res, 200, { ok: true, state: 'success', loggedIn: isLoggedIn(), user: session.user })
      }
      const states = { 86101: 'waiting', 86090: 'scanned', 86038: 'expired' }
      if (code === 86038) persistSession = true // 过期后恢复中性，不残留 false
      json(res, 200, { ok: true, state: states[code] || 'unknown', code })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message })
    }
  }

  /** 手动导入 Cookie（扫码走不通时的兜底）。 */
  const importCookies = async (req, res) => {
    let body
    try { body = await readBody(req) } catch (error) { return json(res, 400, { ok: false, error: error.message }) }
    persistSession = body?.remember === true
    const text = String(body?.cookie ?? '')
    const pairs = text.split(';').map((s) => s.trim()).filter(Boolean)
    const next = {}
    for (const pair of pairs) {
      const i = pair.indexOf('=')
      if (i > 0) next[pair.slice(0, i).trim()] = pair.slice(i + 1).trim()
    }
    if (!next.SESSDATA) return json(res, 400, { ok: false, error: 'Cookie 里没有 SESSDATA，复制不完整' })
    session.cookies = { ...session.cookies, ...next }
    session.savedAt = Date.now()
    saveSession()
    await ensureBuvid()
    try {
      const payload = await bili('/x/web-interface/nav', { raw: true })
      const nav = payload?.data || null
      if (nav?.isLogin) {
        session.user = {
          mid: nav.mid, uname: nav.uname, face: nav.face,
          level: nav.level_info?.current_level ?? 0, vip: nav.vipStatus === 1, coins: nav.money ?? 0,
        }
        saveSession()
      }
      json(res, 200, { ok: true, loggedIn: Boolean(nav?.isLogin), user: session.user })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message })
    }
  }

  /** 推荐流：排行榜（不需要 WBI，稳定）。 */
  const feed = async (req, res) => {
    try {
      await ensureBuvid()
      const params = query(req)
      const rid = params.get('rid') || '0'

      // 主路径：首页推荐流。brush/fresh_idx 随机化，每次刷新内容不同
      try {
        const brush = Math.floor(Math.random() * 10)
        const fresh = Math.floor(Math.random() * 5) + 1
        const data = await bili(`/x/web-interface/index/top/feed/rcmd?y_num=5&fresh_type=4&feed_version=V8&fresh_idx_1h=${fresh}&fetch_row=1&fresh_idx=${fresh}&brush=${brush}&ps=20&pn=1`)
        const items = (data?.item || []).map((it) => {
          const bvid = String(it.bvid || it.args?.bvid || '')
          const cover = String(it.pic || it.cover || '')
          return {
            bvid,
            aid: Number(it.args?.aid ?? 0),
            cid: 0,
            title: String(it.title || ''),
            pic: cover.startsWith('//') ? `https:${cover}` : cover,
            duration: 0,
            pubdate: 0,
            owner: { name: String(it.args?.up_name || ''), mid: 0 },
            stat: { view: Number(it.stat?.view ?? 0), danmaku: Number(it.stat?.danmaku ?? 0) },
          }
        }).filter((v) => v.bvid)
        if (items.length) return json(res, 200, { ok: true, items: items.slice(0, 30), source: 'rcmd' })
      } catch { /* 风控 → 热门随机页 */ }

      // 回退 1：热门随机页（每页 20 条，随机翻页 = 每次不同）
      try {
        const pn = Math.floor(Math.random() * 5) + 1
        const data = await bili(`/x/web-interface/popular?ps=20&pn=${pn}`)
        const list = (Array.isArray(data?.list) ? data.list : []).map(pickVideo).filter(Boolean)
        if (list.length) return json(res, 200, { ok: true, items: list.slice(0, 30), source: 'popular' })
      } catch { /* 回退排行榜 */ }

      // 回退 2：排行榜
      const data = await bili(`/x/web-interface/ranking/v2?rid=${encodeURIComponent(rid)}&type=all`)
      const list = (data?.list || []).map(pickVideo).filter(Boolean)
      json(res, 200, { ok: true, items: list, note: String(data?.note || ''), source: 'ranking' })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  const search = async (req, res) => {
    try {
      await ensureBuvid()
      const term = (query(req).get('q') || '').trim()
      if (!term) return json(res, 400, { ok: false, error: '请输入关键词' })
      const page = Math.max(1, Number(query(req).get('page')) || 1)
      const qs = await signedQuery({
        search_type: 'video',
        keyword: term.slice(0, 100),
        page,
        page_size: 20,
        order: 'totalrank',
      })
      const data = await bili(`/x/web-interface/wbi/search/type?${qs}`)
      const list = (data?.result || []).map((v) => ({
        bvid: v.bvid,
        aid: v.aid ?? 0,
        title: String(v.title || '').replace(/<[^>]+>/g, ''),
        pic: String(v.pic || '').startsWith('//') ? `https:${v.pic}` : String(v.pic || ''),
        desc: String(v.description || ''),
        duration: String(v.duration || ''),
        owner: { name: v.author || '', mid: v.mid ?? 0 },
        stat: { view: v.play ?? 0, danmaku: v.video_review ?? 0, favorite: v.favorites ?? 0, like: v.like ?? 0 },
      }))
      json(res, 200, { ok: true, items: list, pages: data?.numPages ?? 1, total: data?.numResults ?? list.length })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  const video = async (req, res) => {
    try {
      await ensureBuvid()
      const bvid = query(req).get('bvid') || ''
      if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, error: 'BV 号格式不对' })
      const data = await bili(`/x/web-interface/view?bvid=${bvid}`)
      // view 接口的 req_user 已被 B 站移除（实测 null），收藏状态单独查
      let favorited = false
      let liked = false
      if (isLoggedIn()) {
        try {
          const state = await bili(`/x/v2/fav/video/favoured?aid=${data.aid}`)
          favorited = state?.favoured === true
        } catch { /* 查不到就按未收藏 */ }
        try {
          // 返回 0/1：1 已点赞
          const lstate = await bili(`/x/web-interface/archive/has/like?bvid=${bvid}`)
          liked = lstate === 1
        } catch { /* 查不到就按未点赞 */ }
      }
      json(res, 200, {
        ok: true,
        video: { ...pickVideo(data), favorited, liked },
        pages: data?.pages?.length ?? 1,
      })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  const related = async (req, res) => {
    try {
      await ensureBuvid()
      const bvid = query(req).get('bvid') || ''
      if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, error: 'BV 号格式不对' })
      const data = await bili(`/x/web-interface/archive/related?bvid=${bvid}`)
      const list = (Array.isArray(data) ? data : []).map((v) => ({
        bvid: v.bvid,
        aid: v.aid,
        title: String(v.title || ''),
        pic: String(v.pic || '').startsWith('//') ? `https:${v.pic}` : String(v.pic || ''),
        duration: v.duration ?? 0,
        owner: { name: v.owner?.name || '', mid: v.owner?.mid ?? 0 },
        stat: { view: v.stat?.view ?? 0, danmaku: v.stat?.danmaku ?? 0 },
      })).filter((v) => v.bvid)
      json(res, 200, { ok: true, items: list.slice(0, 12) })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  const coin = async (req, res) => {
    try {
      needLogin()
      const body = await readBody(req)
      const bvid = String(body?.bvid || '')
      if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, error: 'BV 号格式不对' })
      await bili('/x/web-interface/coin/add', {
        method: 'POST',
        form: { bvid, multiply: '1', csrf: csrf() },
      })
      json(res, 200, { ok: true, message: '已投币 1 枚' })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 举报：走官方 /x/web-interface/report。 */
  const report = async (req, res) => {
    try {
      needLogin()
      const body = await readBody(req)
      const aid = String(body?.aid || '')
      const reasonId = String(body?.reasonId || '2')
      const title = String(body?.title || '').slice(0, 80)
      const desc = String(body?.desc || '').slice(0, 200)
      if (!aid) return json(res, 400, { ok: false, error: '缺少 aid' })
      await bili('/x/web-interface/report', {
        method: 'POST',
        form: {
          aid,
          tid: String(body?.tid || ''),
          reason_id: reasonId,
          reason_type: '1',
          title,
          desc,
          csrf: csrf(),
        },
      })
      json(res, 200, { ok: true, message: '举报已提交' })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 搜索页的热点推荐（B 站热搜词，点一下直接搜）。 */
  const hotsearch = async (req, res) => {
    try {
      // 注意：bili() 已经剥掉外层返回 data.data，这里直接读 data.trending
      const data = await bili('/x/web-interface/search/square?limit=10&platform=web')
      const list = data?.trending?.list || []
      const items = list
        .map((t) => ({ keyword: String(t.keyword || t.show_name || ''), show: String(t.show_name || t.keyword || '') }))
        .filter((t) => t.keyword)
      json(res, 200, { ok: true, title: data?.trending?.title || '热点推荐', items: items.slice(0, 12) })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 用户名片：头像 / 粉丝 / 签名 / 关注状态。 */
  const userCard = async (req, res) => {
    try {
      const mid = query(req).get('mid') || ''
      if (!/^\d+$/.test(mid)) return json(res, 400, { ok: false, error: 'mid 不对' })
      const qs = await signedQuery({ mid, photo: 'true' })
      const data = await bili(`/x/web-interface/card?${qs}`)
      const card = data?.card || {}
      // 关注状态不在 card 里（实测 relation 字段整块缺失），
      // 必须单独走 /x/relation?fid= 拿 attribute：2=已关注 6=互关
      let following = false
      if (isLoggedIn()) {
        try {
          const rel = await bili(`/x/relation?fid=${mid}`)
          const attr = rel?.attribute ?? 0
          following = attr === 2 || attr === 6
        } catch { /* 未登录 / 风控就按未关注 */ }
      }
      json(res, 200, {
        ok: true,
        card: {
          mid: card.mid || mid,
          name: card.name || '',
          face: card.face || '',
          sign: card.sign || '',
          fans: card.fans ?? 0,
          attention: card.attention ?? 0,
          level: card.level_info?.current_level ?? 0,
          official: card.official_verify?.type === 0 ? String(card.official_verify?.desc || '') : '',
          following,
        },
      })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 用户投稿列表。 */
  const userVideos = async (req, res) => {
    try {
      const mid = query(req).get('mid') || ''
      if (!/^\d+$/.test(mid)) return json(res, 400, { ok: false, error: 'mid 不对' })
      const qs = await signedQuery({ mid, ps: '30', pn: '1', order: 'pubdate', platform: 'web' })
      let data = await bili(`/x/space/wbi/arc/search?${qs}`)
      let vlist = data?.list?.vlist || []
      // 空间接口偶尔被风控返回空列表（code 0 但 vlist 空），重试一次
      if (vlist.length === 0) {
        await new Promise((ok) => setTimeout(ok, 600))
        data = await bili(`/x/space/wbi/arc/search?${qs}`)
        vlist = data?.list?.vlist || []
      }
      const items = vlist.map((v) => ({
        bvid: v.bvid,
        aid: v.aid ?? 0,
        cid: v.cid ?? 0,
        title: String(v.title || ''),
        pic: String(v.pic || '').startsWith('//') ? `https:${v.pic}` : String(v.pic || ''),
        duration: v.length ? parseDuration(v.length) : 0,
        pubdate: v.created ?? 0,
        owner: { name: v.author || '', mid: v.mid ?? Number(mid) },
        stat: { view: v.play ?? 0, danmaku: v.video_review ?? 0 },
      })).filter((v) => v.bvid)
      json(res, 200, { ok: true, items: items.slice(0, 30), total: data?.page?.count ?? items.length })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 用户动态（polymer feed/space，匿名可能受风控，失败就明说）。 */
  const userDynamics = async (req, res) => {
    try {
      const mid = query(req).get('mid') || ''
      if (!/^\d+$/.test(mid)) return json(res, 400, { ok: false, error: 'mid 不对' })
      const qs = await signedQuery({ host_mid: mid, timezone_offset: '-480', platform: 'web' })
      const data = await bili(`/x/polymer/web-dynamic/v1/feed/space?${qs}`)
      const items = (data?.items || []).map((d) => {
        const dyn = d.modules?.module_dynamic || {}
        const author = d.modules?.module_author || {}
        const major = dyn.major || {}
        let type = '动态'
        let bvid = ''
        if (major.archive) { type = '投稿'; bvid = major.archive.bvid || '' }
        else if (major.opus?.pictures?.length) type = '图片'
        else if (major.article) type = '专栏'
        else if (major.live_rcmd) type = '直播'
        return {
          id: d.id_str || String(d.id),
          text: String(dyn.desc?.text || '').slice(0, 500),
          type,
          bvid,
          time: author.pub_ts ?? 0,
          name: author.name || '',
        }
      })
      json(res, 200, { ok: true, items, hasMore: Boolean(data?.has_more), offset: data?.offset || '' })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 关注 / 取关（act: 1 关注，2 取关），需要登录。 */
  const follow = async (req, res) => {
    try {
      needLogin()
      const body = await readBody(req)
      const mid = String(body?.mid || '')
      const act = String(body?.act || '1')
      if (!/^\d+$/.test(mid)) return json(res, 400, { ok: false, error: 'mid 不对' })
      await bili('/x/relation/modify', {
        method: 'POST',
        form: { fid: mid, act, re_src: '11', csrf: csrf() },
      })
      json(res, 200, { ok: true, following: act === '1' })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 发私信（web_im，需要登录 + CSRF）。 */
  const messageSend = async (req, res) => {
    try {
      needLogin()
      const body = await readBody(req)
      const mid = String(body?.mid || '')
      const text = String(body?.text || '').trim().slice(0, 500)
      if (!/^\d+$/.test(mid)) return json(res, 400, { ok: false, error: 'mid 不对' })
      if (!text) return json(res, 400, { ok: false, error: '私信内容不能为空' })
      const me = String(session.user?.mid || session.cookies.DedeUserID || '')
      const payload = {
        'msg[sender_uid]': me,
        'msg[receiver_id]': mid,
        'msg[receiver_type]': '1',
        'msg[msg_type]': '1',
        'msg[msg_status]': '0',
        'msg[content]': JSON.stringify({ content: text }),
        'msg[timestamp]': String(Math.floor(Date.now() / 1000)),
        'msg[dev_id]': 'dsh-bilibili',
        'msg[new_face]': '0',
        build: '0',
        mobi_app: 'web',
        csrf_token: csrf(),
        csrf: csrf(),
      }
      const response = await fetch('https://api.vc.bilibili.com/web_im/v1/web_im/send_msg', {
        method: 'POST',
        headers: headers({
          'content-type': 'application/x-www-form-urlencoded',
          referer: 'https://message.bilibili.com/',
          origin: 'https://message.bilibili.com',
        }),
        body: new URLSearchParams(payload).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      absorbCookies(response)
      const data = await response.json().catch(() => null)
      if (data?.code === 0) return json(res, 200, { ok: true, message: '私信已发送' })
      json(res, 200, { ok: false, error: data?.message || '发送失败', code: data?.code })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 私信历史（只读）。 */
  const messageHistory = async (req, res) => {
    try {
      needLogin()
      const mid = query(req).get('mid') || ''
      if (!/^\d+$/.test(mid)) return json(res, 400, { ok: false, error: 'mid 不对' })
      const url = `https://api.vc.bilibili.com/svr_sync/v1/svr_sync/fetch_session_msgs?talker_id=${mid}&session_type=1&size=20&build=0&mobi_app=web`
      const response = await fetch(url, {
        headers: headers({ referer: 'https://message.bilibili.com/', origin: 'https://message.bilibili.com' }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      absorbCookies(response)
      const data = await response.json().catch(() => null)
      const list = (data?.data?.messages || [])
        .map((m) => ({
          sender: m.sender_uid ?? 0,
          content: (() => { try { return JSON.parse(m.content || '{}').content || '' } catch { return String(m.content || '') } })(),
          time: m.timestamp ?? 0,
        }))
        .filter((m) => m.content)
        .reverse()
      json(res, 200, { ok: true, items: list.slice(-20), me: Number(session.user?.mid || session.cookies.DedeUserID || 0) })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 关注的人的视频 / 直播。优先官方 feed；被风控时回退到
   *  「关注列表 + 每人最新投稿」聚合，保证有东西可看。 */
  const followFeed = async (req, res) => {
    try {
      needLogin()
      // 主路径：官方关注 feed
      try {
        const qs = await signedQuery({ ps: '30', pn: '1', platform: 'web', web_location: '333.999' })
        const data = await bili(`/x/web-feed/feed?${qs}`)
        const cards = data?.item || []
        if (cards.length) {
          const items = cards.map((c) => {
            const major = c.modules?.module_dynamic?.major || {}
            const author = c.modules?.module_author || {}
            if (major.archive) {
              const a = major.archive
              return {
                kind: 'video',
                bvid: a.bvid,
                aid: a.aid ?? 0,
                cid: a.cid ?? 0,
                title: String(a.title || ''),
                pic: String(a.cover || '').startsWith('//') ? `https:${a.cover}` : String(a.cover || ''),
                duration: a.duration_text || '',
                pubdate: a.pubdate ?? 0,
                owner: { name: author.name || '', mid: author.mid ?? 0 },
                stat: { view: a.stat?.play ?? 0, danmaku: a.stat?.danmaku ?? 0 },
              }
            }
            if (major.live_rcmd) {
              const l = major.live_rcmd
              return {
                kind: 'live',
                roomid: String(l.id ?? ''),
                title: String(l.title || ''),
                pic: String(l.cover || '').startsWith('//') ? `https:${l.cover}` : String(l.cover || ''),
                owner: { name: l.parent_area_name || '' },
                liveUrl: String(l.jump_url || l.link || ''),
              }
            }
            return null
          }).filter(Boolean).slice(0, 30)
          return json(res, 200, { ok: true, items })
        }
      } catch { /* 风控 → 回退聚合 */ }

      // 回退：关注列表 + 每人最新 2 个投稿，按时间排序
      const me = String(session.user?.mid || session.cookies.DedeUserID || '')
      const fqs = await signedQuery({ vmid: me, ps: '12', pn: '1', order: 'desc' })
      const fdata = await bili(`/x/relation/followings?${fqs}`)
      const followings = (fdata?.list || []).slice(0, 12)
      const videos = []
      for (const up of followings) {
        try {
          const vqs = await signedQuery({ mid: String(up.mid ?? ''), ps: '2', pn: '1', order: 'pubdate', platform: 'web' })
          const vdata = await bili(`/x/space/wbi/arc/search?${vqs}`)
          for (const v of (vdata?.list?.vlist || []).slice(0, 2)) {
            if (!v.bvid) continue
            videos.push({
              kind: 'video',
              bvid: v.bvid,
              aid: v.aid ?? 0,
              cid: v.cid ?? 0,
              title: String(v.title || ''),
              pic: String(v.pic || '').startsWith('//') ? `https:${v.pic}` : String(v.pic || ''),
              duration: parseDuration(v.length),
              pubdate: v.created ?? 0,
              owner: { name: v.author || '', mid: up.mid ?? 0 },
              stat: { view: v.play ?? 0, danmaku: v.video_review ?? 0 },
            })
          }
        } catch { /* 单个 UP 主失败跳过 */ }
      }
      videos.sort((a, b) => (b.pubdate || 0) - (a.pubdate || 0))
      json(res, 200, { ok: true, items: videos.slice(0, 30), fallback: true })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 我收藏的视频（默认收藏夹，需登录）。 */
  const myFavorites = async (req, res) => {
    try {
      needLogin()
      const me = String(session.user?.mid || session.cookies.DedeUserID || '')
      if (!me) return json(res, 200, { ok: false, error: '拿不到自己的 mid' })
      let folderId = ''
      try {
        const folders = await bili(`/x/v3/fav/folder/created/list-all?up_mid=${me}`)
        const list = folders?.list || []
        folderId = String(list[0]?.id ?? '')
      } catch { /* 没有收藏夹就空 */ }
      if (!folderId) return json(res, 200, { ok: true, items: [], total: 0 })
      const qs = await signedQuery({ media_id: folderId, pn: '1', ps: '20', platform: 'web' })
      const data = await bili(`/x/v3/fav/resource/list?${qs}`)
      const medias = data?.medias || []
      json(res, 200, {
        ok: true,
        items: medias.map((m) => ({
          bvid: String(m.bvid || m.id || ''),
          title: String(m.title || ''),
          pic: String(m.cover || '').startsWith('//') ? `https:${m.cover}` : String(m.cover || ''),
          owner: { name: m.upper?.name || '', mid: m.upper?.mid ?? 0 },
          stat: { view: m.cnt_info?.play ?? 0, danmaku: m.cnt_info?.danmaku ?? 0 },
        })).filter((m) => m.bvid),
        total: data?.info?.media_count ?? 0,
      })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 我关注的 UP 主（需登录）。 */
  const myFollowings = async (req, res) => {
    try {
      needLogin()
      const me = String(session.user?.mid || session.cookies.DedeUserID || '')
      if (!me) return json(res, 200, { ok: false, error: '拿不到自己的 mid' })
      const qs = await signedQuery({ vmid: me, ps: '20', pn: '1', order: 'desc' })
      const data = await bili(`/x/relation/followings?${qs}`)
      const list = data?.list || []
      json(res, 200, {
        ok: true,
        items: list.map((u) => ({
          mid: u.mid ?? 0,
          name: u.uname || '',
          face: u.face || '',
          sign: u.sign || '',
          time: u.mtime ?? 0,
        })).filter((u) => u.mid),
        total: data?.total ?? 0,
      })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 收藏 / 取消收藏（默认收藏夹）。 */
  const favorite = async (req, res) => {
    try {
      needLogin()
      const body = await readBody(req)
      const aid = String(body?.aid || '')
      const want = body?.fav === false ? false : true
      if (!/^\d+$/.test(aid)) return json(res, 400, { ok: false, error: 'aid 不对' })
      const me = String(session.user?.mid || session.cookies.DedeUserID || '')
      let folderId = ''
      try {
        const folders = await bili(`/x/v3/fav/folder/created/list-all?up_mid=${me}`)
        const list = folders?.list || []
        folderId = String(list[0]?.id ?? '')
      } catch { /* 无收藏夹 */ }
      if (!folderId) return json(res, 200, { ok: false, error: '拿不到默认收藏夹' })
      const form = { rid: aid, type: '2', csrf: csrf() }
      form[want ? 'add_media_ids' : 'del_media_ids'] = folderId
      await bili('/x/v3/fav/resource/deal', { method: 'POST', form })
      json(res, 200, { ok: true, favorited: want })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  const comments = async (req, res) => {
    try {
      await ensureBuvid()
      const params = query(req)
      const aid = params.get('aid')
      if (!aid) return json(res, 400, { ok: false, error: '缺少 aid' })
      const pn = Math.max(1, Number(params.get('pn')) || 1)
      const data = await bili(`/x/v2/reply?type=1&oid=${encodeURIComponent(aid)}&sort=2&ps=20&pn=${pn}`)
      json(res, 200, {
        ok: true,
        items: (data?.replies || []).map(pickComment),
        total: data?.page?.count ?? 0,
      })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  const like = async (req, res) => {
    try {
      needLogin()
      const body = await readBody(req)
      const bvid = String(body?.bvid || '')
      const want = body?.like === false ? 2 : 1
      if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, error: 'BV 号格式不对' })
      await bili('/x/web-interface/archive/like', {
        method: 'POST',
        form: { bvid, like: want, csrf: csrf() },
      })
      json(res, 200, { ok: true, liked: want === 1 })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  const comment = async (req, res) => {
    try {
      needLogin()
      const body = await readBody(req)
      const aid = String(body?.aid || '')
      const message = String(body?.message || '').trim()
      if (!aid) return json(res, 400, { ok: false, error: '缺少 aid' })
      if (!message) return json(res, 400, { ok: false, error: '评论内容不能为空' })
      if (message.length > 500) return json(res, 400, { ok: false, error: '评论不能超过 500 字' })
      const data = await bili('/x/v2/reply/add', {
        method: 'POST',
        form: { oid: aid, type: 1, message, csrf: csrf(), plat: 1 },
      })
      json(res, 200, { ok: true, rpid: data?.rpid_str || String(data?.rpid || ''), message: '评论已发布' })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  const repost = async (req, res) => {
    try {
      needLogin()
      const body = await readBody(req)
      const bvid = String(body?.bvid || '')
      const text = String(body?.text || '').slice(0, 230)
      if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return json(res, 400, { ok: false, error: 'BV 号格式不对' })
      const dynReq = {
        content: { contents: [{ raw_text: text, type: 1, biz_id: '' }] },
        scene: 1,
        attach_card: { type: 'DYNAMIC_TYPE_AV', biz_id: bvid },
      }
      const form = { dyn_req: JSON.stringify(dynReq), csrf: csrf(), platform: 'web' }
      await bili(`/x/dynamic/feed/create/dyn?platform=web&csrf=${encodeURIComponent(csrf())}`, {
        method: 'POST',
        form,
      })
      json(res, 200, { ok: true, message: '已转发到动态' })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 取极验参数（gt / challenge / token），短信发送和登录都要它。 */
  const captcha = async (req, res) => {
    try {
      await ensureBuvid()
      // B 站的验证码接口会间歇性返回 100000「验证码获取失败」（实测 3 次里 1 次失败），
      // 自动重试最多 3 次，把抖动吃掉
      let payload = null
      let lastMessage = ''
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const response = await fetch(`${PASSPORT}/x/passport-login/captcha?source=main-fe-header`, {
            headers: headers(),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          })
          absorbCookies(response)
          payload = await response.json().catch(() => null)
        } catch { payload = null }
        if (payload?.code === 0 && payload?.data?.geetest?.gt) break
        lastMessage = payload?.message || '拿不到验证码参数'
        if (attempt < 3) await new Promise((ok) => setTimeout(ok, 700 * attempt))
      }
      if (!payload || payload.code !== 0) {
        return json(res, 200, { ok: false, error: `${lastMessage}（B 站验证码接口抖动，重试了 3 次，请再点一次「获取验证码」）` })
      }
      const geetest = payload.data?.geetest || {}
      json(res, 200, {
        ok: true,
        type: payload.data?.type || 'geetest',
        token: payload.data?.token || '',
        gt: geetest.gt || '',
        challenge: geetest.challenge || '',
      })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message })
    }
  }

  /** 发短信验证码。必须带极验结果，否则 B 站回 -105。 */
  const smsSend = async (req, res) => {
    let body
    try { body = await readBody(req) } catch (error) { return json(res, 400, { ok: false, error: error.message }) }
    const tel = String(body?.tel || '').trim()
    if (!/^1\d{10}$/.test(tel)) return json(res, 400, { ok: false, error: '手机号格式不对（11 位，1 开头）' })
    if (!body?.validate) return json(res, 400, { ok: false, error: '还没完成验证码' })
    await ensureBuvid()
    const validateRaw = String(body?.validate || '')
    // 官方约定：seccode = 极验结果 + "|jordan"
    const seccodeRaw = String(body?.seccode || '')
    const seccode = seccodeRaw || (validateRaw ? `${validateRaw}|jordan` : '')
    const form = {
      tel,
      cid: '86',
      source: 'main_web',
      token: String(body.token || ''),
      challenge: String(body.challenge || ''),
      validate: validateRaw,
      seccode,
    }
    trace('smsSend.req', { tel: tel.slice(0, 3) + '****' + tel.slice(-2), hasToken: Boolean(body?.token), hasValidate: Boolean(validateRaw), hasSeccode: Boolean(seccode) })
    try {
      const data = await bili('/x/passport-login/web/sms/send', { method: 'POST', form, base: PASSPORT })
      lastCaptchaKey = data?.captcha_key || ''
      trace('smsSend.ok', { captchaKeyPrefix: lastCaptchaKey.slice(0, 8) })
      json(res, 200, { ok: true, captchaKey: lastCaptchaKey })
    } catch (error) {
      trace('smsSend.err', { code: error.code, message: error.message })
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 用短信验证码登录，成功后吸收 Set-Cookie 并读一次 nav。 */
  const smsLogin = async (req, res) => {
    let body
    try { body = await readBody(req) } catch (error) { return json(res, 400, { ok: false, error: error.message }) }
    // 只有勾了「记住账号」才把会话写进磁盘
    persistSession = body?.remember === true
    const tel = String(body?.tel || '').trim()
    const code = String(body?.code || '').trim()
    if (!/^1\d{10}$/.test(tel)) return json(res, 400, { ok: false, error: '手机号格式不对' })
    if (!/^\d{4,8}$/.test(code)) return json(res, 400, { ok: false, error: '验证码应为 4~8 位数字' })
    await ensureBuvid()
    try {
      // 严格按官方文档：只传 cid / tel / code / source / captcha_key。
      // 多传 platform、token、csrf、keep=1 都会被判 -400。
      const captchaKey = String(body?.captchaKey || lastCaptchaKey || '')
      const form = new URLSearchParams({ cid: '86', tel, code, source: 'main_web' })
      if (captchaKey) form.set('captcha_key', captchaKey)
      const response = await fetch(`${PASSPORT}/x/passport-login/web/login/sms`, {
        method: 'POST',
        headers: headers({ 'content-type': 'application/x-www-form-urlencoded', origin: 'https://passport.bilibili.com', referer: 'https://passport.bilibili.com/' }),
        body: form.toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      absorbCookies(response)
      const payload = await response.json().catch(() => null)
      trace('smsLogin.resp', {
        code: payload?.code,
        message: payload?.message,
        hasSessdata: Boolean(session.cookies.SESSDATA),
        hasBiliJct: Boolean(session.cookies.bili_jct),
        cookieKeys: Object.keys(session.cookies).slice(0, 8),
      })
      if (!payload || payload.code !== 0) {
        trace('smsLogin.err', { code: payload?.code, message: payload?.message, data: JSON.stringify(payload?.data || {}).slice(0, 200) })
        return json(res, 200, { ok: false, error: payload?.message || '登录失败', code: payload?.code })
      }
      const navPayload = await bili('/x/web-interface/nav', { raw: true })
      const nav = navPayload?.data || null
      trace('smsLogin.nav', { navCode: navPayload?.code, isLogin: nav?.isLogin, uname: nav?.uname || '' })
      if (nav?.isLogin) {
        session.user = {
          mid: nav.mid, uname: nav.uname, face: nav.face,
          level: nav.level_info?.current_level ?? 0, vip: nav.vipStatus === 1, coins: nav.money ?? 0,
        }
        session.savedAt = Date.now()
        saveSession()
      }
      json(res, 200, { ok: true, loggedIn: Boolean(nav?.isLogin), user: session.user })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 返回最近的调试追踪（不含任何 Cookie 原文）。 */
  const debug = async (req, res) => {
    json(res, 200, { ok: true, version: VERSION, entries: debugRing.slice(0, 20) })
  }

  /** 取播放地址：登录后走官方 playurl，qn 从 116（1080p60 高码率）逐级降。
   *  只是给前端看质量信息用，真正播放走 /stream（浏览器直连 CDN 会被 Referer 拦截）。 */
  const playurl = async (req, res) => {
    try {
      if (!isLoggedIn()) return json(res, 200, { ok: false, error: '高清直连需要登录', code: -101 })
      const bvid = query(req).get('bvid') || ''
      const cid = query(req).get('cid') || ''
      if (!/^BV[0-9A-Za-z]{10}$/.test(bvid) || !/^\d+$/.test(cid)) {
        return json(res, 400, { ok: false, error: 'bvid 或 cid 不对' })
      }
      let picked = null
      for (const qn of [116, 80, 64, 32]) {
        const data = await bili(`/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=${qn}&fnval=0&fnver=0&fourk=1&platform=html5&high_quality=1`)
        const durl = data?.durl?.[0]
        if (durl?.url) { picked = { url: durl.url, size: durl.size ?? 0, qn, quality: data.quality ?? qn }; break }
      }
      if (!picked) return json(res, 200, { ok: false, error: '拿不到播放地址' })
      json(res, 200, { ok: true, qn: picked.qn, quality: picked.quality, size: picked.size })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 官方完整清晰度阶梯（含当前账号用不了的档位——前端照常展示，
   *  点击时按 needLogin / needVip 提示）。 */
  const QUALITY_LADDER = [
    { quality: 6, label: '240P' },
    { quality: 16, label: '360P' },
    { quality: 32, label: '480P' },
    { quality: 64, label: '720P', needLogin: true },
    { quality: 80, label: '1080P', needLogin: true },
    { quality: 112, label: '1080P 高码率', needLogin: true },
    { quality: 116, label: '1080P 60帧', needLogin: true },
    { quality: 120, label: '4K', needLogin: true, needVip: true },
    { quality: 125, label: 'HDR 真彩', needLogin: true, needVip: true },
    { quality: 126, label: '杜比视界', needLogin: true, needVip: true },
  ]

  const qualities = async (req, res) => {
    try {
      const params = query(req)
      const bvid = params.get('bvid') || ''
      const cid = params.get('cid') || ''
      if (!/^BV[0-9A-Za-z]{10}$/.test(bvid) || !/^\d+$/.test(cid)) {
        return json(res, 400, { ok: false, error: 'bvid 或 cid 不对' })
      }
      const data = await bili(`/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=127&fnval=16&fnver=0&fourk=1&platform=html5&high_quality=1`)
      const formats = (data?.support_formats || [])
        .map((f) => ({
          quality: Number(f.quality) || 0,
          label: String(f.new_description || f.display_desc || f.quality || ''),
          codec: Array.isArray(f.codecs) ? f.codecs[0] : '',
        }))
        .filter((f) => f.quality > 0)
        .sort((a, b) => a.quality - b.quality)

      // 大会员状态必须新鲜：user 为空或 vip 未知时现场补一次 nav
      let vip = session.user?.vip === true
      if (isLoggedIn() && (!session.user || session.user.vip === undefined)) {
        try {
          const payload = await bili('/x/web-interface/nav', { raw: true })
          const nav = payload?.data || null
          if (nav?.isLogin) {
            session.user = {
              mid: nav.mid, uname: nav.uname, face: nav.face,
              level: nav.level_info?.current_level ?? 0, vip: nav.vipStatus === 1, coins: nav.money ?? 0,
            }
            vip = nav.vipStatus === 1
            session.savedAt = Date.now()
            saveSession()
          }
        } catch { /* 保持旧值 */ }
      }

      json(res, 200, {
        ok: true,
        formats,
        all: QUALITY_LADDER,
        vip,
        login: isLoggedIn(),
      })
    } catch (error) {
      json(res, 200, { ok: false, error: error.message, code: error.code })
    }
  }

  /** 直连流代理：登录后能放 1080p；带 Range 转发（视频拖动依赖它）。
   *  只有这里能过 CDN 防盗链——由主机代为带上 Referer。 */
  const stream = async (req, res) => {
    try {
      if (!isLoggedIn()) { res.writeHead(401, { 'content-type': 'text/plain' }); res.end('login required'); return }
      const params = query(req)
      const bvid = params.get('bvid') || ''
      const cid = params.get('cid') || ''
      if (!/^BV[0-9A-Za-z]{10}$/.test(bvid) || !/^\d+$/.test(cid)) {
        res.writeHead(400, { 'content-type': 'text/plain' }); res.end('bad params'); return
      }
      let want = Number(params.get('qn')) || 0
      // 未指定时按 4K→1080p60→1080p高码→1080p→720p→480p 逐级降
      const ladder = want ? [want] : [120, 116, 112, 80, 64, 32]
      let url = null
      for (const qn of ladder) {
        const data = await bili(`/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=${qn}&fnval=0&fnver=0&fourk=1&platform=html5&high_quality=1`)
        const durl = data?.durl?.[0]
        if (durl?.url) { url = durl.url; break }
      }
      if (!url) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('no stream'); return }

      const range = String(req.headers?.range || '')
      const up = await fetch(url, {
        headers: {
          'user-agent': UA,
          referer: REFERER,
          ...(range ? { range } : {}),
        },
        signal: AbortSignal.timeout(40000),
      })
      const outHeaders = {}
      for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const v = up.headers.get(k)
        if (v) outHeaders[k] = v
      }
      if (!outHeaders['accept-ranges']) outHeaders['accept-ranges'] = 'bytes'
      res.writeHead(up.status, outHeaders)

      const reader = up.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!res.write(Buffer.from(value))) {
          await new Promise((resolve) => res.once('drain', resolve))
        }
      }
      res.end()
    } catch (error) {
      try { res.writeHead(502, { 'content-type': 'text/plain' }); res.end('upstream error') } catch {}
    }
  }

  /** 内嵌的 QR 生成库（避免把 50KB 源码塞进 client bundle）。 */
  const serveQrcode = async (req, res) => {
    try {
      const file = join(vendorDir, 'qrcode.js')
      const source = readFileSync(file)
      res.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': source.length,
      })
      res.end(source)
    } catch {
      res.writeHead(404).end()
    }
  }

  return { sessionInfo, navRefresh, logout, qrGenerate, qrPoll, importCookies, captcha, smsSend, smsLogin, debug, feed, search, hotsearch, followFeed, video, related, userCard, userVideos, userDynamics, follow, messageSend, messageHistory, myFavorites, myFollowings, playurl, stream, qualities, comments, like, coin, favorite, report, comment, repost, serveQrcode }
}

function guarded(fn) {
  return async (req, res) => {
    try {
      if (!isLocalRequest(req)) return json(res, 403, { ok: false, error: 'forbidden' })
      await fn(req, res)
    } catch (error) {
      try { json(res, 500, { ok: false, error: error?.message || String(error) }) } catch {}
    }
  }
}

function mountRoutes(ctx, vendorDir) {
  let webServer
  try {
    webServer = (typeof ctx?.get === 'function' ? ctx.get('webServer') : undefined) || ctx?.webServer
  } catch {
    webServer = ctx?.webServer
  }
  if (!webServer || typeof webServer.register !== 'function') {
    warn('webServer 仍不可用，接口未注册')
    return
  }

  const h = makeHandlers(vendorDir)
  const routes = [
    ['/session', h.sessionInfo],
    ['/nav', h.navRefresh],
    ['/logout', h.logout],
    ['/login/qr', h.qrGenerate],
    ['/login/qr/poll', h.qrPoll],
    ['/login/cookie', h.importCookies],
    ['/login/captcha', h.captcha],
    ['/login/sms/send', h.smsSend],
    ['/login/sms/verify', h.smsLogin],
    ['/login/debug', h.debug],
    ['/feed', h.feed],
    ['/search', h.search],
    ['/hotsearch', h.hotsearch],
    ['/followfeed', h.followFeed],
    ['/myfavorites', h.myFavorites],
    ['/myfollowings', h.myFollowings],
    ['/video', h.video],
    ['/related', h.related],
    ['/user', h.userCard],
    ['/uservideos', h.userVideos],
    ['/userdynamics', h.userDynamics],
    ['/follow', h.follow],
    ['/message/send', h.messageSend],
    ['/message/history', h.messageHistory],
    ['/playurl', h.playurl],
    ['/stream', h.stream],
    ['/qualities', h.qualities],
    ['/comments', h.comments],
    ['/like', h.like],
    ['/coin', h.coin],
    ['/favorite', h.favorite],
    ['/report', h.report],
    ['/comment', h.comment],
    ['/repost', h.repost],
    ['/vendor/qrcode.js', h.serveQrcode],
  ]

  const dispose = []
  for (const [suffix, handler] of routes) {
    try {
      const off = webServer.register({ kind: 'exact', path: BASE + suffix, handler: guarded(handler) })
      if (typeof off === 'function') dispose.push(off)
    } catch (error) {
      warn(`路由 ${suffix} 注册失败：${error?.message || error}`)
    }
  }

  if (typeof ctx?.effect === 'function') {
    ctx.effect(() => () => { for (const off of dispose) { try { off() } catch {} } }, `${NS}: routes`)
  }
  info(`v${VERSION} 已挂载 ${dispose.length}/${routes.length} 个接口`)
}

export function apply(ctx, _config = {}) {
  try {
    try { logger = ctx?.logger || console } catch {}
    loadSession()
    // 用 fileURLToPath：路径里有中文和空格（"新建文件夹 (3)"），pathname 会带 %20
    const vendorDir = join(dirname(fileURLToPath(import.meta.url)), 'vendor')

    if (typeof ctx?.inject === 'function') {
      ctx.inject(['webServer'], (httpCtx) => {
        try { mountRoutes(httpCtx, vendorDir) } catch (error) { warn(`路由挂载失败：${error?.message || error}`) }
      })
      return
    }
    mountRoutes(ctx, vendorDir)
  } catch (error) {
    warn(`初始化失败：${error?.message || error}`)
  }
}

export const __internals = { md5, wbiKey, signedQuery, sessionPath, pickVideo }
