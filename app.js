// 삼국지2 리마스터 — 원본 게임 실행 + 그래픽/사운드 리마스터 계층
(function(){
const $=s=>document.querySelector(s);
const RM=window.Remaster, MS=window.Sound;
const K={ENTER:257,ESC:256,BS:259,SPACE:32,UP:265,DOWN:264,LEFT:263,RIGHT:262,KP:n=>320+n};
const S={ci:null,frame:null,dirty:false,scene:'title',sound:'modern',keysSince:0,db:null,uid:null,dl:null,lastDate:0,lastDuel:false,started:false};
window.APP=S;
const LS='sam2rm2_';
const loadOpt=()=>{ try{ const o=JSON.parse(localStorage.getItem(LS+'opt')||'null'); if(o){ Object.assign(RM.opts,o.gfx||{}); if(o.modern&&window.Modern) Object.assign(Modern.opts,o.modern); if(o.sound) S.sound=o.sound; if(o.tapEnter!==undefined) S.tapEnter=o.tapEnter; } }catch(e){} };
const saveOpt=()=>{ try{ localStorage.setItem(LS+'opt',JSON.stringify({gfx:RM.opts,modern:window.Modern?Modern.opts:null,sound:S.sound,tapEnter:S.tapEnter})); }catch(e){} };
S.tapEnter=true; loadOpt();
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('on'),2600); }
// ---------- 저장소 ----------
async function storeInit(){ try{ if(window.claude&&window.claude.use){ const [db,user,dl]=await Promise.all([claude.use('db'),claude.use('user'),claude.use('downloads')]); S.dl=dl||null; if(db&&user){ S.uid=await user.id(); S.db=db; } } }catch(e){} }
const b64=u=>{ let s=''; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(s); };
const unb64=s=>{ const b=atob(s); const u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; };
async function loadChanges(){ if(S.db){ try{ const d=await S.db.doc('data/users/'+S.uid+'/fs/latest').get(); const v=d&&d.data?d.data():d; if(v&&v.b64) return unb64(v.b64); }catch(e){} }
  try{ const s=localStorage.getItem(LS+'fs'); if(s) return unb64(s); }catch(e){} return null; }
async function saveChanges(){ if(!S.ci) return; try{ const p=await S.ci.persist(); if(!p||p.length<200) return; const s=b64(p); let where='브라우저';
    if(S.db){ try{ await S.db.doc('data/users/'+S.uid+'/fs/latest').set({b64:s,t:Date.now()}); where='계정'; }catch(e){} }
    try{ localStorage.setItem(LS+'fs',s); }catch(e){}
    S.lastSaved=Date.now(); $('#savestate').textContent='세이브 보관됨 ('+where+') '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}); }catch(e){} }
setInterval(()=>{ if(S.dirty){ S.dirty=false; saveChanges(); } },20000);
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&S.ci) saveChanges(); });
// ---------- 사운드: 원작 FM 스트림 + 현대식 음향 처리 ----------
const A={ctx:null,ring:new Float32Array(44100*2),w:0,r:0,gain:null,node:null};
function audioInit(rate){ if(A.ctx) return; try{ const C=window.AudioContext||window.webkitAudioContext; A.ctx=new C({sampleRate:rate});
    const node=A.ctx.createScriptProcessor(2048,0,2); A.node=node;
    node.onaudioprocess=e=>{ const L=e.outputBuffer.getChannelData(0),R=e.outputBuffer.getChannelData(1); const n=L.length; const avail=(A.w-A.r+A.ring.length)%A.ring.length;
      for(let i=0;i<n;i++){ let v=0; if(i<avail){ v=A.ring[A.r]; A.r=(A.r+1)%A.ring.length; } L[i]=v; R[i]=v; } };
    // 리마스터 체인: 따뜻한 저역, 거친 고역 완화, 스테레오 확장, 홀 리버브, 컴프레서
    const lo=A.ctx.createBiquadFilter(); lo.type='lowshelf'; lo.frequency.value=180; lo.gain.value=4;
    const hi=A.ctx.createBiquadFilter(); hi.type='highshelf'; hi.frequency.value=5500; hi.gain.value=-5;
    const mid=A.ctx.createBiquadFilter(); mid.type='peaking'; mid.frequency.value=2500; mid.Q.value=0.8; mid.gain.value=-2;
    const split=A.ctx.createChannelSplitter(2), merge=A.ctx.createChannelMerger(2), dl=A.ctx.createDelay(); dl.delayTime.value=0.014; const dr=A.ctx.createDelay(); dr.delayTime.value=0.003;
    const conv=A.ctx.createConvolver(); conv.buffer=impulse(A.ctx,2.4,2.8); const wet=A.ctx.createGain(); wet.gain.value=0.22;
    const comp=A.ctx.createDynamicsCompressor(); comp.threshold.value=-16; comp.ratio.value=3;
    A.gain=A.ctx.createGain(); A.gain.gain.value=S.sound==='original'?0.9:0;
    node.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(split); split.connect(dl,0); split.connect(dr,1); dl.connect(merge,0,0); dr.connect(merge,0,1);
    merge.connect(comp); hi.connect(conv); conv.connect(wet); wet.connect(comp); comp.connect(A.gain); A.gain.connect(A.ctx.destination);
  }catch(e){ console.warn(e); } }
