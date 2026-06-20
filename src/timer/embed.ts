/**
 * Elite Standalone Export
 * Generates a COMPLETE self-contained single-file HTML (no external deps)
 * that replicates the core timer + worker behavior.
 * Respects the X-Frame-Options: DENY constraint — this is the "embed" solution.
 * Includes minimal premium glass styles + the exact worker source inlined as Blob.
 */

import type { TimerState } from './types';
import { SOUND_KEYS } from './types';
import { escapeHtml } from '../content'; // for safe interpolation of user label/msg into exported HTML/JS source

export function generateStandalone(initial?: Partial<TimerState>): string {
  const init = initial || {};
  const startDur = Math.max(0, Math.floor(init.durationMs || 5 * 60 * 1000));
  // Raw user strings (bounded like engine.setLabel/setFinishMessage). Escaping applied ONLY at export serialization points.
  const rawLabel = (init.label || 'Focus Session').slice(0, 80);
  const rawMsg = (init.finishMessage || 'Time is up!').slice(0, 200);
  const labelForAttr = escapeHtml(rawLabel); // safe for HTML attribute value="..."
  const msgForAttr = escapeHtml(rawMsg); // safe for HTML attribute value="..."
  const sound = init.soundKey || 'classic';
  const repeat = init.repeatSound !== false;
  const onZero = init.onZeroAction || 'stop';

  // Compute *source snippets* for safe embedding into the generated document's <script> (generator-time escaping).
  // JSON.stringify produces a valid JS string literal (incl. " and \ handling); additional replace prevents HTML parser from seeing </script> inside it.
  const jsLabelSrc = JSON.stringify(rawLabel).replace(/<\/(script|style)/gi, '<\\/$1');
  const jsMsgSrc = JSON.stringify(rawMsg).replace(/<\/(script|style)/gi, '<\\/$1');

  // Inlined worker source (must be kept in sync with src/timer/timer.worker.ts logic — minimal viable version)
  const workerSource = `
let targetWallMs=null, remainingMs=0, baseElapsedMs=0, lastMonotonic=0, tickInterval=null, tickMs=250;
function post(m){self.postMessage(m)}
function compute(){
  const now=performance.now();
  if(lastMonotonic>0){ const d=now-lastMonotonic; if(remainingMs>0) remainingMs=Math.max(0,remainingMs-d); }
  lastMonotonic=now;
  post({type:'TICK', remainingMs:Math.round(Math.max(0,remainingMs)), elapsedMs:Math.round(Math.max(0,baseElapsedMs+(targetWallMs?(targetWallMs-Date.now()):0)-remainingMs)), monotonic:now});
  if(remainingMs<=0 && tickInterval){ clearInterval(tickInterval); tickInterval=null; post({type:'FINISHED'}); }
}
function startLoop(){ if(tickInterval) clearInterval(tickInterval); lastMonotonic=performance.now(); tickInterval=setInterval(compute, tickMs); }
function stopLoop(){ if(tickInterval){clearInterval(tickInterval); tickInterval=null;} }
self.onmessage = (e)=>{
  const d=e.data||{};
  if(d.type==='INIT'){
    targetWallMs=d.payload.targetWallMs||null;
    const MAX_D=48*60*60*1000; const dur = Math.min(MAX_D, Math.max(0, d.payload.durationMs||0));
    remainingMs = targetWallMs ? Math.max(0,targetWallMs-Date.now()) : dur;
    baseElapsedMs=d.payload.baseElapsedMs||0;
    tickMs=Math.min(1000,Math.max(50,d.payload.tickMs||250));
    lastMonotonic=performance.now(); startLoop(); compute();
  } else if(d.type==='START'){ if(!tickInterval) startLoop(); compute(); }
    else if(d.type==='PAUSE'){ stopLoop(); if(targetWallMs) remainingMs=Math.max(0,targetWallMs-Date.now()); compute(); }
    else if(d.type==='RESUME'){ if(targetWallMs) targetWallMs=Date.now()+remainingMs; lastMonotonic=performance.now(); startLoop(); compute(); }
    else if(d.type==='RESET'){ stopLoop(); remainingMs=0; baseElapsedMs=0; targetWallMs=null; post({type:'TICK',remainingMs:0,elapsedMs:0,monotonic:performance.now()}); }
    else if(d.type==='SYNC_REQUEST'){ compute(); }
    else if(d.type==='SET_DURATION'){
      const MAX_D=48*60*60*1000; const t=Math.min(MAX_D,Math.max(0,d.totalMs|0)); remainingMs=t; baseElapsedMs=0; targetWallMs = t>0 ? Date.now()+t : null; lastMonotonic=performance.now(); compute();
    }
};
post({type:'PONG',now:performance.now(),remainingMs:0});
`.trim();

  // Minimal self-contained page (glass aesthetic, no external CSS/FA)
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Elite Timer • Standalone (vClock replica)</title>
<style>
:root { color-scheme: dark; }
body { margin:0; background:#0a0a0f; color:#f4f4f5; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
.glass { background:rgba(255,255,255,0.08); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); box-shadow:0 8px 32px rgba(0,0,0,0.12); border-radius:24px; }
.timer-time { font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; font-feature-settings:"tnum"; letter-spacing:-0.05em; }
.btn { padding:12px 28px; border-radius:9999px; font-weight:600; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06); color:#fff; cursor:pointer; }
.btn-primary { background:#fff; color:#111; border:none; }
.preset { padding:6px 14px; border-radius:9999px; font-size:13px; border:1px solid rgba(255,255,255,0.15); background:transparent; color:#ddd; cursor:pointer; margin:3px; }
.preset:hover { border-color:#a78bfa; }
input,select { background:#111; border:1px solid #27272a; color:#eee; padding:8px 12px; border-radius:12px; }
.progress { height:4px; background:rgba(255,255,255,0.1); border-radius:999px; overflow:hidden; }
.fill { height:100%; background:linear-gradient(to right,#864cff,#a78bfa); width:0%; transition:width .1s linear; }
</style></head>
<body>
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:#0a0a0f">
  <div class="glass" style="width:100%;max-width:820px;padding:20px 24px 28px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-weight:700;font-size:21px;letter-spacing:-0.02em">Elite Timer <span style="font-size:11px;opacity:.6">(standalone • background-proof)</span></div>
      <button onclick="document.documentElement.requestFullscreen?.()" class="btn" style="padding:6px 12px;font-size:12px">⤢ FS</button>
    </div>

    <div id="d" class="timer-time" style="font-size:clamp(3.2rem,12vw,7rem);text-align:center;line-height:1;margin:12px 0 6px;color:#fff;text-shadow:0 3px 24px rgba(0,0,0,.5)" aria-live="polite">05:00</div>
    <div id="st" style="text-align:center;font-size:11px;letter-spacing:2px;color:#34d399;margin-bottom:8px">READY</div>
    <div class="progress"><div id="p" class="fill"></div></div>

    <div style="margin:14px 0 8px;text-align:center">
      ${[60,180,300,600,900,1500,1800,2700,3600].map(ms => `<button class="preset" data-ms="${ms}">${ms/60}m</button>`).join('')}
      <button class="preset" id="dt">Date/Time target</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
      <div>
        <div style="font-size:10px;opacity:.6;letter-spacing:1px">DURATION (H:M:S)</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
          <input id="h" type="number" value="0" style="width:52px;text-align:center">
          <span>:</span><input id="m" type="number" value="5" style="width:52px;text-align:center">
          <span>:</span><input id="s" type="number" value="0" style="width:52px;text-align:center">
          <button id="setd" class="btn" style="padding:6px 14px;font-size:13px">Set</button>
        </div>
      </div>
      <div>
        <div style="font-size:10px;opacity:.6;letter-spacing:1px">TITLE</div>
        <input id="lab" value="${labelForAttr}" style="width:100%;margin-top:3px">
        <div style="font-size:10px;opacity:.6;letter-spacing:1px;margin-top:6px">MESSAGE</div>
        <input id="msg" value="${msgForAttr}" style="width:100%;margin-top:3px">
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
      <select id="snd" style="flex:1;min-width:120px">
        ${SOUND_KEYS.map(k => `<option value="${k}" ${k===sound?'selected':''}>${k}</option>`).join('')}
      </select>
      <label style="font-size:13px;display:flex;align-items:center;gap:6px"><input id="rep" type="checkbox" ${repeat?'checked':''}> Repeat</label>
      <button id="test" class="btn" style="padding:6px 14px;font-size:13px">Test Sound</button>
    </div>

    <div style="margin-top:10px;font-size:12px;opacity:.75">ON ZERO:
      <label><input type="radio" name="oz" value="stop" ${onZero==='stop'?'checked':''}> Stop</label>
      <label><input type="radio" name="oz" value="restart" ${onZero==='restart'?'checked':''}> Restart</label>
      <label><input type="radio" name="oz" value="stopwatch" ${onZero==='stopwatch'?'checked':''}> Stopwatch</label>
    </div>

    <div style="margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <button id="go" class="btn btn-primary" style="padding:13px 42px;font-size:17px">START</button>
      <button id="pa" class="btn" style="display:none">PAUSE</button>
      <button id="re" class="btn" style="display:none">RESUME</button>
      <button id="rst" class="btn">RESET</button>
    </div>

    <div style="text-align:center;margin-top:14px;font-size:10px;opacity:.5">This standalone file contains a full Web Worker timing engine. It keeps accurate time when the tab is hidden.</div>
  </div>
</div>

<script>
(function(){
  const workerSrc = \`${workerSource.replace(/`/g, '\\`')}\`;
  let w = null;
  let state = { remaining: ${startDur}, duration: ${startDur}, label: ${jsLabelSrc}, msg: ${jsMsgSrc}, sound: "${sound}", repeat: ${repeat}, onZero: "${onZero}", status:'IDLE', target:null };

  function $(id){ return document.getElementById(id); }
  function fmt(ms, showMs){
    const t=Math.floor(ms/1000), h=Math.floor(t/3600), m=Math.floor((t%3600)/60), s=t%60, mi=Math.floor((ms%1000)/10);
    const p=n=>String(n).padStart(2,'0');
    return h>0 ? (showMs? p(h)+':'+p(m)+':'+p(s)+'.'+p(mi) : p(h)+':'+p(m)+':'+p(s)) : (showMs? p(m)+':'+p(s)+'.'+p(mi) : p(m)+':'+p(s));
  }
  function render(){
    $('d').textContent = fmt(state.remaining, false);
    $('st').textContent = state.status==='RUNNING' ? 'RUNNING • BACKGROUND PROOF' : state.status;
    const pct = state.duration>0 ? Math.max(0,Math.min(100, Math.round(state.remaining/state.duration*100))) : 0;
    $('p').style.width = pct+'%';
    $('go').style.display = (state.status==='RUNNING'||state.status==='PAUSED')?'none':'inline-block';
    $('pa').style.display = state.status==='RUNNING'?'inline-block':'none';
    $('re').style.display = state.status==='PAUSED'?'inline-block':'none';
  }
  function makeWorker(){
    if (w) { try{w.terminate()}catch(e){} }
    const blob = new Blob([workerSrc], {type:'application/javascript'});
    w = new Worker(URL.createObjectURL(blob));
    w.onmessage = (ev)=>{
      const m=ev.data||{};
      if(m.type==='TICK'){
        state.remaining = Math.max(0, m.remainingMs|0);
        render();
        if(state.remaining<=0 && state.status==='RUNNING'){ finish(); }
      } else if(m.type==='FINISHED'){ finish(); }
    };
    return w;
  }
  function post(msg){ if(!w) makeWorker(); w.postMessage(msg); }
  function start(){
    const dur = state.remaining || state.duration;
    if(dur<=0) return;
    state.target = Date.now()+dur;
    state.status = 'RUNNING';
    post({type:'INIT', payload:{ targetWallMs: state.target, durationMs: dur }});
    post({type:'START'});
    render();
  }
  function pause(){ if(state.status!=='RUNNING')return; state.status='PAUSED'; post({type:'PAUSE'}); render(); }
  function resume(){ if(state.status!=='PAUSED')return; state.target = Date.now() + state.remaining; state.status='RUNNING'; post({type:'INIT',payload:{targetWallMs:state.target,durationMs:state.remaining}}); post({type:'RESUME'}); render(); }
  function reset(){ state.status='IDLE'; state.remaining=state.duration; state.target=null; if(w){ try{w.postMessage({type:'RESET'})}catch(e){} } render(); stopAlarm(); }
  function finish(){
    state.status='FINISHED'; state.remaining=0; render(); stopAlarm();
    try {
      if (document.hidden && window.Notification && Notification.permission==='granted') {
        new Notification(state.label || 'Timer', { body: state.msg || 'Time is up!', requireInteraction:true });
      }
    } catch(e){}
    // Audio synth (same simple tones)
    try { playSeq(state.sound, state.repeat); } catch(e){}
    // On zero behavior
    const act = state.onZero;
    setTimeout(()=>{
      if(act==='restart'){ reset(); start(); }
      else if(act==='stopwatch'){
        // Simple visual stopwatch: count from zero
        state.status='RUNNING'; state.remaining=0; state.duration=999999999; render();
        // start counting up by faking negative target
        const iv = setInterval(()=>{ if(state.status!=='RUNNING'){clearInterval(iv);return;} state.remaining += 250; render(); },250);
      }
    }, 520);
  }
  let aCtx=null, alrm=null;
  async function ensureA(){ if(!aCtx){ const AC=window.AudioContext||window.webkitAudioContext; aCtx=new AC(); } if(aCtx.state==='suspended') await aCtx.resume(); }
  function tone(f,d,v=0.6){ if(!aCtx) return; const o=aCtx.createOscillator(), g=aCtx.createGain(), fl=aCtx.createBiquadFilter();
    o.type='sine'; o.frequency.value=f; fl.type='lowpass'; fl.frequency.value=f*1.8; const t=aCtx.currentTime; g.gain.value=v; g.gain.linearRampToValueAtTime(0.0001,t+d/1000+0.03);
    o.connect(fl); fl.connect(g); g.connect(aCtx.destination); o.start(t); o.stop(t+d/1000+0.05); }
  function playSeq(key, rep){
    ensureA().then(()=>{
      const seq = (key==='bell' || key==='chimes') ? [[523,420],[659,380],[784,520]] : [[880,160],[660,220],[440,160]];
      const play=()=>{ let off=0; seq.forEach(([f,d])=>{ setTimeout(()=>tone(f,d), off); off+=d+30; }); };
      play();
      if(rep){ if(alrm) clearInterval(alrm); alrm=setInterval(play, 1700); setTimeout(()=>{ if(alrm){clearInterval(alrm);alrm=null;} }, 1000*60*3); }
    }).catch(()=>{});
  }
  function stopAlarm(){ if(alrm){clearInterval(alrm);alrm=null;} }

  // Wire DOM
  function wire(){
    $('go').onclick = () => start();
    $('pa').onclick = pause;
    $('re').onclick = resume;
    $('rst').onclick = reset;
    $('test').onclick = ()=>{ ensureA().then(()=>playSeq($('snd').value, false)); };
    $('setd').onclick = ()=>{
      const h=parseInt($('h').value||0), m=parseInt($('m').value||0), s=parseInt($('s').value||0);
      const MAX_D=48*60*60*1000; const ms = Math.min(MAX_D, Math.max(0, (h*3600+m*60+s)*1000)); if(ms>0){ state.duration=ms; state.remaining=ms; state.target=null; state.status='IDLE'; render(); post({type:'SET_DURATION',totalMs:ms}); }
    };
    document.querySelectorAll('.preset[data-ms]').forEach(b=> b.onclick=()=>{ const MAX_D=48*60*60*1000; const ms=Math.min(MAX_D, Math.max(0,parseInt(b.dataset.ms)||0)); state.duration=ms; state.remaining=ms; render(); post({type:'SET_DURATION',totalMs:ms}); });
    $('dt').onclick = ()=>{ const i=document.createElement('input'); i.type='datetime-local'; document.body.appendChild(i); i.onchange=()=>{ const t=new Date(i.value).getTime(); const MAX_D=48*60*60*1000; const d=Math.min(MAX_D, Math.max(0,t-Date.now())); if(d){state.duration=d;state.remaining=d;render();post({type:'SET_DURATION',totalMs:d});} i.remove(); }; i.click(); };
    $('lab').oninput = ()=>{ state.label = $('lab').value; };
    $('msg').oninput = ()=>{ state.msg = $('msg').value; };
    $('snd').onchange = ()=>{ state.sound=$('snd').value; };
    $('rep').onchange = ()=>{ state.repeat=$('rep').checked; };
    document.querySelectorAll('input[name="oz"]').forEach(r=> r.onchange=()=>{ if(r.checked) state.onZero=r.value; });
    // Keyboard
    document.addEventListener('keydown', e=>{
      if(e.key===' '){ e.preventDefault(); if(state.status==='RUNNING') pause(); else if(state.status==='PAUSED') resume(); else start(); }
      if(e.key.toLowerCase()==='r') reset();
    });
    // Restore initial
    state.sound = '${sound}'; $('snd').value = state.sound;
    state.repeat = ${repeat}; $('rep').checked = state.repeat;
    state.onZero = '${onZero}'; document.querySelector('input[name="oz"][value="'+state.onZero+'"]').checked=true;
    $('lab').value = state.label || 'Focus Session'; $('msg').value = state.msg || 'Time is up!';
    render();
    // Boot worker early (but idle)
    makeWorker();
    // Visibility recovery (core of background guarantee)
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && w){ w.postMessage({type:'SYNC_REQUEST'}); } });
  }
  wire();
  // If initial remaining was passed we could auto-start here but we leave user in control (safe).
})();
</script>
</body></html>`;

  return html;
}
