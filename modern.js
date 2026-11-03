// 현대식 재렌더 계층: 글자(OCR→현대 글꼴), 벡터 지도, 장식 테두리
(function(){
const W=640,H=400;
const MD={font:null,map:null,ready:false,opts:{text:true,map:true,frames:true}};
window.Modern=MD;
// 원작 EGA 색 → 현대 팔레트 (셰이더와 동일하게 사용)
const EGA=[[0,0,0],[85,85,255],[255,85,85],[255,85,255],[85,255,85],[85,255,255],[255,255,85],[255,255,255]];
const PAL=[[6,7,10],[91,123,234],[229,98,90],[215,127,201],[103,197,135],[99,199,221],[240,199,94],[243,238,227]];
MD.EGA=EGA; MD.PAL=PAL;
const pack=(r,g,b)=>(255<<24|b<<16|g<<8|r)>>>0;
const E32=EGA.map(c=>pack(...c)); const IDX=new Map(E32.map((v,i)=>[v,i]));
const css=i=>`rgb(${PAL[i][0]},${PAL[i][1]},${PAL[i][2]})`;
const colOf=v=>{ const i=IDX.get(v>>>0); if(i!==undefined) return PAL[i]; return [v&255,(v>>8)&255,(v>>16)&255]; };
const cssOf=v=>{ const c=colOf(v); return `rgb(${c[0]},${c[1]},${c[2]})`; };
// 글자색은 배경 대비를 살짝 키움
const TEXT=[[10,12,16],[130,160,255],[255,120,108],[240,150,225],[130,225,160],[130,225,245],[255,214,110],[250,247,240]];
const textCss=v=>{ const i=IDX.get(v>>>0); const c=i!==undefined?TEXT[i]:colOf(v); return `rgb(${c[0]},${c[1]},${c[2]})`; };
// ---------- 글꼴 사전 ----------
const fh=rows=>{ let h=0x811c9dc5; for(const r of rows) h=Math.imul(h^r,0x01000193)>>>0; return h; };
MD.loadFont=function(j){ const K=new Map(),A=new Map(); for(const [c,r] of j.k) K.set(fh(r),c); for(const [c,r] of j.a) A.set(fh(r),c); MD.font={K,A}; };
const PUNCT=new Set(['.',',','`','_','-',':',';',"'",'"','|','~','^']);
// ---------- OCR ----------
MD.ocr=function(f){ if(!MD.font) return []; const {K,A}=MD.font; const out=[];
  const ca=new Uint32Array(80), cb=new Uint32Array(80), ok=new Uint8Array(80), rowsA=new Uint8Array(80*13);
  for(let y=0;y<=H-26;y+=2){
    for(let bx=0;bx<80;bx++){ const x=bx*8; let a=0,b=0,na=0,good=1;
      for(let r=0;r<13&&good;r++){ const o=(y+r*2)*W+x, o2=o+W; let bits=0;
        for(let i=0;i<8;i++){ const v=f[o+i]; if(v!==f[o2+i]){good=0;break;} if(na===0){a=v;na=1;} if(v===a){bits|=128>>i;} else if(na===1){b=v;na=2;} else if(v!==b){good=0;break;} }
        rowsA[bx*13+r]=bits; }
      ok[bx]=good&&na===2?2:(good&&na===1?1:0); ca[bx]=a; cb[bx]=b; }
    for(let bx=0;bx<80;bx++){ if(ok[bx]!==2) continue;
      // 16폭 한글 시도
      if(bx<79&&ok[bx+1]){ const a=ca[bx],b=cb[bx]; const a2=ca[bx+1], b2=ok[bx+1]===2?cb[bx+1]:a2;
        const same=(a2===a||a2===b)&&(b2===a||b2===b);
        if(same){ for(const fg of [a,b]){ const rows=[]; for(let r=0;r<13;r++){ const l=fg===a?rowsA[bx*13+r]:(~rowsA[bx*13+r])&255; const rb=rowsA[(bx+1)*13+r]; const r2=fg===a2?rb:(~rb)&255; rows.push(l<<8|r2); }
            const c=K.get(fh(rows)); if(c){ out.push({x:bx*8,y,w:16,c,fg,bg:fg===a?b:a}); bx++; break; } }
          if(out.length&&out[out.length-1].x===bx*8-8&&out[out.length-1].y===y&&out[out.length-1].w===16) continue; } }
      const a=ca[bx],b=cb[bx];
      for(const fg of [a,b]){ const rows=[]; for(let r=0;r<13;r++){ const v=rowsA[bx*13+r]; rows.push(fg===a?v:(~v)&255); } const c=A.get(fh(rows)); if(c){ out.push({x:bx*8,y,w:8,c,fg,bg:fg===a?b:a}); break; } }
    } }
  // 고립된 문장부호 제거, 같은 칸 중복 제거
  const keep=out.filter(g=>{ if(!PUNCT.has(g.c)) return true; return out.some(o=>o!==g&&o.y===g.y&&!PUNCT.has(o.c)&&Math.abs(o.x-g.x)<=24); });
  return keep; };
// ---------- 지도 ----------
MD.loadMap=function(j){ MD.map=j; for(const p of j.provs){ p.paths=p.poly.map(a=>a); } };
MD.mapState=function(f){ const m=MD.map; if(!m) return null; let ok=0; for(const [x,y] of m.border){ const v=f[y*W+x]; if(v===E32[0]) ok++; } if(ok<m.border.length*0.92) return null;
  const st=[]; for(const p of m.provs){ let r=0,g=0,b=0,n=0; const cols=new Map();
    for(const [x,y] of p.samp){ const v=f[y*W+x]; if(v===E32[0]) continue; r+=v&255;g+=(v>>>8)&255;b+=(v>>>16)&255;n++; cols.set(v,(cols.get(v)||0)+1); }
    if(!n){ st.push({c:[180,170,150],hi:false}); continue; }
    // 번호 칸 강조 감지: 번호 주변에 바탕색/검정이 아닌 색이 많으면 강조
    let ny=0; if(!cols.has(E32[6])) for(let yy=p.cy-9;yy<=p.cy+9;yy+=2) for(let xx=p.cx-9;xx<=p.cx+9;xx++){ if(f[yy*W+xx]===E32[6]) ny++; }
    st.push({c:[r/n,g/n,b/n],hi:ny>=18}); }
  return st; };
const MAPRECT={x:7,y:23,w:282,h:362};
let paper=null;
function makePaper(w,h){ // 원작 주황 배경(적·황 점무늬)의 평균색 + 아주 옅은 결
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d');
  x.fillStyle='rgb(222,148,74)'; x.fillRect(0,0,w,h);
  x.globalAlpha=0.05; for(let i=0;i<w*h/60;i++){ x.fillStyle=Math.random()<0.5?'#fff':'#5a2a00'; x.fillRect(Math.random()*w,Math.random()*h,1.5,1.5); }
  return c; }
MD.drawMap=function(ctx,sx,sy,st){ const m=MD.map; const R=MAPRECT;
  if(!paper||paper.width!==Math.round(R.w*sx)) paper=makePaper(Math.round(R.w*sx),Math.round(R.h*sy));
  ctx.save(); ctx.beginPath(); ctx.rect(R.x*sx,R.y*sy,R.w*sx,R.h*sy); ctx.clip(); ctx.drawImage(paper,R.x*sx,R.y*sy);
  const path=p=>{ const P=new Path2D(); for(const a of p.poly){ P.moveTo(a[0]*sx,a[1]*sy); for(let i=2;i<a.length;i+=2) P.lineTo(a[i]*sx,a[i+1]*sy); P.closePath(); } return P; };
  if(!m._p||m._sx!==sx){ m._p=m.provs.map(path); m._sx=sx; }
  m.provs.forEach((p,i)=>{ let [r,g,b]=st[i].c; const l=(r+g+b)/3; r=l+(r-l)*0.92; g=l+(g-l)*0.92; b=l+(b-l)*0.92; if(l>235){ r=245;g=242;b=233; } ctx.fillStyle=`rgb(${r|0},${g|0},${b|0})`; ctx.fill(m._p[i]); });
  ctx.lineJoin='round'; ctx.lineCap='round'; ctx.strokeStyle='#08090c'; ctx.lineWidth=2.1*sx; for(const P of m._p) ctx.stroke(P);
  // 번호: 원작처럼 흰 숫자 + 검은 테두리, 현재 나라는 하늘색 칸에 노란 숫자
  ctx.textAlign='center'; ctx.textBaseline='middle'; const fs=13*sx;
  ctx.font=`900 ${fs}px 'Noto Sans KR',sans-serif`;
  m.provs.forEach((p,i)=>{ const x=p.cx*sx, y=(p.cy+1)*sy, t=String(p.id);
    if(st[i].hi){ const w=(p.id>9?18:11)*sx, h=17*sy; ctx.fillStyle='#7fd8ee'; ctx.fillRect(x-w/2,y-h/2,w,h); ctx.fillStyle='#f6e7a8'; ctx.fillRect(x-w/2,y-h/2,w*0.28,h); }
    ctx.save(); ctx.translate(x,y); ctx.scale(1,1.25); ctx.lineJoin='round'; ctx.lineWidth=3.2*sx; ctx.strokeStyle='#08090c'; ctx.strokeText(t,0,0);
    ctx.fillStyle=st[i].hi?'#f3c94a':'#fbfaf6'; ctx.fillText(t,0,0); ctx.restore(); });
  ctx.restore(); };
// ---------- 장식 테두리 ----------
MD.frames=function(f){ const bars=[];
  const scanDir=(horiz)=>{ const N=horiz?H:W, L=horiz?W:H; const runs=[];
    for(let a=0;a<N;a++){ for(const P of [4,8,16,32]){ let run=0;
        for(let b=0;b<=L;b++){ let eq=false; if(b<L-P){ const i1=horiz?a*W+b:b*W+a, i2=horiz?a*W+b+P:(b+P)*W+a; eq=f[i1]===f[i2]; }
          if(eq) run++; else { if(run>=48){ const s=b-run; let colors=new Set(); for(let k=s;k<s+16&&k<L;k++) colors.add(horiz?f[a*W+k]:f[k*W+a]); if(colors.size>=2) runs.push([a,s,b+P]); } run=0; } } } }
    // 인접한 줄 묶기
    runs.sort((p,q)=>p[0]-q[0]||p[1]-q[1]); const bands=[];
    for(const [a,s,e] of runs){ let bd=bands.find(B=>B.a1>=a-1&&!(e<B.s||s>B.e)); if(bd){ bd.a1=a; bd.s=Math.min(bd.s,s); bd.e=Math.max(bd.e,e); } else bands.push({a0:a,a1:a,s,e}); }
    for(const B of bands){ const th=B.a1-B.a0+1; if(th<=18&&B.e-B.s>=48) bars.push(horiz?{x:B.s,y:B.a0,w:Math.min(W,B.e)-B.s,h:th,hz:1}:{x:B.a0,y:B.s,w:th,h:Math.min(H,B.e)-B.s,hz:0}); } };
  scanDir(true); scanDir(false); return bars; };
MD.drawFrames=function(ctx,sx,sy,bars){ for(const b of bars){ const x=b.x*sx,y=b.y*sy,w=b.w*sx,h=b.h*sy;
    const g=b.hz?ctx.createLinearGradient(0,y,0,y+h):ctx.createLinearGradient(x,0,x+w,0); g.addColorStop(0,'#2a1d12'); g.addColorStop(0.5,'#4a3218'); g.addColorStop(1,'#20160d');
    ctx.fillStyle=g; ctx.fillRect(x,y,w,h); ctx.strokeStyle='#d8a94b'; ctx.lineWidth=Math.max(1,0.8*sx);
    if(b.hz){ ctx.beginPath(); ctx.moveTo(x,y+h*0.22); ctx.lineTo(x+w,y+h*0.22); ctx.moveTo(x,y+h*0.78); ctx.lineTo(x+w,y+h*0.78); ctx.stroke();
      ctx.fillStyle='#f3d08a'; for(let k=x+8*sx;k<x+w-4*sx;k+=16*sx){ ctx.beginPath(); ctx.arc(k,y+h/2,Math.min(h*0.13,1.6*sx),0,7); ctx.fill(); } }
    else { ctx.beginPath(); ctx.moveTo(x+w*0.22,y); ctx.lineTo(x+w*0.22,y+h); ctx.moveTo(x+w*0.78,y); ctx.lineTo(x+w*0.78,y+h); ctx.stroke();
      ctx.fillStyle='#f3d08a'; for(let k=y+8*sy;k<y+h-4*sy;k+=16*sy){ ctx.beginPath(); ctx.arc(x+w/2,k,Math.min(w*0.13,1.6*sx),0,7); ctx.fill(); } } } };
// ---------- 글자 그리기 ----------
MD.drawText=function(ctx,sx,sy,glyphs){ ctx.textAlign='center'; ctx.textBaseline='middle';
  const fs=15.2*sx, vs=1.42;
  for(const g of glyphs){ ctx.fillStyle=cssOf(g.bg); ctx.fillRect(g.x*sx-0.5,g.y*sy-0.5,g.w*sx+1,26*sy+1); }
  ctx.font=`500 ${fs}px 'Noto Sans KR',sans-serif`;
  for(const g of glyphs){ ctx.save(); ctx.translate((g.x+g.w/2)*sx,(g.y+12.5)*sy); ctx.scale(1,vs); ctx.fillStyle=textCss(g.fg);
    if(g.w===8){ ctx.font=`600 ${fs*1.02}px 'Noto Sans KR',sans-serif`; } else ctx.font=`500 ${fs}px 'Noto Sans KR',sans-serif`;
    ctx.fillText(g.c,0,0); ctx.restore(); } };
MD.textOf=glyphs=>{ const rows=new Map(); for(const g of glyphs){ if(!rows.has(g.y)) rows.set(g.y,[]); rows.get(g.y).push(g); }
  return [...rows.entries()].sort((a,b)=>a[0]-b[0]).map(([y,gs])=>gs.sort((a,b)=>a.x-b.x).map(g=>g.c).join('')).join('\n'); };
})();
