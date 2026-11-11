// 삼국지2 리마스터 렌더러: 원본 640x400 화면 → 디더 제거 + 4배 업스케일(WebGL) + 고화질 얼굴/타일 교체
(function(){
const W=640,H=400;
const EGA=[[0,0,0],[85,85,255],[255,85,85],[255,85,255],[85,255,85],[85,255,255],[255,255,85],[255,255,255]];
const RM={patches:[],opts:{dedither:true,smooth:true,hdFaces:true,hdTiles:true,grade:true},faces:[],faceImgs:[],tileMap:new Map(),stats:{faces:0,tiles:0}};
window.Remaster=RM;
const VS=`attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0,1);}`;
// 1단계: 디더 제거 + 색 보정 (원본 해상도)
const FS1=`precision mediump float;varying vec2 uv;uniform sampler2D t;uniform vec2 px;uniform float on;uniform float grade;
vec3 rm(vec3 c){ if(grade<0.5) return c;
 if(dot(c,vec3(1.))<0.05) return vec3(6.,7.,10.)/255.;
 if(distance(c,vec3(.333,.333,1.))<.05) return vec3(91.,123.,234.)/255.;
 if(distance(c,vec3(1.,.333,.333))<.05) return vec3(229.,98.,90.)/255.;
 if(distance(c,vec3(1.,.333,1.))<.05) return vec3(215.,127.,201.)/255.;
 if(distance(c,vec3(.333,1.,.333))<.05) return vec3(103.,197.,135.)/255.;
 if(distance(c,vec3(.333,1.,1.))<.05) return vec3(99.,199.,221.)/255.;
 if(distance(c,vec3(1.,1.,.333))<.05) return vec3(240.,199.,94.)/255.;
 if(dot(c,vec3(1.))>2.95) return vec3(243.,238.,227.)/255.;
 return c; }
vec3 g0(float dx,float dy){return texture2D(t,vec2(uv.x,1.0-uv.y)+vec2(dx,dy)*px).rgb;}
vec3 g(float dx,float dy){return rm(g0(dx,dy));}
bool eq(vec3 a,vec3 b){return dot(abs(a-b),vec3(1.0))<0.02;}
void main(){vec3 c=g(0.,0.);vec3 o=c;
 if(on>0.5){vec3 L=g(-1.,0.),R=g(1.,0.),LL=g(-2.,0.),RR=g(2.,0.),U=g(0.,-2.),D=g(0.,2.),UU=g(0.,-4.),DD=g(0.,4.);
  bool dh=eq(L,R)&&!eq(c,L)&&eq(LL,c)&&eq(RR,c); bool dv=eq(U,D)&&!eq(c,U)&&eq(UU,c)&&eq(DD,c);
  bool dh2=eq(L,R)&&!eq(c,L)&&(eq(LL,c)||eq(RR,c))&&eq(U,D)&&!eq(U,c);
  if(dh||dv||dh2){vec3 UL=g(-1.,-2.),UR=g(1.,-2.),DL=g(-1.,2.),DR=g(1.,2.);o=(4.0*c+2.0*(L+R+U+D)+UL+UR+DL+DR)/16.0;}
  else { // 지도 배경의 적·황·흑 잡무늬: 5x5 영역 평균
   float nr=0.,ny=0.;vec3 acc=vec3(0.);
   for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec3 q=g(float(i),float(j)*2.);acc+=q; if(eq(q,rm(vec3(1.,.333,.333))))nr+=1.; if(eq(q,rm(vec3(1.,1.,.333))))ny+=1.;}
   if(nr>=4.&&ny>=4.&&(eq(c,rm(vec3(1.,.333,.333)))||eq(c,rm(vec3(1.,1.,.333)))||eq(c,rm(vec3(0.))))) o=acc/25.;
  }}
 gl_FragColor=vec4(o,1.0);}`;
// 2단계: Scale2x (계단 현상 제거), 두 번 적용
const FS2=`precision mediump float;varying vec2 uv;uniform sampler2D t;uniform vec2 px;uniform vec2 sz;
bool eq(vec3 a,vec3 b){return dot(abs(a-b),vec3(1.0))<0.06;}
void main(){vec2 pos=uv*sz;vec2 f=fract(pos);vec2 c0=(floor(pos)+0.5)/sz;
 vec3 E=texture2D(t,c0).rgb,B=texture2D(t,c0+vec2(0.,px.y)).rgb,D=texture2D(t,c0+vec2(-px.x,0.)).rgb,F=texture2D(t,c0+vec2(px.x,0.)).rgb,Hh=texture2D(t,c0+vec2(0.,-px.y)).rgb;
 vec3 o=E; bool ok=!eq(B,Hh)&&!eq(D,F); bool top=f.y>=0.5;
 if(ok){ if(f.x<0.5&&top){if(eq(D,B))o=D;} else if(f.x>=0.5&&top){if(eq(B,F))o=F;} else if(f.x<0.5&&!top){if(eq(D,Hh))o=D;} else {if(eq(Hh,F))o=F;} }
 gl_FragColor=vec4(o,1.0);}`;
const FS3=`precision mediump float;varying vec2 uv;uniform sampler2D t;void main(){gl_FragColor=texture2D(t,uv);}`;
let gl,prog1,prog2,prog3,texIn,fb=[],buf,ovc,ovx,glc;
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function prog(fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);return p;}
function mkTex(w,h,filter){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);if(w)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t;}
function mkFB(w,h,filter){const t=mkTex(w,h,filter);const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return {t,f,w,h};}
RM.init=function(glCanvas,overlay){ glc=glCanvas; gl=glCanvas.getContext('webgl',{antialias:false,preserveDrawingBuffer:true,premultipliedAlpha:false}); if(!gl) throw new Error('WebGL 미지원');
  prog1=prog(FS1);prog2=prog(FS2);prog3=prog(FS3); buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  texIn=mkTex(0,0,gl.NEAREST); fb[0]=mkFB(W,H,gl.NEAREST); fb[1]=mkFB(W*2,H*2,gl.NEAREST); fb[2]=mkFB(W*4,H*4,gl.LINEAR);
  ovc=overlay; ovx=overlay.getContext('2d'); };