function impulse(c,sec,decay){ const len=c.sampleRate*sec,b=c.createBuffer(2,len,c.sampleRate); for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);} return b; }
function pushSamples(s){ const ring=A.ring; for(let i=0;i<s.length;i++){ ring[A.w]=s[i]; A.w=(A.w+1)%ring.length; if(A.w===A.r) A.r=(A.r+1)%ring.length; } }
function applySound(){ if(A.gain) A.gain.gain.setTargetAtTime(S.sound==='original'?0.9:0,A.ctx.currentTime,0.1);
  if(S.sound==='modern'){ MS.init(); MS.set('bgm',true); MS.set('sfx',true); MS.music(sceneMusic(S.scene)); } else if(S.sound==='original'){ MS.music(null); MS.set('sfx',false); } else { MS.music(null); MS.set('sfx',false); }
  $('#sndlabel').textContent={modern:'현대 음악',original:'원작 FM',off:'소리 끔'}[S.sound]; }
const sceneMusic=s=>S.duel?'duel':S.victory?'victory':s==='battle'?'battle':s==='title'?'title':'map';
RM.onText=txt=>{ if(S.sound!=='modern') return; MS.cue(txt);
  const duel=/\d+회차/.test(txt); if(duel!==S.duel){ S.duel=duel; MS.music(sceneMusic(S.scene)); }
  if(/승리입니다|함락시켰|천하를 통일/.test(txt)&&!S.victory){ S.victory=true; MS.music('victory'); clearTimeout(S._vt); S._vt=setTimeout(()=>{ S.victory=false; MS.music(sceneMusic(S.scene)); },11000); } };
// ---------- 장면 감지 ----------
function sceneDetect(f){ const W=640; const white=0xffffffff>>>0; let box=0; for(const y of [14,20,28]) for(let x=40;x<110;x+=10) if(f[y*W+x]===white) box++;
  let rt=0; for(let x=430;x<630;x+=10) if(f[20*W+x]===white) rt++; let lw=0; for(let x=300;x<410;x+=10) if(f[20*W+x]===white) lw++;
  let sc=S.scene; if(box>=8) sc='map'; else if(box<4&&rt>=12&&lw<=3) sc='battle';
  if(sc!==S.scene){ const prev=S.scene; S.scene=sc; if(S.sound==='modern'){ MS.music(sceneMusic(sc)); if(sc==='battle'){ MS.sfx('horn'); setTimeout(()=>MS.sfx('march'),500); } else if(prev==='battle') MS.sfx('gong'); } }
  if(S.sound==='modern'){
    if(sc==='map'){ let h=0; for(let y=12;y<40;y+=2) for(let x=16;x<140;x+=3) h=(Math.imul(h,31)+f[y*W+x])|0; if(S.lastDate&&h!==S.lastDate) MS.sfx('month'); S.lastDate=h; }
  }
}
// ---------- 프레임 ----------
let pending=null, rafOn=false, lastF=null;
function onFrame(rgb,rgba){ let buf=rgba; const w=S.ci.width(),h=S.ci.height();
  if(!buf&&rgb){ buf=new Uint8Array(w*h*4); for(let i=0,j=0;i<rgb.length;i+=3,j+=4){buf[j]=rgb[i];buf[j+1]=rgb[i+1];buf[j+2]=rgb[i+2];buf[j+3]=255;} }
  if(!buf) return; pending={buf:buf.slice?buf.slice(0):buf,w,h}; if(!rafOn){ rafOn=true; const dt=performance.now()-lastPaint; if(dt>=33) requestAnimationFrame(paint); else setTimeout(()=>requestAnimationFrame(paint),33-dt); } }
