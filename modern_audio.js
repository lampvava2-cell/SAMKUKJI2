// 삼국지2 리마스터 - 현대 음악/효과음 엔진 (WebAudio 합성, 작곡된 테마)
(function(){
const A={ctx:null,on:{sfx:true,bgm:true},vol:{sfx:0.85,bgm:0.5},mode:null,timer:null,cache:{},cool:{}};
window.Sound=A;
A.init=function(ext){ if(A.ctx&&!ext){ if(A.ctx.state==='suspended') A.ctx.resume().catch(()=>{}); return; }
  try{ const C=window.AudioContext||window.webkitAudioContext; const c=A.ctx=ext||new C(); A.cache={};
    A.master=c.createGain(); A.master.gain.value=0.9; const comp=c.createDynamicsCompressor(); comp.threshold.value=-12; comp.ratio.value=3.5; comp.attack.value=0.01;
    A.master.connect(comp); comp.connect(c.destination);
    A.sfxG=c.createGain(); A.sfxG.gain.value=A.vol.sfx; A.sfxG.connect(A.master);
    A.bgmG=c.createGain(); A.bgmG.gain.value=A.vol.bgm; A.bgmG.connect(A.master);
    A.rev=c.createConvolver(); A.rev.buffer=impulse(3.0,2.6); A.revG=c.createGain(); A.revG.gain.value=0.32; A.rev.connect(A.revG); A.revG.connect(A.master);
    if(A.pending){ const m=A.pending; A.pending=null; A.music(m); } setTimeout(()=>A.loadSamples&&A.loadSamples(),0); }catch(e){ A.ctx=null; } };
A.set=function(k,on){ A.on[k]=on; if(!A.ctx) return; (k==='sfx'?A.sfxG:A.bgmG).gain.setTargetAtTime(on?A.vol[k]:0,A.ctx.currentTime,0.15); };
function impulse(sec,dec){ const c=A.ctx,n=c.sampleRate*sec,b=c.createBuffer(2,n,c.sampleRate); for(let ch=0;ch<2;ch++){ const d=b.getChannelData(ch); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,dec)*(i<c.sampleRate*0.01?i/(c.sampleRate*0.01):1); } return b; }
function noiseBuf(){ if(A.cache.n) return A.cache.n; const c=A.ctx,n=c.sampleRate*2,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; return A.cache.n=b; }
const NOTE={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const hz=n=>{ const m=/^([A-G][#b]?)(\d)$/.exec(n); return 440*Math.pow(2,(NOTE[m[1]]+12*(+m[2]+1)-69)/12); };
function env(g,t,a,p,d,s=0.0001){ g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(p,t+a); g.gain.exponentialRampToValueAtTime(Math.max(s,0.0001),t+a+d); }
const dst=d=>d||A.sfxG;
// ---------- 악기 ----------
function ksBuf(f,dur,bright){ const k=f.toFixed(1)+dur+bright; if(A.cache[k]) return A.cache[k]; const c=A.ctx,sr=c.sampleRate,n=Math.floor(sr*dur),b=c.createBuffer(1,n,sr),d=b.getChannelData(0);
  const N=Math.max(2,Math.round(sr/f)),buf=new Float32Array(N); for(let i=0;i<N;i++) buf[i]=Math.random()*2-1; let lp=0;
  for(let i=0;i<N;i++){ lp=lp*(1-bright)+buf[i]*bright; buf[i]=lp; }
  let idx=0; const damp=0.9965; for(let i=0;i<n;i++){ const nx=(idx+1)%N; const v=(buf[idx]+buf[nx])*0.5*damp; d[i]=buf[idx]; buf[idx]=v; idx=nx; }
  for(let i=0;i<Math.min(n,300);i++) d[i]*=1+(300-i)/200; return A.cache[k]=b; }
function zheng(f,t,v,o={}){ const c=A.ctx,s=c.createBufferSource(); s.buffer=ksBuf(f,o.dur||2.2,o.bright||0.55); const g=c.createGain(); g.gain.value=v;
  const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=4200; const pk=c.createBiquadFilter(); pk.type='peaking'; pk.frequency.value=f*2; pk.gain.value=4;
  s.connect(pk); pk.connect(lp); lp.connect(g); g.connect(dst(o.d)); if(o.rev!==false) g.connect(A.rev); if(o.bend){ s.playbackRate.setValueAtTime(1,t+0.18); s.playbackRate.linearRampToValueAtTime(1.0595,t+0.32); } s.start(t); }
function flute(f,t,dur,v,o={}){ const c=A.ctx,o1=c.createOscillator(),o2=c.createOscillator(),g=c.createGain(),lp=c.createBiquadFilter();
  o1.type='sine'; o2.type='triangle'; o1.frequency.value=f; o2.frequency.value=f*2; const g2=c.createGain(); g2.gain.value=0.12;
  const lfo=c.createOscillator(),lg=c.createGain(); lfo.frequency.value=5.2; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*0.008,t+Math.min(0.4,dur*0.6)); lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  lp.type='lowpass'; lp.frequency.value=3200; o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(dst(o.d)); lp.connect(A.rev);
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+0.07); g.gain.setValueAtTime(v*0.85,t+Math.max(0.08,dur-0.12)); g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.25);
  // 숨소리
  const n=c.createBufferSource(); n.buffer=noiseBuf(); const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f*2.2; bp.Q.value=2; const ng=c.createGain(); env(ng,t,0.03,v*0.25,0.25); n.connect(bp); bp.connect(ng); ng.connect(dst(o.d));
  [o1,o2,lfo].forEach(x=>{x.start(t);x.stop(t+dur+0.4);}); n.start(t,Math.random()); n.stop(t+0.4); }
function erhu(f,t,dur,v,o={}){ const c=A.ctx,osc=c.createOscillator(),g=c.createGain(),bp=c.createBiquadFilter(),pk=c.createBiquadFilter(),lp=c.createBiquadFilter();
  osc.type='sawtooth'; osc.frequency.setValueAtTime(o.from||f*0.97,t); osc.frequency.exponentialRampToValueAtTime(f,t+0.09);
  const lfo=c.createOscillator(),lg=c.createGain(); lfo.frequency.value=5.8; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*0.012,t+0.35); lfo.connect(lg); lg.connect(osc.frequency);
  bp.type='bandpass'; bp.frequency.value=1100; bp.Q.value=0.7; pk.type='peaking'; pk.frequency.value=2600; pk.gain.value=5; lp.type='lowpass'; lp.frequency.value=5000;
  osc.connect(bp); bp.connect(pk); pk.connect(lp); lp.connect(g); g.connect(dst(o.d)); g.connect(A.rev);
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+0.12); g.gain.setValueAtTime(v,t+Math.max(0.13,dur-0.1)); g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.2);
  osc.start(t); osc.stop(t+dur+0.3); lfo.start(t); lfo.stop(t+dur+0.3); }