function draw(p,srcTex,dst,uniforms){ gl.useProgram(p); gl.bindFramebuffer(gl.FRAMEBUFFER,dst?dst.f:null); gl.viewport(0,0,dst?dst.w:glc.width,dst?dst.h:glc.height);
  const loc=gl.getAttribLocation(p,'p');gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,srcTex);gl.uniform1i(gl.getUniformLocation(p,'t'),0);
  for(const k in uniforms){const v=uniforms[k];const l=gl.getUniformLocation(p,k); if(v.length===2)gl.uniform2f(l,v[0],v[1]); else gl.uniform1f(l,v);}
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4); }
// ---------- 얼굴 데이터 (KAODATA.DAT에서 직접 생성) ----------
const pack=(r,g,b)=>(255<<24|b<<16|g<<8|r)>>>0;
const EGA32=EGA.map(c=>pack(c[0],c[1],c[2]));
RM.loadFaces=function(kao){ const n=Math.floor(kao.length/960); RM.faces=[]; RM.faceKey=new Map();
  for(let i=0;i<n;i++){ const px=new Uint32Array(64*40); for(let y=0;y<40;y++)for(let bx=0;bx<8;bx++){ const o=i*960+y*24+bx*3; const p0=kao[o],p1=kao[o+1],p2=kao[o+2];
      for(let b=0;b<8;b++){ const s=7-b; const idx=((p0>>s)&1)|(((p1>>s)&1)<<1)|(((p2>>s)&1)<<2); px[y*64+bx*8+b]=EGA32[idx]; } }
    RM.faces.push(px);
    for(const mir of [0,1]){ const k=rowKey(px,0,mir,0,64); if(!RM.faceKey.has(k))RM.faceKey.set(k,[]); RM.faceKey.get(k).push([i,mir]); } } };
function rowKey(px,y,mir,x0,stride){ let h=0; for(let k=0;k<16;k++){ const v=mir?px[y*stride+x0+63-k]:px[y*stride+x0+k]; h=(Math.imul(h,31)+v)|0; } return h; }
function frameKey(f,x,y){ let h=0; const o=y*W+x; for(let k=0;k<16;k++) h=(Math.imul(h,31)+f[o+k])|0; return h; }
function matchFace(f,x,y,i,mir){ const px=RM.faces[i]; let bad=0;
  for(let r=0;r<40;r++){ for(const dy of [0,1]){ const o=(y+r*2+dy)*W+x; for(let c=0;c<64;c+=1){ if(f[o+c]!==px[r*64+(mir?63-c:c)]){ if(++bad>40) return false; } } } } return true; }
