(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const presetData = window.EXHAUST_SPECTRA || {};
  const defs = {
    main: [
      ['pipe','Flow-pipe ID','mm',35,65,1,49],
      ['shell','Housing OD','mm',100,170,1,129],
      ['mufflen','Muffler length','mm',250,750,5,520],
      ['speed','Sound speed at resonator','m/s',330,600,5,450],
      ['pack','Panda-like packing strength','%',0,150,5,100],
      ['cones','Number of cones','',0,3,1,2],
      ['conelen','Each cone length','mm',50,190,5,120],
      ['conemax','Cone maximum OD (assumed)','mm',55,125,1,100],
      ['porosity','Perforation open area (assumed)','%',0,40,1,15],
      ['hole','Perforation hole ID (assumed)','mm',2,10,0.5,4]
    ],
    a: [
      ['aod','Cavity A OD','mm',60,160,1,129],
      ['alen','Cavity A clear length','mm',50,300,2,120],
      ['aneck','Neck A OD','mm',8,32,1,18],
      ['anecklen','Neck A physical length','mm',5,200,1,64],
      ['aq','Neck A loss Q (assumed)','',1,10,0.5,3]
    ],
    b: [
      ['bod','Cavity B OD','mm',60,160,1,102],
      ['blen','Cavity B clear length','mm',50,300,2,130],
      ['bneck','Neck B OD','mm',8,32,1,18],
      ['bnecklen','Neck B physical length','mm',5,200,1,30],
      ['bq','Neck B loss Q (assumed)','',1,10,0.5,3]
    ]
  };
  const anchors = [[100,0],[350,0],[707,4.7],[1414,7.7],[2828,12.5],[5657,10.8],[11314,15.3],[20000,19.3]];
  const el = (tag, attrs={}) => { const n=document.createElement(tag); for(const [k,v] of Object.entries(attrs)) n[k]=v; return n; };
  for (const [group, items] of Object.entries(defs)) {
    const holder = $(group+'-controls');
    for (const [key,label,unit,min,max,step,value] of items) {
      const wrap=el('div',{className:'slider-field'}), head=el('div',{className:'slider-head'});
      const input=el('input',{id:key,type:'range',min,max,step,value});
      const name=el('label',{htmlFor:key,textContent:label});
      const out=el('output',{htmlFor:key,textContent:value+(unit?' '+unit:'')});
      head.append(name,out); wrap.append(head,input); holder.append(wrap);
      input.addEventListener('input',()=>{out.textContent=input.value+(unit?' '+unit:''); update();});
    }
  }
  const get = key => Number($(key).value);
  let spectrum = presetData.straight || [];
  let lastModel = [];
  let chartGeometry = null;

  function parseMap(raw) {
    const rows=[];
    for(const line of raw.split(/\r?\n/)) {
      const trimmed=line.trim(); if(!trimmed) continue;
      const parts=trimmed.split(/[\s,;]+/).filter(Boolean); if(parts.length<2) continue;
      const f=Number(parts[0]), db=Number(parts[1]);
      if(Number.isFinite(f) && Number.isFinite(db) && f>0) rows.push([f,db]);
    }
    rows.sort((a,b)=>a[0]-b[0]);
    if(rows.length<2) throw new Error('Provide at least two positive frequencies with numeric levels.');
    for(let i=1;i<rows.length;i++) if(rows[i][0]===rows[i-1][0]) throw new Error('Each frequency must appear only once.');
    return rows;
  }
  function packedBaseline(f) {
    if(f<=anchors[0][0]) return 0;
    for(let i=1;i<anchors.length;i++) if(f<=anchors[i][0]) {
      const a=anchors[i-1],b=anchors[i];
      const t=(Math.log(f)-Math.log(a[0]))/(Math.log(b[0])-Math.log(a[0]));
      return a[1]+t*(b[1]-a[1]);
    }
    return anchors.at(-1)[1];
  }
  function resonator(prefix,c,pipeArea) {
    if(!$(prefix+'-enabled').checked) return null;
    const cavityID=Math.max(1,get(prefix+'od')-2)*0.001;
    const neckID=Math.max(1,get(prefix+'neck')-2)*0.001;
    const V=Math.PI*cavityID*cavityID/4*get(prefix+'len')*0.001;
    const A=Math.PI*neckID*neckID/4;
    const Le=(get(prefix+'necklen')+0.85*neckID*1000)*0.001;
    const f0=c/(2*Math.PI)*Math.sqrt(A/(V*Le));
    const mass=Le/A, omega0=2*Math.PI*f0, R=omega0*mass/get(prefix+'q'), Z0=c/pipeArea;
    return {f0,V, loss(f) {
      const w=2*Math.PI*f, X=w*mass-c*c/(w*V);
      return Math.max(0,Math.min(24,10*Math.log10(((R+Z0/2)**2+X*X)/(R*R+X*X))));
    }};
  }
  function state() {
    const pipe=get('pipe'), shellID=get('shell')-2,c=get('speed'),n=get('cones'),lc=get('conelen');
    const dm=Math.max(pipe,get('conemax')-2),pipeArea=Math.PI*(pipe*0.001)**2/4;
    const meanCore=pipe+Math.min(1,n*lc/get('mufflen'))*(dm-pipe)/2;
    const depth=Math.max(0,(shellID-meanCore)/2),phi=get('porosity'),hole=get('hole'),strength=get('pack')/100;
    const coupling=Math.min(1.8,strength*Math.sqrt(Math.max(0,phi)/15)*Math.sqrt(depth/39)*(4/hole)**0.18);
    const coneScale=n*Math.max(0,Math.log(dm/pipe)/Math.log(100/49))*(Math.max(0,phi)/15)**0.25*strength;
    const fc=c/(2*Math.PI*lc*0.001);
    return {A:resonator('a',c,pipeArea),B:resonator('b',c,pipeArea),
      packed:f=>packedBaseline(f)*coupling,
      cone:f=>{const x=f/fc;return Math.min(5,0.9*coneScale*x*x/(1+x*x));}};
  }
  function modelAt(f,db,s) {
    const after=$('stage').value==='after';
    const pack=after?0:s.packed(f),cone=after?0:s.cone(f),a=s.A?s.A.loss(f):0,b=s.B?s.B.loss(f):0;
    return {output:db-pack-cone-a-b,pack,cone,a,b};
  }
  function inputAt(f) {
    if(!spectrum.length||f<spectrum[0][0]||f>spectrum.at(-1)[0]) return null;
    let lo=0,hi=spectrum.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(spectrum[mid][0]<f)lo=mid;else hi=mid;}
    const a=spectrum[lo],b=spectrum[hi]; if(f===a[0]) return a[1];
    const t=(Math.log(f)-Math.log(a[0]))/(Math.log(b[0])-Math.log(a[0]));
    return a[1]+t*(b[1]-a[1]);
  }
  const svgNS='http://www.w3.org/2000/svg';
  function svg(tag,attrs={}) {const n=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,String(v));return n;}
  function drawChart(rows) {
    const chart=$('spectrum-chart'); chart.replaceChildren();
    const mobile=window.innerWidth<=640, svgWidth=mobile?440:900;
    chart.setAttribute('viewBox',`0 0 ${svgWidth} 360`);
    const mode=$('view-range').value;
    const minX=mode==='low'?1:mode==='mid'?20:Math.max(1,spectrum[0][0]);
    const maxX=mode==='low'?250:mode==='mid'?2000:spectrum.at(-1)[0];
    const visible=rows.filter(r=>r[0]>=minX&&r[0]<=maxX);
    const all=visible.flatMap(r=>[r[1],r[2]]);
    if(!all.length){chart.append(svg('text',{x:450,y:180,'text-anchor':'middle',fill:'#65798b'}));chart.lastChild.textContent='No spectrum points in this view';chartGeometry=null;return;}
    const rawMin=Math.min(...all),rawMax=Math.max(...all),pad=Math.max(4,(rawMax-rawMin)*0.1);
    const yMin=Math.floor((rawMin-pad)/5)*5,yMax=Math.ceil((rawMax+pad)/5)*5;
    const L=mobile?50:68,R=mobile?424:866,T=20,B=306,W=R-L,H=B-T;
    const x=f=>L+(Math.log(f)-Math.log(minX))/(Math.log(maxX)-Math.log(minX))*W;
    const y=db=>B-(db-yMin)/(yMax-yMin)*H;
    const xTicks=mode==='low'?(mobile?[1,5,20,100,200]:[1,2,5,10,20,50,100,200]):mode==='mid'?(mobile?[20,100,500,2000]:[20,50,100,200,500,1000,2000]):(mobile?[50,200,1000,5000,20000]:[50,100,200,500,1000,2000,5000,10000,20000]);
    for(let v=yMin;v<=yMax;v+=5){const yy=y(v);chart.append(svg('line',{x1:L,y1:yy,x2:R,y2:yy,stroke:'#e5ebef'}));const t=svg('text',{x:L-10,y:yy+4,'text-anchor':'end',fill:'#78899a','font-size':12});t.textContent=String(v);chart.append(t);}
    for(const f of xTicks.filter(f=>f>=minX&&f<=maxX)){const xx=x(f);chart.append(svg('line',{x1:xx,y1:T,x2:xx,y2:B,stroke:'#eef2f5'}));const t=svg('text',{x:xx,y:B+22,'text-anchor':'middle',fill:'#78899a','font-size':12});t.textContent=f>=1000?(f/1000)+'k':String(f);chart.append(t);}
    chart.append(svg('line',{x1:L,y1:B,x2:R,y2:B,stroke:'#aab7c3'}));
    for(const [column,color] of [[1,'#8d9db0'],[2,'#e27646']]) {
      const points=visible.map(r=>x(r[0]).toFixed(2)+','+y(r[column]).toFixed(2)).join(' ');
      chart.append(svg('polyline',{points,fill:'none',stroke:color,'stroke-width':column===2?2.7:2,'stroke-linejoin':'round','stroke-linecap':'round'}));
    }
    const cursor=svg('line',{x1:L,y1:T,x2:L,y2:B,stroke:'#28415d','stroke-width':1,'stroke-dasharray':'4 4',visibility:'hidden'});chart.append(cursor);
    chartGeometry={minX,maxX,L,R,cursor,svgWidth};
  }
  function update() {
    if(!spectrum.length) return;
    const s=state();lastModel=spectrum.map(([f,db])=>[f,db,modelAt(f,db,s).output]);
    drawChart(lastModel);
    $('a-readout').textContent=s.A?`${s.A.f0.toFixed(0)} Hz · ${(s.A.V*1e3).toFixed(2)} L cavity`:'Off';
    $('b-readout').textContent=s.B?`${s.B.f0.toFixed(0)} Hz · ${(s.B.V*1e3).toFixed(2)} L cavity`:'Off';
    for(const p of ['a','b']) $(p+'-controls').parentElement.classList.toggle('is-disabled',!$(p+'-enabled').checked);
    const f=Math.max(1,Math.min(24000,Number($('probe').value)||94)), db=inputAt(f),m=db===null?null:modelAt(f,db,s);
    $('probe-readout').textContent=m?`${f.toFixed(0)} Hz: ${db.toFixed(1)} → ${m.output.toFixed(1)} dB (Δ ${(-m.pack-m.cone-m.a-m.b).toFixed(1)})`:`${f.toFixed(0)} Hz: outside input map`;
  }
  function applyMap() {
    try {spectrum=parseMap($('spectrum-input').value);$('preset').value='custom';$('input-status').textContent=`Loaded ${spectrum.length} frequency bins. All calculations stay in this browser.`;$('input-status').classList.remove('error');update();}
    catch(error){$('input-status').textContent=error.message;$('input-status').classList.add('error');}
  }
  $('apply-spectrum').addEventListener('click',applyMap);
  $('spectrum-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;$('spectrum-input').value=await file.text();applyMap();});
  $('preset').addEventListener('change',()=>{const key=$('preset').value;if(key==='custom')return; spectrum=presetData[key]||[];$('stage').value=key==='straight'?'before':'after';$('input-status').textContent=`Loaded ${spectrum.length} bins from the ${key} export.`;$('input-status').classList.remove('error');update();});
  for(const id of ['stage','view-range','probe','a-enabled','b-enabled']) $(id).addEventListener('input',update);
  $('download-csv').addEventListener('click',()=>{const lines=['frequency_hz,input_relative_db,modeled_outlet_relative_db',...lastModel.map(r=>r.map(v=>v.toFixed(6)).join(','))];const blob=new Blob([lines.join('\n')+'\n'],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=el('a',{href:url,download:'modeled-exhaust-spectrum.csv'});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('spectrum-chart').addEventListener('pointermove',event=>{if(!chartGeometry)return;const rect=event.currentTarget.getBoundingClientRect();const {minX,maxX,L,R,cursor,svgWidth}=chartGeometry;const xx=(event.clientX-rect.left)*svgWidth/rect.width;const f=Math.exp(Math.log(minX)+(Math.max(L,Math.min(R,xx))-L)/(R-L)*(Math.log(maxX)-Math.log(minX)));const db=inputAt(f);if(db===null)return;const m=modelAt(f,db,state());cursor.setAttribute('x1',Math.max(L,Math.min(R,xx)));cursor.setAttribute('x2',Math.max(L,Math.min(R,xx)));cursor.setAttribute('visibility','visible');$('chart-hover').textContent=`${f.toFixed(0)} Hz · input ${db.toFixed(1)} dB · modeled ${m.output.toFixed(1)} dB · estimated change ${(-m.pack-m.cone-m.a-m.b).toFixed(1)} dB`;});
  $('spectrum-chart').addEventListener('pointerleave',()=>{chartGeometry?.cursor.setAttribute('visibility','hidden');$('chart-hover').textContent='Move across the chart to inspect a frequency.';});
  window.addEventListener('resize',update);
  update();
})();