function pad(fs,t,dur,v,o={}){ const c=A.ctx,lp=c.createBiquadFilter(),g=c.createGain(); lp.type='lowpass'; lp.frequency.setValueAtTime(500,t); lp.frequency.linearRampToValueAtTime(o.bright||1100,t+dur*0.5); lp.Q.value=0.5;
  for(const f of fs) for(const det of [-7,6]){ const s=c.createOscillator(); s.type='sawtooth'; s.frequency.value=f; s.detune.value=det; s.connect(lp); s.start(t); s.stop(t+dur+1.6); }
  lp.connect(g); g.connect(dst(o.d)); g.connect(A.rev); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+Math.min(1.0,dur*0.4)); g.gain.setValueAtTime(v,t+dur); g.gain.exponentialRampToValueAtTime(0.0001,t+dur+1.5); }
function bass(f,t,dur,v,o={}){ const c=A.ctx,s=c.createOscillator(),s2=c.createOscillator(),g=c.createGain(),lp=c.createBiquadFilter(); s.type='triangle'; s.frequency.value=f; s2.type='sine'; s2.frequency.value=f/2; lp.type='lowpass'; lp.frequency.value=600;
  s.connect(lp); s2.connect(lp); lp.connect(g); g.connect(dst(o.d)); env(g,t,0.02,v,dur+0.2,v*0.3); s.start(t); s2.start(t); s.stop(t+dur+0.4); s2.stop(t+dur+0.4); }