let lastPaint=0;
function paint(){ rafOn=false; lastPaint=performance.now(); const p=pending; pending=null; if(!p) return;
  if(p.w===640&&p.h===400){ $('#raw').style.display='none';
    // 변경 없으면 생략
    const f=new Uint32Array(p.buf.buffer,p.buf.byteOffset,640*400);
    if(lastF&&lastF.length===f.length){ let same=true; for(let i=0;i<f.length;i+=97){ if(lastF[i]!==f[i]){same=false;break;} } if(same){ for(let i=0;i<f.length;i++){ if(lastF[i]!==f[i]){same=false;break;} } } if(same) return; }
    lastF=new Uint32Array(f); S.det=RM.render(p.buf); sceneDetect(f); }
  else { const c=$('#raw'); c.style.display='block'; c.width=p.w; c.height=p.h; const x=c.getContext('2d'); x.putImageData(new ImageData(new Uint8ClampedArray(p.buf.buffer,p.buf.byteOffset,p.w*p.h*4),p.w,p.h),0,0); } }
// ---------- 레이아웃 ----------
function layout(){ const wrap=$('#screen'); const r=wrap.getBoundingClientRect(); let w=r.width, h=w*3/4; if(h>r.height){ h=r.height; w=h*4/3; }
  const box=$('#scrbox'); box.style.width=w+'px'; box.style.height=h+'px'; RM.resize(Math.floor(w),Math.floor(h),Math.min(3,window.devicePixelRatio||1)); RM.redrawOverlay&&RM.redrawOverlay();
  if(lastF){ const t=lastF; lastF=null; pending={buf:new Uint8Array(t.buffer),w:640,h:400}; paint(); } }
window.addEventListener('resize',()=>setTimeout(layout,50));
// ---------- 입력 ----------
function key(code){ if(!S.ci) return; S.ci.simulateKeyPress(code); S.dirty=true; if(S.sound==='modern') MS.sfx(code===K.ENTER?'select':'tap'); if(navigator.vibrate) try{navigator.vibrate(8);}catch(e){} }
function buildPad(){ const pad=$('#pad'); pad.innerHTML='';
  const keys=[['ESC',K.ESC,'k-sys'],['Y',89,'k-yn'],['N',78,'k-yn'],['⌫',K.BS,'k-sys'],
    ['7','kp7','',"↖"],['8','kp8','',"↑"],['9','kp9','',"↗"],['가A','text','k-sys'],
    ['4','kp4','',"←"],['5','kp5',''],['6','kp6','',"→"],['스페이스',K.SPACE,'k-sys'],
    ['1','kp1','',"↙"],['2','kp2','',"↓"],['3','kp3','',"↘"],['ENTER',K.ENTER,'k-enter'],
    ['0','kp0','k-zero']];
  for(const [l,c,cls,sub] of keys){ const b=document.createElement('button'); b.className='k '+(cls||''); b.innerHTML=sub?`<b>${l}</b><i>${sub}</i>`:`<b>${l}</b>`;
    const fire=()=>{ if(c==='text'){ openText(); return; } key(typeof c==='string'?K.KP(+c.slice(2)):c); };
    b.addEventListener('pointerdown',e=>{ e.preventDefault(); b.classList.add('dn'); fire(); if(c!=='text'){ b._rep=setTimeout(function rep(){ fire(); b._rep=setTimeout(rep,90); },420); } });
    const up=()=>{ b.classList.remove('dn'); clearTimeout(b._rep); }; b.addEventListener('pointerup',up); b.addEventListener('pointerleave',up); b.addEventListener('pointercancel',up);
    pad.append(b); } }