RM.detectFaces=function(f){ const out=[]; if(!RM.faceKey) return out; const taken=new Uint8Array(W*H/64|0);
  for(let y=0;y<=H-80;y++){ for(let x=0;x<=W-64;x+=8){ const k=frameKey(f,x,y); const c=RM.faceKey.get(k); if(!c) continue;
      for(const [i,mir] of c){ if(matchFace(f,x,y,i,mir)){ out.push({x,y,i,mir}); y+=0; break; } } } }
  // 중복 제거 (같은 얼굴이 세로로 1줄 차이로 중복 검출되는 경우)
  const res=[]; for(const d of out){ if(!res.some(e=>Math.abs(e.x-d.x)<8&&Math.abs(e.y-d.y)<4)) res.push(d); } return res; };
// ---------- 전투 지형 타일 ----------
RM.tileHash=function(f,x,y){ let h=0; for(let r=0;r<32;r+=1){ const o=(y+r)*W+x; for(let c=0;c<32;c+=2) h=(Math.imul(h,16777619)^f[o+c])|0; } return h; };
RM.terrFull=new Map(); RM.terrQ=new Map();
RM.qHash=function(f,x,y){ let h=0; for(let r=0;r<16;r++){ const o=(y+r)*W+x; for(let c=0;c<16;c+=2) h=(Math.imul(h,16777619)^f[o+c])|0; } return h; };
RM.loadTerrain=function(list,base){ for(const e of list){ const im=new Image(); im.src=base+e.file; const t={name:e.name,img:im,raw:Uint32Array.from(e.raw.map(v=>v>>>0))}; RM.terrFull.set(e.hash,t); if(!e.name.startsWith('fire')) RM.terrQ.set(e.q,t); } };
RM.detectTiles=function(f){ const out=[]; const useT=RM.terrFull.size>0; if(!useT&&!RM.tileMap.size) return out;
  for(let c=0;c<13;c++){ const oy=(c%2)*16; for(let y=oy;y+32<=H;y+=32){ const x=c*32, h=RM.tileHash(f,x,y);
    if(useT){ const t=RM.terrFull.get(h); if(t){ out.push({x,y,img:t.img,h,fit:1}); continue; }
      const b=RM.terrQ.get(RM.qHash(f,x,y)); if(b){ const m=new Uint8ClampedArray(32*32*4); let n=0; for(let r=0;r<32;r++){ const o=(y+r)*W+x; for(let k=0;k<32;k++){ if((f[o+k]>>>0)!==b.raw[r*32+k]){ m[(r*32+k)*4+3]=255; n++; } } }
        out.push({x,y,img:b.img,h,fit:1,mask:m,mn:n}); continue; } }
    else { const t=RM.tileMap.get(h); if(t) out.push({x,y,img:t,h}); } } }
  return out; };
RM.isBattle=function(f){ // 전투 화면: 오른쪽 위 흰 제목칸 + 왼쪽 지도 영역이 타일로 채워짐
  const white=EGA32[7]; let w=0; for(let x=430;x<630;x+=10) if(f[20*W+x]===white) w++; let lw=0; for(let x=300;x<410;x+=10) if(f[20*W+x]===white) lw++;
  return w>=15&&lw<4&&RM.detectTiles(f).length>=8; };