function brass(fs,t,dur,v,o={}){ const c=A.ctx,lp=c.createBiquadFilter(),g=c.createGain(); lp.type='lowpass'; lp.Q.value=1.2; lp.frequency.setValueAtTime(400,t); lp.frequency.exponentialRampToValueAtTime(2400,t+0.08); lp.frequency.exponentialRampToValueAtTime(1200,t+dur);
  for(const f of fs) for(const det of [-5,5]){ const s=c.createOscillator(); s.type='sawtooth'; s.frequency.value=f; s.detune.value=det; s.connect(lp); s.start(t); s.stop(t+dur+0.4); }
  lp.connect(g); g.connect(dst(o.d)); g.connect(A.rev); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+0.04); g.gain.setValueAtTime(v*0.8,t+dur); g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.3); }
function taiko(t,v,o={}){ const c=A.ctx,s=c.createOscillator(),g=c.createGain(); s.type='sine'; s.frequency.setValueAtTime(o.f||95,t); s.frequency.exponentialRampToValueAtTime(42,t+0.35); s.connect(g); g.connect(dst(o.d)); g.connect(A.rev); env(g,t,0.003,v,0.55); s.start(t); s.stop(t+0.7);
  const n=c.createBufferSource(); n.buffer=noiseBuf(); const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1200; const ng=c.createGain(); env(ng,t,0.002,v*0.35,0.12); n.connect(lp); lp.connect(ng); ng.connect(dst(o.d)); n.start(t,Math.random()); n.stop(t+0.2); }
function rim(t,v,o={}){ const c=A.ctx,n=c.createBufferSource(); n.buffer=noiseBuf(); const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=o.f||2600; bp.Q.value=6; const g=c.createGain(); env(g,t,0.001,v,0.05); n.connect(bp); bp.connect(g); g.connect(dst(o.d)); n.start(t,Math.random()); n.stop(t+0.1); }
function cymbal(t,v,o={}){ const c=A.ctx,n=c.createBufferSource(); n.buffer=noiseBuf(); const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=5500; const g=c.createGain(); env(g,t,0.005,v,1.6); n.connect(hp); hp.connect(g); g.connect(dst(o.d)); g.connect(A.rev); n.start(t,Math.random()); n.stop(t+1.8); }
function gong(t,v,o={}){ const c=A.ctx,f=o.f||98; [1,1.47,2.09,2.76,3.4,4.17].forEach((m,i)=>{ const s=c.createOscillator(),g=c.createGain(); s.type='sine'; s.frequency.setValueAtTime(f*m*1.01,t); s.frequency.exponentialRampToValueAtTime(f*m,t+1); s.connect(g); g.connect(dst(o.d)); g.connect(A.rev); env(g,t,0.02,v/(i+1.3),3.8-i*0.45); s.start(t); s.stop(t+4.2); });
  const n=c.createBufferSource(); n.buffer=noiseBuf(); const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=700; const g=c.createGain(); env(g,t,0.005,v*0.25,0.6); n.connect(bp); bp.connect(g); g.connect(dst(o.d)); n.start(t); n.stop(t+0.8); }
