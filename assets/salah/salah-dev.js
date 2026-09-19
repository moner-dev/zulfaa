// ZULFAA Salah section - DEV tools. Loaded ONLY when the address carries ?salah-dev ; never part of the design.
// English only on purpose: this is a developer instrument, not product UI.
//
//   ?salah-dev                         the panel
//   ?salah-dev&t=19:40                 start at a simulated clock time (in the PLACE's time zone)
//   ?salah-dev&city=beirut             look at a city (QA presets below, or any id from places.json)
//                                      DEV places are EPHEMERAL: neither the address nor the panel stores anything, and neither
//                                      clears a city the visitor really chose - only the user-facing picker does that
//   ?salah-dev&method=ISNA&asr=2       calculation config
import { METHODS } from './prayer-times.js'

const PRESETS = ['amsterdam', 'beirut', 'damascus', 'london', 'new-york', 'makkah', 'jakarta', 'oslo'] // QA only - not a product list

export function mount(root, app, api) {
  const params = new URLSearchParams(location.search)
  const el = document.createElement('aside')
  el.setAttribute('aria-label', 'Salah section DEV tools')
  el.style.cssText = 'position:fixed;inset-inline-end:12px;bottom:12px;z-index:9999;width:340px;max-height:86vh;overflow:auto;padding:12px;border-radius:12px;background:#10141c;color:#e8ecf4;border:1px solid #2b3550;font:12px/1.45 ui-monospace,Consolas,monospace;box-shadow:0 20px 50px -20px #000;direction:ltr;text-align:left'
  el.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><strong style="color:#e9a24b">SALAH DEV</strong><span style="flex:1"></span>
      <button data-d="real">REAL TIME</button><button data-d="hide">hide</button></div>
    <div style="display:flex;gap:6px;align-items:baseline"><output data-d="clock" style="font-size:22px;font-weight:700">--:--</output><span data-d="mode"></span></div>
    <input data-d="slider" type="range" min="0" max="1439.75" step="0.25" style="width:100%;accent-color:#e9a24b" aria-label="Simulated time of day">
    <div style="display:flex;justify-content:space-between;color:#8d99b3;font-size:10px"><span>00</span><span>04</span><span>08</span><span>12</span><span>16</span><span>20</span><span>24</span></div>
    <div data-d="anchors" style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0"></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><button data-d="play">Play day</button>
      <label>in <select data-d="speed"><option value="30">30 s</option><option value="60" selected>60 s</option><option value="180">3 min</option></select></label>
      <button data-d="reveal">Replay reveal</button></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><label>city <select data-d="city"></select></label>
      <label>method <select data-d="method"></select></label><label>asr <select data-d="asr"><option value="1">standard</option><option value="2">Hanafi</option></select></label></div>
    <pre data-d="out" style="margin:0;white-space:pre-wrap;color:#b8c4dc"></pre>`
  document.body.append(el)
  if (params.get('salah-dev') === 'quiet') el.style.display = 'none' // URL-driven simulation without the panel (review screenshots)
  const d = (k) => el.querySelector(`[data-d="${k}"]`)
  el.querySelectorAll('button,select').forEach((b) => (b.style.cssText = 'font:inherit;color:inherit;background:#1d2433;border:1px solid #2b3550;border-radius:6px;padding:3px 7px;cursor:pointer'))

  const cities = api.allCities()
  d('city').innerHTML = '<option value="">own place (saved city or time zone)</option>' + [...PRESETS.map((id) => cities.find((c) => c.id === id)).filter(Boolean), ...cities.filter((c) => !PRESETS.includes(c.id))]
    .map((c) => `<option value="${c.id}">${c.name.en}</option>`).join('')
  d('method').innerHTML = Object.entries(METHODS).map(([k, v]) => `<option value="${k}">${k} - ${v.label}</option>`).join('')
  const POINTS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
  d('anchors').innerHTML = POINTS.map((p) => `<button data-anchor="${p}">${p}</button>`).join('') + '<button data-anchor="midnight">23:58</button>'
  d('anchors').querySelectorAll('button').forEach((b) => (b.style.cssText = 'font:inherit;color:inherit;background:#1d2433;border:1px solid #2b3550;border-radius:6px;padding:3px 7px;cursor:pointer'))

  const setSim = (minutes) => { app.sim = minutes == null ? null : ((minutes % 1440) + 1440) % 1440; if (minutes == null) app.simShown = null; app.dirty = true; api.tickUi() }
  d('slider').addEventListener('input', () => { app.playing = false; d('play').textContent = 'Play day'; setSim(Number(d('slider').value)) })
  d('real').addEventListener('click', () => { app.playing = false; d('play').textContent = 'Play day'; setSim(null) })
  d('hide').addEventListener('click', () => el.remove())
  d('anchors').addEventListener('click', (e) => { const a = e.target.dataset.anchor; if (!a) return; app.playing = false; setSim(a === 'midnight' ? 1438 : app.model.times[a]) })
  d('play').addEventListener('click', () => { app.playing = !app.playing; d('play').textContent = app.playing ? 'Pause' : 'Play day'; if (app.playing && app.sim == null) setSim(app.model.clock.minutes) })
  d('reveal').addEventListener('click', () => { app.reveal = { start: performance.now(), ms: 1800, behind: 38 } })
  d('city').addEventListener('change', () => api.setPlace(d('city').value ? api.previewCity(d('city').value) : api.currentPlace()))
  const setConfig = () => { app.config = { ...app.config, method: d('method').value, asrFactor: Number(d('asr').value) }; app.dirty = true; api.tickUi() }
  d('method').addEventListener('change', setConfig)
  d('asr').addEventListener('change', setConfig)

  let last = performance.now()
  const step = (now) => {
    requestAnimationFrame(step)
    const dt = (now - last) / 1000; last = now
    if (app.playing && app.sim != null) { app.sim = (app.sim + (1440 / Number(d('speed').value)) * dt) % 1440; app.dirty = true }
  }
  requestAnimationFrame(step)

  app.listeners.add((m) => {
    d('clock').textContent = api.hhmm(m.clock.minutes)
    d('mode').textContent = m.clock.simulated ? 'simulated, in ' + m.place.tz : 'real time, in ' + m.place.tz
    if (document.activeElement !== d('slider')) d('slider').value = m.clock.minutes
    const e = app.engine
    d('out').textContent = [
      `place        ${m.place.name.en} (${m.place.lat}, ${m.place.lon}) [${m.place.source}]`,
      `times        ${POINTS.map((p) => p[0].toUpperCase() + ' ' + api.hhmm(m.times[p])).join('  ')}`,
      `adjusted     ${m.adjusted.join(', ') || '-'}   method ${m.config.method}, asr x${m.config.asrFactor}, ${m.config.highLatitude}`,
      `visual state ${m.visualState}        ui status ${m.status}`,
      `current      ${m.currentPrayer || '- (no Salah time: after sunrise)'}`,
      `next         ${m.nextPrayer.id}${m.nextPrayer.tomorrow ? ' (tomorrow)' : ''} at ${api.hhmm(m.nextPrayer.at)}, in ${m.nextPrayer.inMinutes.toFixed(1)} min`,
      `scene        frame ${m.scene.frame.toFixed(2)}  track segment ${m.scene.segmentIndex}  progress ${(m.scene.progress * 100).toFixed(1)} %`,
      `day line     ${(m.dayLine.position * 100).toFixed(1)} %${m.dayLine.night ? ' (night)' : ''}`,
      e ? `engine       ${e.renderer.canvas.width}x${e.renderer.canvas.height}  scale ${app.scale.toFixed(2)}  cpu ${e.renderer.stats.cpuMs.toFixed(1)} ms  textures ${(e.renderer.stats.textureBytes / 1048576).toFixed(0)} MB` : `engine       ${app.engineFailed ? 'unavailable - poster fallback' : 'not loaded yet'}`,
    ].join('\n')
  })

  if (params.get('method') && METHODS[params.get('method')]) d('method').value = params.get('method')
  if (params.get('asr') === '2') d('asr').value = '2'
  if (params.get('method') || params.get('asr')) setConfig()
  if (params.get('city')) { d('city').value = params.get('city'); if (d('city').value) api.setPlace(api.previewCity(params.get('city'))) }
  if (params.get('t')) { const [h, mi] = params.get('t').split(':').map(Number); setSim(h * 60 + (mi || 0)) }
  api.tickUi()
}