// ---------- 고정 그림(타이틀 등) ----------
RM.patchHash=function(f,x0,y0,w,h){ let v=0; for(let y=y0;y<y0+h;y+=3){ const o=y*W; for(let x=x0;x<x0+w;x+=3) v=(Math.imul(v,16777619)^f[o+x])|0; } return v; };
RM.detectPatches=function(f){ const out=[]; for(const p of RM.patches){ if(RM.patchHash(f,p.x,p.y,p.w,p.h)===p.hash) out.push(p); } return out; };
// ---------- 프레임 렌더 ----------
let lastSig=0, det={faces:[],tiles:[],patches:[],text:[],bars:[],map:null};
const MD=()=>window.Modern;
RM.render=function(rgba){ // rgba: Uint8Array(640*400*4)
  const f32=new Uint32Array(rgba.buffer,rgba.byteOffset,W*H);
  gl.bindTexture(gl.TEXTURE_2D,texIn); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
  const o=RM.opts;
  draw(prog1,texIn,fb[0],{px:[1/W,1/H],on:o.dedither?1:0,grade:o.grade?1:0});
  if(o.smooth){ draw(prog2,fb[0].t,fb[1],{px:[1/W,1/H],sz:[W,H]}); draw(prog2,fb[1].t,fb[2],{px:[1/(W*2),1/(H*2)],sz:[W*2,H*2]}); draw(prog3,fb[2].t,null,{}); }
  else draw(prog3,fb[0].t,null,{});
  // 교체 대상: 기존 항목은 즉시 재검증, 전체 탐색은 0.12초 간격
  det.faces=det.faces.filter(d=>o.hdFaces&&matchFace(f32,d.x,d.y,d.i,d.mir));
  det.tiles=det.tiles.filter(t=>o.hdTiles&&RM.tileHash(f32,t.x,t.y)===t.h);
  det.patches=det.patches.filter(p=>o.hdTiles&&RM.patchHash(f32,p.x,p.y,p.w,p.h)===p.hash);
  det.text=det.text.filter(g=>f32[g.p1]===g.fg&&f32[g.p0]===g.bg&&f32[g.p2]===g.bg);
  det.bars=det.bars.filter(b=>barHash(f32,b)===b.hs);
  det.map=(MD()&&MD().opts.map)?MD().mapState(f32):null;
  RM.cur=new Uint32Array(f32); const now=performance.now();
  if(now-lastFull>120){ fullDetect(); } else { clearTimeout(RM._t); RM._t=setTimeout(()=>{ if(RM.cur) { fullDetect(); drawOverlay(); } },130); }
  drawOverlay(); return det; };
let lastFull=0;
function fullDetect(){ const o=RM.opts, f32=RM.cur; lastFull=performance.now();
  det.faces=o.hdFaces?RM.detectFaces(f32):[]; det.tiles=o.hdTiles?RM.detectTiles(f32):[]; det.patches=o.hdTiles?RM.detectPatches(f32):[];
  const M=MD(); if(M){ det.text=M.opts.text?M.ocr(f32).map(g=>probe(f32,g)).filter(Boolean):[]; det.bars=M.opts.frames?M.frames(f32).map(b=>(b.hs=barHash(f32,b),b)):[]; det.map=M.opts.map?M.mapState(f32):null; }
  RM.stats.faces=det.faces.length; RM.stats.tiles=det.tiles.length; RM.stats.text=det.text.length; RM.stats.map=!!det.map; RM.stats.bars=det.bars.length; RM.text=M?M.textOf(det.text):''; if(RM.onText) RM.onText(RM.text); }
function barHash(f,b){ let v=0; if(b.hz){ const y=b.y+(b.h>>1); for(let x=b.x;x<b.x+b.w;x+=3) v=(Math.imul(v,31)+f[y*W+x])|0; } else { const x=b.x+(b.w>>1); for(let y=b.y;y<b.y+b.h;y+=3) v=(Math.imul(v,31)+f[y*W+x])|0; } return v; }
function probe(f,g){ // 검증용 화소 3개: 글자색 1, 배경색 2
  let p1=-1; for(let r=0;r<13&&p1<0;r++) for(let i=0;i<g.w;i++){ const k=(g.y+r*2)*W+g.x+i; if(f[k]===g.fg){p1=k;break;} }
  if(p1<0) return null; g.p1=p1; g.p0=g.y*W+g.x; g.p2=(g.y+24)*W+g.x+g.w-1; if(f[g.p0]!==g.bg) g.p0=p1; if(f[g.p2]!==g.bg) g.p2=g.p0; return g; }