function bell(f,t,v,o={}){ const c=A.ctx; [1,2.76,5.4].forEach((m,i)=>{ const s=c.createOscillator(),g=c.createGain(); s.type='sine'; s.frequency.value=f*m; s.connect(g); g.connect(dst(o.d)); g.connect(A.rev); env(g,t,0.003,v/(i*1.8+1),2.2-i*0.6); s.start(t); s.stop(t+2.4); }); }
function noiseHit(t,dur,v,type,f,q,o={}){ const c=A.ctx,n=c.createBufferSource(); n.buffer=noiseBuf(); const fl=c.createBiquadFilter(); fl.type=type; fl.frequency.setValueAtTime(f,t); if(o.to) fl.frequency.exponentialRampToValueAtTime(o.to,t+dur); fl.Q.value=q||1; const g=c.createGain(); env(g,t,o.a||0.004,v,dur); n.connect(fl); fl.connect(g); g.connect(dst(o.d)); if(o.rev) g.connect(A.rev); n.start(t,Math.random()); n.stop(t+dur+0.1); }
function metal(t,v){ const c=A.ctx; noiseHit(t,0.12,v*0.6,'highpass',3000,0.8); [2630,3870,5110,6900].forEach((f,i)=>{ const s=c.createOscillator(),g=c.createGain(); s.type='square'; s.frequency.value=f*(0.98+Math.random()*0.04); const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=2000; s.connect(hp); hp.connect(g); g.connect(A.sfxG); g.connect(A.rev); env(g,t,0.001,v*0.06,0.35-i*0.05); s.start(t); s.stop(t+0.5); }); }
// ---------- 효과음 ----------
const SFX={
  tap(t){ rim(t,0.18,{f:1800}); },
  select(t){ zheng(hz('A5'),t,0.32,{dur:0.9,rev:false}); },
  open(t){ noiseHit(t,0.28,0.12,'bandpass',500,1.2,{to:2600}); },
  confirm(t){ zheng(hz('D5'),t,0.38); zheng(hz('A5'),t+0.07,0.34); },
  cancel(t){ zheng(hz('A4'),t,0.34); zheng(hz('D4'),t+0.08,0.3); },
  month(t){ bell(hz('A5'),t,0.22); bell(hz('E6'),t+0.16,0.16); },
  coin(t){ [0,0.06,0.12].forEach((d,i)=>bell(2100+i*350,t+d,0.1)); },
  build(t){ [0,0.24,0.48].forEach(d=>{ noiseHit(t+d,0.07,0.55,'bandpass',950,3); taiko(t+d,0.25,{f:180}); }); },
  water(t){ noiseHit(t,1.6,0.32,'lowpass',900,0.6,{a:0.3,to:400,rev:true}); for(let i=0;i<10;i++){ const c=A.ctx,s=c.createOscillator(),g=c.createGain(); const d=t+Math.random()*1.2; s.frequency.setValueAtTime(400+Math.random()*500,d); s.frequency.exponentialRampToValueAtTime(1300+Math.random()*700,d+0.06); s.connect(g); g.connect(A.sfxG); env(g,d,0.005,0.08,0.07); s.start(d); s.stop(d+0.1);} },
  grain(t){ noiseHit(t,0.7,0.2,'highpass',2600,0.5,{a:0.12}); zheng(hz('E5'),t+0.1,0.28); zheng(hz('G5'),t+0.22,0.24); },
  draft(t){ for(let i=0;i<4;i++) taiko(t+i*0.24,i%2?0.45:0.7); brass([hz('D3'),hz('A3')],t+0.95,0.6,0.07); },
  train(t){ [0,0.2,0.4,0.7].forEach(d=>metal(t+d,0.7)); taiko(t+0.7,0.6); },
  march(t){ for(let i=0;i<8;i++) taiko(t+i*0.22,i%4===0?0.8:0.45); brass([hz('D3'),hz('A3'),hz('D4')],t+0.1,0.9,0.08); brass([hz('F3'),hz('C4'),hz('F4')],t+1.0,0.9,0.08); },
  horn(t){ brass([hz('D3'),hz('A3')],t,1.1,0.09); brass([hz('G3'),hz('D4')],t+0.55,1.2,0.08); },
  clash(t){ metal(t,1); taiko(t,0.35,{f:160}); },
  arrows(t){ for(let i=0;i<12;i++) noiseHit(t+Math.random()*0.6,0.2,0.16,'bandpass',3200+Math.random()*2500,7,{to:800}); for(let i=0;i<6;i++) noiseHit(t+0.55+Math.random()*0.35,0.05,0.25,'bandpass',1700,2); },
  fire(t){ noiseHit(t,2.0,0.32,'lowpass',800,0.6,{a:0.3,rev:true}); for(let i=0;i<22;i++) noiseHit(t+Math.random()*1.8,0.025,0.32,'highpass',2600,1); },
  charge(t){ for(let i=0;i<12;i++){ taiko(t+i*0.12,0.4,{f:150}); taiko(t+i*0.12+0.05,0.25,{f:130}); } SFX.horn(t); },
  duel(t){ metal(t,1); metal(t+0.28,0.85); taiko(t+0.1,0.7); for(let i=0;i<8;i++) taiko(t+0.5+i*0.07,0.3+i*0.05,{f:120}); cymbal(t+1.1,0.25); },
  gong(t){ gong(t,0.5); },
  bad(t){ gong(t,0.45,{f:73}); erhu(hz('D4'),t+0.2,0.7,0.07); erhu(hz('C4'),t+0.9,0.7,0.07,{from:hz('D4')}); erhu(hz('A3'),t+1.6,1.4,0.07,{from:hz('C4')}); },
  plague(t){ pad([hz('D3'),hz('Eb3'),hz('A3')],t,2.0,0.05,{bright:600}); gong(t,0.3,{f:65}); },
  locust(t){ const c=A.ctx; for(let k=0;k<3;k++){ const s=c.createOscillator(),g=c.createGain(),bp=c.createBiquadFilter(); s.type='sawtooth'; s.frequency.value=180+k*37; const l=c.createOscillator(),lg=c.createGain(); l.frequency.value=26+k*3; lg.gain.value=40; l.connect(lg); lg.connect(s.frequency); bp.type='bandpass'; bp.frequency.value=1800; s.connect(bp); bp.connect(g); g.connect(A.sfxG); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.05,t+0.5); g.gain.exponentialRampToValueAtTime(0.0001,t+2.4); s.start(t); l.start(t); s.stop(t+2.5); l.stop(t+2.5);} },
  riot(t){ for(let i=0;i<14;i++) noiseHit(t+Math.random()*1.2,0.25,0.12,'bandpass',500+Math.random()*900,3); for(let i=0;i<5;i++) taiko(t+i*0.3,0.5,{f:110}); },
  good(t){ ['D5','E5','G5','A5','D6'].forEach((n,i)=>zheng(hz(n),t+i*0.08,0.32)); bell(hz('D6'),t+0.45,0.12); },
  fail(t){ zheng(hz('A4'),t,0.3,{bright:0.3}); zheng(hz('F4'),t+0.12,0.28,{bright:0.3}); taiko(t+0.2,0.3,{f:70}); },
  fanfare(t){ gong(t,0.35,{f:110}); brass([hz('D4'),hz('A4'),hz('D5')],t,0.35,0.1); brass([hz('D4'),hz('A4'),hz('D5')],t+0.4,0.2,0.1); brass([hz('E4'),hz('B4'),hz('E5')],t+0.65,0.2,0.1); brass([hz('F#4'),hz('A4'),hz('D5'),hz('F#5')],t+0.9,1.4,0.11);
    for(let i=0;i<6;i++) taiko(t+0.9+i*0.12,0.5); cymbal(t+0.9,0.3); ['D5','E5','F#5','A5','B5','D6'].forEach((n,i)=>zheng(hz(n),t+0.95+i*0.06,0.25)); },
  defeat(t){ gong(t,0.5,{f:65}); erhu(hz('A4'),t+0.3,0.9,0.08); erhu(hz('G4'),t+1.2,0.9,0.08,{from:hz('A4')}); erhu(hz('F4'),t+2.1,0.9,0.08,{from:hz('G4')}); erhu(hz('D4'),t+3.0,2.0,0.08,{from:hz('F4')}); pad([hz('D3'),hz('F3'),hz('A3')],t+0.3,4,0.035); },
  death(t){ gong(t,0.5,{f:70}); bell(hz('D5'),t+0.6,0.1); },
  move(t){ for(let i=0;i<4;i++) taiko(t+i*0.11,0.2,{f:170}); noiseHit(t,0.4,0.1,'lowpass',500,0.7,{a:0.06}); },
};
A.sfx=function(name){ if(!A.ctx||!A.on.sfx) return; const f=SFX[name]; const smp=A.samples[name]; if(!f&&!smp) return; const now=A.ctx.currentTime; if(A.cool[name]&&now<A.cool[name]) return; A.cool[name]=now+(name==='tap'||name==='select'?0.03:0.6); try{ if(smp) playSample(smp,A.sfxG,now+0.01); else f(now+0.02); }catch(e){} };
// ---------- 상황 큐: 화면 글자로 효과음 선택 ----------
const CUES=[[/홍수|태풍/,'water',1],[/역병/,'plague',1],[/메뚜기/,'locust',1],[/반란/,'riot',1],[/사망|세상을 떠|목을 (벤|잘)/,'death',1],
  [/일기토|일대일/,'duel'],[/함락시켰|승리입니다|격퇴하였|점령/,'fanfare'],[/함락하였|패배|빼앗겼/,'defeat'],[/동맹이 성립|혼인이 성립|성공입니다|성공하였|성공이다|등용에 성공|부하가 되었/,'good'],
  [/거절|실패|간파/,'fail'],[/훈련도가 높아/,'train'],[/징병/,'draft'],[/토지가 비옥|토지가치가/,'build'],[/치수도가/,'water'],[/충성도가 높아|베풀/,'grain'],[/징수하였|군자금과 군량을 헌상/,'coin'],
  [/불질렀|화공/,'fire'],[/돌격/,'charge'],[/퇴각/,'cancel'],[/진공하겠습니까|진격/,'march']];