function openText(){ const inp=$('#txt'); inp.value=''; $('#txtbox').classList.add('on'); inp.focus(); }
$('#txtgo').onclick=()=>{ const v=$('#txt').value.toUpperCase(); for(const ch of v){ const c=ch.charCodeAt(0); if(c>=65&&c<=90||c>=48&&c<=57) S.ci.simulateKeyPress(c); else if(ch===' ') S.ci.simulateKeyPress(32); else if(ch==='.') S.ci.simulateKeyPress(46); } S.ci.simulateKeyPress(K.ENTER); S.dirty=true; $('#txtbox').classList.remove('on'); };
$('#txtx').onclick=()=>$('#txtbox').classList.remove('on');
const KEYMAP={Enter:K.ENTER,Escape:K.ESC,Backspace:K.BS,' ':32,ArrowUp:K.UP,ArrowDown:K.DOWN,ArrowLeft:K.LEFT,ArrowRight:K.RIGHT};
window.addEventListener('keydown',e=>{ if(!S.ci||$('#txtbox').classList.contains('on')||$('#menu').classList.contains('on')) return; let c=KEYMAP[e.key];
  if(c===undefined&&e.key.length===1){ const ch=e.key.toUpperCase(); const cc=ch.charCodeAt(0); if(cc>=48&&cc<=57) c=e.code&&e.code.startsWith('Numpad')?K.KP(cc-48):cc; else if(cc>=65&&cc<=90) c=cc; }
  if(c!==undefined){ e.preventDefault(); key(c); } });
// 화면 터치 = Enter (설정에서 끌 수 있음)
$('#scrbox').addEventListener('click',()=>{ if(S.tapEnter&&S.ci) key(K.ENTER); });
// ---------- 메뉴 ----------
function menu(){ const m=$('#menu'); const o=RM.opts;
  const row=(label,on,fn)=>`<div class="mrow" data-f="${fn}"><span>${label}</span><b class="${on?'on':''}">${on?'켜짐':'꺼짐'}</b></div>`;
  m.querySelector('.mbody').innerHTML=
   `<h3>그래픽</h3>`+row('현대 글꼴로 글자 다시 그리기',Modern.opts.text,'m_text')+row('현대식 지도',Modern.opts.map,'m_map')+row('현대식 창 테두리',Modern.opts.frames,'m_frames')+row('고화질 초상화 (AI 업스케일)',o.hdFaces,'hdFaces')+row('고화질 전투 지형',o.hdTiles,'hdTiles')+row('점무늬 제거 (매끈한 색)',o.dedither,'dedither')+row('윤곽 다듬기 (4배 업스케일)',o.smooth,'smooth')+row('색감 보정',o.grade,'grade')+
   `<h3>사운드</h3><div class="mrow" data-f="snd"><span>사운드 모드</span><b class="on">${{modern:'현대 음악·효과음',original:'원작 FM + 현대 음향',off:'끔'}[S.sound]}</b></div>`+
   `<h3>조작</h3>`+row('화면 터치 = Enter',S.tapEnter,'tap')+
   `<h3>세이브</h3><div class="hint">게임 안의 "기능 → 저장"으로 저장하면 자동으로 계정/브라우저에 보관됩니다.</div><div class="mrow" data-f="savenow"><span>지금 보관하기</span><b class="on">실행</b></div><div class="mrow" data-f="export"><span>세이브 파일 내보내기 (.zip)</span><b class="on">실행</b></div><div class="mrow" data-f="import"><span>세이브 파일 가져오기</span><b class="on">선택</b></div><div class="mrow" data-f="reset"><span>보관된 세이브 지우고 원본으로</span><b>실행</b></div>`;
  m.classList.add('on'); }