function drawOverlay(){ const cw=ovc.width,ch=ovc.height,sx=cw/W,sy=ch/H; ovx.clearRect(0,0,cw,ch); ovx.imageSmoothingQuality='high';
  for(const p of det.patches){ const im=p.img; if(!(im.complete&&im.naturalWidth)) continue; const dw=p.w*sx,dh=p.h*sy;
    if(p.fit){ const iw=im.naturalWidth,ih=im.naturalHeight,ra=dw/dh; let cw=iw,ch=ih; if(iw/ih>ra) cw=ih*ra; else ch=iw/ra; ovx.drawImage(im,(iw-cw)/2,(ih-ch)*0.3,cw,ch,p.x*sx,p.y*sy,dw,dh); }
    else ovx.drawImage(im,p.x*sx,p.y*sy,dw,dh); }
  const M=MD(); if(M&&det.map) M.drawMap(ovx,sx,sy,det.map);
  for(const t of det.tiles){ const im=t.img; if(!(im.complete&&im.naturalWidth)) continue; const X=t.x*sx,Y=t.y*sy,w=32*sx+0.5,h=32*sy+0.5;
    let cx=0,cy=0,cw=im.naturalWidth,ch=im.naturalHeight; if(t.fit){ const ra=w/h; if(cw/ch>ra) cw=ch*ra; else ch=cw/ra; cx=(im.naturalWidth-cw)/2; cy=(im.naturalHeight-ch)/2; }
    if(!t.mask){ ovx.drawImage(im,cx,cy,cw,ch,X,Y,w,h); continue; }
    const tc=RM._tc||(RM._tc=document.createElement('canvas')), mc=RM._mc||(RM._mc=document.createElement('canvas'));
    const W2=Math.ceil(w),H2=Math.ceil(h); if(tc.width!==W2||tc.height!==H2){ tc.width=W2; tc.height=H2; } mc.width=32; mc.height=32;
    mc.getContext('2d').putImageData(new ImageData(t.mask,32,32),0,0);
    const tx=tc.getContext('2d'); tx.globalCompositeOperation='source-over'; tx.clearRect(0,0,W2,H2); tx.drawImage(im,cx,cy,cw,ch,0,0,w,h);
    tx.globalCompositeOperation='destination-out'; tx.imageSmoothingEnabled=false; tx.drawImage(mc,0,0,32,32,0,0,w,h); tx.globalCompositeOperation='source-over';
    ovx.drawImage(tc,X,Y); }
  if(M){ let bars=det.bars; if(det.map) bars=bars.filter(b=>!(b.x>=7&&b.x+b.w<=290&&b.y>=23&&b.y+b.h<=386)).concat([{x:0,y:0,w:640,h:7,hz:1},{x:0,y:393,w:640,h:7,hz:1},{x:0,y:0,w:7,h:400,hz:0},{x:633,y:0,w:7,h:400,hz:0}]);
    if(det.tiles.length>20) bars=bars.filter(b=>b.x>=414||(b.x+b.w<=2));
    if(det.patches.some(d=>d.h>=400)) bars=[];
    bars=bars.filter(b=>!det.patches.some(d=>b.x<d.x+d.w&&b.x+b.w>d.x&&b.y<d.y+d.h&&b.y+b.h>d.y));
    bars=bars.filter(b=>!det.faces.some(d=>b.x<d.x+64&&b.x+b.w>d.x&&b.y<d.y+80&&b.y+b.h>d.y));
    if(bars.length) M.drawFrames(ovx,sx,sy,bars); }
  if(M&&det.text.length) M.drawText(ovx,sx,sy,det.map?det.text.filter(g=>!(g.x<290&&g.y>=36)):det.text);
  for(const d of det.faces){ const img=RM.faceImgs[d.i]; if(!img||!img.complete||!img.naturalWidth) continue; const x=d.x*sx,y=d.y*sy,w=64*sx,h=80*sy;
    const iw=img.naturalWidth,ih=img.naturalHeight,ra=w/h; let cw=iw,ch=ih; if(iw/ih>ra) cw=ih*ra; else ch=iw/ra; const cx=(iw-cw)/2,cy=(ih-ch)*0.2;
    if(d.mir){ ovx.save(); ovx.translate(x+w,y); ovx.scale(-1,1); ovx.drawImage(img,cx,cy,cw,ch,0,0,w,h); ovx.restore(); } else ovx.drawImage(img,cx,cy,cw,ch,x,y,w,h); } }
RM.redrawOverlay=drawOverlay;
RM.resize=function(cssW,cssH,dpr){ const w=Math.round(cssW*dpr),h=Math.round(cssH*dpr); for(const c of [glc,ovc]){ c.width=w;c.height=h;c.style.width=cssW+'px';c.style.height=cssH+'px'; } };
})();