let lastLines=new Set();
A.cue=function(text){ if(!A.ctx) return; const lines=text.split('\n'); const cur=new Set(lines);
  for(const L of lines){ if(!L||lastLines.has(L)) continue; for(const [re,name,bad] of CUES){ if(re.test(L)){ A.sfx(name); if(bad&&A.mode&&A.mode!=='battle') A.sting(); break; } } }
  lastLines=cur; };
A.sting=function(){};
// ---------- 작곡 테마 ----------
// 표기: "음:길이" (16분음표 단위), "." = 쉼표
const parse=s=>s.trim().split(/\s+/).map(t=>{ const [n,l]=t.split(':'); return {n,l:+l}; });
const T={
 title:{bpm:70,bars:8,chords:[['D3','F3','A3'],['Bb2','D3','F3'],['F2','A2','C3'],['C3','E3','G3'],['D3','F3','A3'],['Bb2','D3','F3'],['C3','E3','G3'],['D3','A3','D4']],
   lead:'flute', mel:'A4:6 G4:2 F4:4 D4:4 F4:6 G4:2 A4:8 C5:6 A4:2 G4:4 F4:4 G4:12 .:4 A4:4 C5:4 D5:6 C5:2 A4:6 G4:2 F4:8 G4:4 A4:4 C5:4 A4:4 D4:16',
   arp:true, drums:'title', gong:true},
 map:{bpm:84,bars:8,chords:[['G2','D3','B3'],['E2','B2','G3'],['C3','G3','E4'],['D3','A3','F#4'],['G2','D3','B3'],['E2','B2','G3'],['A2','E3','C4'],['D3','A3','F#4']],
   lead:'zheng', mel:'D5:2 E5:2 G5:4 E5:2 D5:2 B4:4 E5:4 D5:2 B4:2 A4:8 G4:2 A4:2 B4:4 D5:4 E5:4 D5:8 A4:4 B4:4 D5:2 E5:2 G5:4 A5:4 G5:4 E5:4 G5:2 E5:2 D5:8 B4:4 A4:2 G4:2 A4:4 B4:4 G4:16',
   counter:'flute', cmel:'.:16 .:16 .:16 .:16 B5:8 A5:8 G5:8 E5:8 D5:8 E5:8 D5:16', drums:'soft'},
 map2:{bpm:72,bars:8,chords:[['A2','E3','C4'],['F2','C3','A3'],['G2','D3','B3'],['E2','B2','G3'],['A2','E3','C4'],['F2','C3','A3'],['D3','A3','F3'],['E3','B3','G#3']],
   lead:'erhu', mel:'E5:6 D5:2 C5:4 A4:4 C5:6 D5:2 E5:8 G5:6 E5:2 D5:4 C5:4 D5:12 .:4 E5:4 G5:4 A5:6 G5:2 E5:6 D5:2 C5:8 B4:4 C5:4 D5:4 B4:4 A4:16',
   arp:true, drums:'soft'},
 battle:{bpm:138,bars:8,chords:[['E2','B2','E3'],['C2','G2','C3'],['D2','A2','D3'],['E2','B2','E3'],['E2','B2','E3'],['C2','G2','C3'],['D2','A2','D3'],['B1','F#2','B2']],
   lead:'erhu', mel:'E5:4 G5:4 A5:6 G5:2 E5:4 D5:4 E5:8 B4:4 D5:4 E5:4 G5:4 A5:12 .:4 B5:4 A5:4 G5:4 E5:4 G5:4 A5:4 E5:8 D5:4 E5:4 G5:4 A5:4 B5:16',
   ostinato:true, drums:'battle', brass:true},
 duel:{bpm:160,bars:4,chords:[['E2','B2'],['E2','B2'],['F2','C3'],['E2','B2']], lead:'erhu', mel:'E5:2 E5:2 G5:2 E5:2 A5:4 G5:4 E5:2 E5:2 D5:2 E5:2 B4:8 E5:2 E5:2 G5:2 A5:2 B5:4 A5:4 G5:4 F5:4 E5:8', drums:'duel', ostinato:true},
 victory:{bpm:96,bars:4,chords:[['D3','A3','F#4'],['G2','D3','B3'],['A2','E3','C#4'],['D3','A3','F#4']], lead:'flute', mel:'A5:4 F#5:4 A5:4 B5:4 D6:8 B5:8 A5:4 F#5:4 E5:4 F#5:4 D5:16', arp:true, drums:'soft', gong:true},
};
for(const k in T){ T[k].notes=parse(T[k].mel); if(T[k].cmel) T[k].cnotes=parse(T[k].cmel); }
const DR={
 title:(t,b,s)=>{ taiko(t,0.55); if(b%4===3){ for(let i=0;i<4;i++) taiko(t+s*(8+i*2),0.3+i*0.1); } },
 soft:(t,b,s)=>{ rim(t+s*4,0.06,{f:900}); rim(t+s*12,0.06,{f:900}); if(b%4===0) taiko(t,0.25,{f:80}); },
 battle:(t,b,s)=>{ const p='X..xX.x.X..xX.X.'; for(let i=0;i<16;i++){ const ch=p[i]; if(ch==='X') taiko(t+s*i,0.6); else if(ch==='x') taiko(t+s*i,0.3,{f:120}); if(i%2) rim(t+s*i,0.05,{f:3200}); } if(b%4===0) cymbal(t,0.18); },
 duel:(t,b,s)=>{ for(let i=0;i<16;i++){ taiko(t+s*i,i%4===0?0.6:0.25,{f:i%4?140:90}); } cymbal(t,0.15); },
};
function playBar(th,b,t){ const s=60/th.bpm/4; const ch=th.chords[b%th.chords.length].map(hz); const bus=A.bgmG;
  pad(ch,t,s*16,th===T.battle||th===T.duel?0.018:0.022,{d:bus}); bass(ch[0],t,s*7,0.16,{d:bus}); bass(ch[0],t+s*8,s*7,0.12,{d:bus});
  if(th.arp){ const ar=[ch[0]*2,ch[1]*2,ch[2]*2,ch[1]*2*1.5>2000?ch[1]*2:ch[1]*3]; for(let i=0;i<8;i++) zheng(ar[i%ar.length]*(i>=4?1:1),t+s*2*i,0.11,{d:bus,dur:1.4,bright:0.45}); }
  if(th.ostinato){ for(let i=0;i<8;i++) erhu(ch[0]*2,t+s*2*i,s*1.6,0.025,{d:bus}); }
  if(th.brass&&b%2===0) brass(ch.map(f=>f*2),t,s*3,0.045,{d:bus});
  if(th.gong&&b===0) gong(t,0.22,{d:bus});
  DR[th.drums]&&DR[th.drums](t,b,s);
  // 선율
  const playMel=(notes,inst,vol,oct=1)=>{ let pos=0, idx=0; const bs=b*16, be=bs+16; let prev=null;
    for(const n of notes){ const st=pos, en=pos+n.l; pos=en; if(en<=bs||st>=be){ if(n.n!=='.') prev=hz(n.n); continue; } if(n.n==='.'||st<bs){ continue; }
      const f=hz(n.n)*oct, tt=t+(st-bs)*s, dur=n.l*s;
      if(inst==='flute') flute(f,tt,dur,vol,{d:bus}); else if(inst==='erhu') erhu(f,tt,dur,vol,{d:bus,from:prev?prev*oct:f*0.97}); else zheng(f,tt,vol*3,{d:bus,dur:Math.max(1.2,dur+0.6),bend:dur>s*6&&Math.random()<0.5});
      prev=hz(n.n); } };
  playMel(th.notes,th.lead,th.lead==='erhu'?0.075:0.09);
  if(th.cnotes) playMel(th.cnotes,th.counter,0.05);
}
let seqBar=0, nextT=0, curTheme=null, loops=0;
function tick(){ const c=A.ctx; if(!c||!curTheme) return; while(nextT<c.currentTime+0.4){ playBar(curTheme,seqBar,nextT); nextT+=60/curTheme.bpm*4; seqBar++;
    if(seqBar>=curTheme.bars){ seqBar=0; loops++; if(A.mode==='map'){ curTheme=loops%2?T.map2:T.map; } } } }