$('#menuBtn').onclick=()=>{ MS.sfx('open'); menu(); };
$('#menu').addEventListener('click',async e=>{ if(e.target.id==='menu'||e.target.classList.contains('mclose')){ $('#menu').classList.remove('on'); return; }
  const r=e.target.closest('.mrow'); if(!r) return; const f=r.dataset.f; const o=RM.opts;
  if(f in o){ o[f]=!o[f]; saveOpt(); lastF=null; layout(); }
  if(f.startsWith('m_')){ const k=f.slice(2); Modern.opts[k]=!Modern.opts[k]; saveOpt(); lastF=null; layout(); }
  if(f==='snd'){ S.sound={modern:'original',original:'off',off:'modern'}[S.sound]; saveOpt(); applySound(); }
  if(f==='tap'){ S.tapEnter=!S.tapEnter; saveOpt(); }
  if(f==='savenow'){ await saveChanges(); toast('세이브를 보관했습니다.'); }
  if(f==='export'){ try{ const p=await S.ci.persist(); if(S.dl){ await S.dl.save({filename:'삼국지2_세이브.zip',data:p}); toast('내보냈습니다.'); } else toast('이 화면에서는 내보내기를 쓸 수 없습니다.'); }catch(err){ toast('내보내기 취소/실패'); } }
  if(f==='import'){ const inp=document.createElement('input'); inp.type='file'; inp.accept='.zip'; inp.onchange=async()=>{ const u=new Uint8Array(await inp.files[0].arrayBuffer()); const s=b64(u); try{ localStorage.setItem(LS+'fs',s);}catch(e){} if(S.db){ try{ await S.db.doc('data/users/'+S.uid+'/fs/latest').set({b64:s,t:Date.now()}); }catch(e){} } toast('가져왔습니다. 다시 시작합니다…'); setTimeout(()=>location.reload(),900); }; inp.click(); }
  if(f==='reset'){ if(S.db){ try{ await S.db.doc('data/users/'+S.uid+'/fs/latest').delete(); }catch(e){} } try{ localStorage.removeItem(LS+'fs'); }catch(e){} toast('초기화했습니다. 다시 시작합니다…'); setTimeout(()=>location.reload(),900); }
  menu(); });
// ---------- 시작 ----------
async function loadAssets(){ try{ const [fj,mj]=await Promise.all([fetch('font.json').then(r=>r.json()),fetch('mapdata.json').then(r=>r.json())]); Modern.loadFont(fj); Modern.loadMap(mj); }catch(e){ console.warn(e); }
  try{ await document.fonts.load("500 20px 'Noto Sans KR'"); await document.fonts.load("700 20px 'Noto Sans KR'"); }catch(e){}
  const kao=unb64((await (await fetch('kaodata.json')).json()).b64); RM.loadFaces(kao);
  for(let i=0;i<219;i++){ const im=new Image(); im.decoding='async'; im.src='faces/f'+String(i).padStart(3,'0')+'.webp'; RM.faceImgs[i]=im; }
  try{ const pm=await (await fetch('patches/manifest.json')).json(); for(const p of pm){ const im=new Image(); im.src='patches/'+p.file; RM.patches.push({x:p.x,y:p.y,w:p.w,h:p.h,hash:p.hash,img:im}); } }catch(e){}
  try{ const man=await (await fetch('tiles/manifest.json')).json(); for(const h in man){ const im=new Image(); im.src='tiles/'+man[h]; RM.tileMap.set(+h,im); } }catch(e){} }
async function start(){ if(S.started) return; S.started=true; const st=$('#start'); st.querySelector('.go').textContent='불러오는 중…';
  MS.init(); audioInit(44100);
  try{
    RM.init($('#gl'),$('#ov')); layout();
    await Promise.all([loadAssets(),storeInit()]);
    emulators.pathPrefix='emulators/';
    const game=unb64((await (await fetch('game.json')).json()).b64);
    const ch=await loadChanges(); const bundles=ch?[game,ch]:[game];
    let ci; try{ ci=await emulators.dosboxWorker(bundles); }catch(e){ console.warn('worker 실패, direct 사용',e); ci=await emulators.dosboxDirect(bundles); }
    S.ci=ci; ci.events().onFrame(onFrame); ci.events().onSoundPush(pushSamples);
    if(ci.directSound){ /* direct 모드는 링버퍼 폴링 */ const ds=ci.directSound; let last=0; setInterval(()=>{},1000); }
    st.classList.add('off'); setTimeout(()=>st.remove(),600); applySound(); if(ch) toast('보관된 세이브 파일을 불러왔습니다.');
  }catch(e){ st.querySelector('.go').textContent='시작 실패: '+e.message; console.error(e); S.started=false; } }
buildPad();
$('#start').addEventListener('click',start);
})();