A.music=function(mode){ if(!A.ctx){ A.pending=mode; return; } if(A.mode===mode) return; A.mode=mode; clearInterval(A.timer); stopBgmSample();
  if(!mode){ curTheme=null; return; }
  const bs=A.samples['bgm_'+mode]||(mode==='map'&&A.samples.bgm_map2);
  if(bs){ curTheme=null; startBgmSample(mode); return; } curTheme=T[mode]||T.map; seqBar=0; loops=0; nextT=A.ctx.currentTime+0.15; A.timer=setInterval(tick,120); tick(); };

// ---------- 사용자 사운드 파일 (sounds/ 폴더) ----------
A.samples={}; A.userVol={};
function rmsGain(buf,target){ let sum=0,n=0; for(let ch=0;ch<buf.numberOfChannels;ch++){ const d=buf.getChannelData(ch); for(let i=0;i<d.length;i+=16){ sum+=d[i]*d[i]; n++; } }
  const r=Math.sqrt(sum/Math.max(1,n)); return r>1e-5?Math.min(4,Math.max(0.05,target/r)):1; }
function playSample(sm,dest,t,loop){ const c=A.ctx,src=c.createBufferSource(),g=c.createGain(); src.buffer=sm.buf; src.loop=!!loop; g.gain.value=sm.gain; src.connect(g); g.connect(dest); src.start(t); return {src,g}; }
let bgmNow=null;
function stopBgmSample(){ if(!bgmNow) return; const c=A.ctx,{src,g}=bgmNow; bgmNow=null; try{ g.gain.setTargetAtTime(0,c.currentTime,0.25); src.stop(c.currentTime+1.2); }catch(e){} }
function startBgmSample(mode){ const c=A.ctx; let seq=mode==='map'?['bgm_map','bgm_map2'].filter(k=>A.samples[k]):['bgm_'+mode]; let k=0;
  const play=()=>{ if(A.mode!==mode) return; const sm=A.samples[seq[k%seq.length]]; k++; const p=playSample(sm,A.bgmG,c.currentTime+0.05,seq.length===1);
    p.g.gain.setValueAtTime(0.0001,c.currentTime); p.g.gain.linearRampToValueAtTime(sm.gain,c.currentTime+1.0); bgmNow=p; if(seq.length>1) p.src.onended=()=>{ if(bgmNow===p){ bgmNow=null; play(); } }; };
  play(); }
A.loadSamples=async function(base){ base=base||'sounds/'; const c=A.ctx; if(!c||A._loading) return; A._loading=true;
  try{ const r=await fetch(base+'volume.json'); if(r.ok) A.userVol=await r.json(); }catch(e){}
  const names=[...Object.keys(SFX),...Object.keys(T).map(k=>'bgm_'+k)];
  await Promise.all(names.map(async nm=>{ for(const ext of ['mp3','wav','ogg','m4a']){ try{ const r=await fetch(base+nm+'.'+ext); if(!r.ok) continue; const ab=await r.arrayBuffer(); if(ab.byteLength<64) continue;
        const buf=await c.decodeAudioData(ab); const isB=nm.startsWith('bgm_'); A.samples[nm]={buf,gain:rmsGain(buf,isB?0.09:0.16)*(+A.userVol[nm]||1)}; return; }catch(e){} } }));
  A.loaded=Object.keys(A.samples); if(A.mode){ const m=A.mode; A.mode=null; A.music(m); } };
A.themes=T; A.SFX=SFX; A.I={zheng,flute,erhu,pad,bass,brass,taiko,rim,cymbal,gong,bell,noiseHit,metal,hz};
})();
