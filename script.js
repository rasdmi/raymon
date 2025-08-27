(() => {
  // ---------- DOM ----------
  const c = document.getElementById('game');
  const ctx = c.getContext('2d');
  const scoreEl = document.getElementById('score');
  const cpEl = document.getElementById('cp');
  const sumEl = document.getElementById('summary');
  const sumText = document.getElementById('sumText');
  const restartBtn = document.getElementById('restart');
  const hintEl = document.getElementById('hint');
  const summaryTitle = document.getElementById('summaryTitle');

  const T = window.TEXT || {};
  const CFG = window.CONFIG || {};

  hintEl.textContent = T.hint || "";
  summaryTitle.textContent = T.summaryTitle || "Конец раунда";
  restartBtn.textContent = T.again || "🔄 Играть снова";
  document.querySelector('[data-i="kills-label"]').textContent = T.killsLabel || "Побед";
  document.querySelector('[data-i="checkpoint-label"]').textContent = T.checkpointLabel || "Чекпоинт";

  // ---------- МИР ----------
  let WORLD_W = CFG.worldWidth ?? 10000;
  const WORLD_H = c.height;
  const G  = CFG.gravity ?? 0.7;
  const AIR = CFG.airFriction ?? 0.98;
  const GROUND_FRIC = CFG.groundFriction ?? 0.84;
  const MAX_VX = CFG.maxVx ?? 6.2;
  const MAX_VY = CFG.maxVy ?? 16;

  // Геометрия
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rects=(a,b)=>!(a.x+a.w<b.x || a.x>b.x+b.w || a.y+a.h<b.y || a.y>b.y+b.h);
  const rand=(a,b)=>a+Math.random()*(b-a);
  const choice=a=>a[(Math.random()*a.length)|0];

  // ---------- УРОВЕНЬ ----------
  let platforms=[], spikes=[], checkpoints=[];
  const CP_INTERVAL = CFG.checkpointInterval ?? 2000;
  function generateLevel(){
    platforms.length=0; spikes.length=0; checkpoints.length=0;
    // Земля
    platforms.push({x:0,y:520,w:WORLD_W,h:200,color:'#c7baa1',ground:true});
    // Выступы
    let x=260;
    while(x<WORLD_W-600){
      const group=(Math.random()*4|0)+2;
      for(let i=0;i<group;i++){
        const w=rand(110,220), y=rand(300,480)-i*rand(10,50);
        platforms.push({x,y,w,h:16,color:choice(['#b9ad90','#a8b8c6','#b3a789'])});
        x+=w+rand(80,180);
        if(x>WORLD_W-800)break;
      }
      x+=rand(120,260);
    }
    // Чекпоинты
    for(let cx=800;cx<WORLD_W-400;cx+=CP_INTERVAL){
      const p=platforms.find(p=>!p.ground&&p.x<=cx&&p.x+p.w>=cx);
      const xcp=p?clamp(cx,p.x+10,p.x+p.w-50):cx, ycp=p?p.y-40:460;
      checkpoints.push({x:xcp,y:ycp,w:26,h:40,activated:false});
    }
    // Шипы
    const spikeCount=Math.floor(WORLD_W/(CFG.spikeDensityDiv ?? 220));
    for(let i=0;i<spikeCount;i++){ spikes.push({x:rand(600,WORLD_W-600),y:rand(120,380),r:rand(18,26),spin:rand(0,Math.PI*2)}); }
  }

  // ---------- ИГРОКИ ----------
  function makePlayer(kind){ // kind: 'ray' | 'cat'
    return {
      kind, x:60, y:420, w:40, h:56, vx:0, vy:0, dir:1,
      onGround:false, flying:false, doubleUsed:false, crouch:false,
      // инвентарь
      items: kind==='ray' ? ['sword','fire','hand','dash'] : ['mace','water','hand','dash'],
      slot:0, attackUntil:0, dashUntil:0, invulnUntil:0,
      // чекпоинты
      lastCP:null,
      // управление
      keys:{left:false,right:false,up:false,down:false},
    };
  }
  const p1 = makePlayer('ray');   // Синий человек
  const p2 = makePlayer('cat');   // Кошар

  // ---------- ВРАГИ/СЧЁТ ----------
  const enemies=[]; const MAX_ENEMIES = CFG.maxEnemies ?? 10;
  let score=0;
  function spawnEnemy(){
    if(enemies.length>=MAX_ENEMIES) return;
    const type=Math.random()<0.45?'kolobok':'chicken';
    const scale = (type==='chicken') ? (CFG.chickenScale ?? 2) : 1;
    const w=(type==='kolobok'?56:70*scale), h=(type==='kolobok'?56:54*scale);
    const margin=200; let x=margin+Math.random()*(WORLD_W-2*margin);
    const mid=(p1.x+p2.x)/2; if(Math.abs(x-mid)<320) x+= (x>mid?320:-320);
    const y=platforms[0].y-h;
    enemies.push({type,x,y,w,h,animT:Math.random()*1000,dead:false,vx:0});
  }
  setInterval(spawnEnemy, CFG.enemySpawnMs ?? 1100);

  // ---------- СНАРЯДЫ/ЭФФЕКТЫ ----------
  const shots=[]; // {type, x,y, vx,vy, life, from:player}
  const parts=[]; // {x,y,vx,vy,life}
  function splat(x,y){ for(let i=0;i<28;i++){ const a=Math.random()*Math.PI*2, s=2+Math.random()*4; parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:600+Math.random()*500}); } }

  // ---------- ВВОД ----------
  addEventListener('keydown', e=>{
    switch(e.code){
      // P1
      case 'KeyA': p1.keys.left=true; break;
      case 'KeyD': p1.keys.right=true; break;
      case 'KeyW': p1.keys.up=true; jump(p1); break;
      case 'KeyS': p1.keys.down=true; p1.crouch=true; break;
      case 'KeyZ': p1.slot=0; break;
      case 'KeyX': p1.slot=1; break;
      case 'KeyC': p1.slot=2; break;
      case 'KeyV': p1.slot=3; break;
      case 'KeyE': useItem(p1); break;
      // P2
      case 'ArrowLeft': p2.keys.left=true; break;
      case 'ArrowRight': p2.keys.right=true; break;
      case 'ArrowUp': p2.keys.up=true; jump(p2); break;
      case 'ArrowDown': p2.keys.down=true; p2.crouch=true; break;
      case 'KeyN': p2.slot=0; break;
      case 'KeyM': p2.slot=1; break;
      case 'Comma': p2.slot=2; break;
      case 'Period': p2.slot=3; break;
      case 'Slash': useItem(p2); break;
      // Сервис
      case 'KeyR': restart(true); break;
    }
  });
  addEventListener('keyup', e=>{
    switch(e.code){
      case 'KeyA': p1.keys.left=false; break;
      case 'KeyD': p1.keys.right=false; break;
      case 'KeyW': p1.keys.up=false; break;
      case 'KeyS': p1.keys.down=false; p1.crouch=false; break;
      case 'ArrowLeft': p2.keys.left=false; break;
      case 'ArrowRight': p2.keys.right=false; break;
      case 'ArrowUp': p2.keys.up=false; break;
      case 'ArrowDown': p2.keys.down=false; p2.crouch=false; break;
    }
  });
  restartBtn.addEventListener('click', ()=>restart(true));

  // ---------- ФИЗИКА ----------
  function moveAndCollide(pl, dt){
    const ctrl = pl.keys;
    const prevBottom = pl.y + pl.h, prevTop = pl.y, prevX = pl.x;

    // Вертикаль
    pl.vy += pl.flying ? (ctrl.up? -0.2 : 0.25) : G;
    if(pl.flying && ctrl.up)   pl.vy -= 0.45;
    if(pl.flying && ctrl.down) pl.vy += 0.5;
    pl.vy = clamp(pl.vy, -MAX_VY, MAX_VY);
    pl.onGround=false;
    pl.y += pl.vy;

    for(const p of platforms){
      if(!rects(pl,p)) continue;
      if(prevBottom <= p.y && pl.y + pl.h >= p.y){
        pl.y = p.y - pl.h; pl.vy = 0; pl.onGround=true;
        if(!ctrl.up){ pl.flying=false; pl.doubleUsed=false; }
      } else if(prevTop >= p.y + p.h && pl.y <= p.y + p.h){
        pl.y = p.y + p.h; pl.vy = 0.2;
      }
    }

    // Горизонталь
    const accel = pl.onGround ? 0.9 : 0.5;
    if(pl.dashUntil>performance.now()){
      // во время рывка не тормозим
    } else {
      if(ctrl.left)  { pl.vx -= accel; pl.dir=-1; }
      if(ctrl.right) { pl.vx += accel; pl.dir= 1; }
      if(pl.crouch && pl.onGround) pl.vx*=0.8;
      pl.vx *= (pl.onGround? GROUND_FRIC : AIR);
      pl.vx = clamp(pl.vx, -MAX_VX, MAX_VX);
    }

    pl.x += pl.vx;
    for(const p of platforms){
      if(!rects(pl,p)) continue;
      if(prevX + pl.w <= p.x && pl.x + pl.w > p.x){ pl.x = p.x - pl.w; pl.vx = 0; }
      else if(prevX >= p.x + p.w && pl.x < p.x + p.w){ pl.x = p.x + p.w; pl.vx = 0; }
    }

    pl.x = clamp(pl.x, 0, WORLD_W - pl.w);
    if(pl.y > WORLD_H-1){ onDeath(pl); }
  }

  function jump(pl){
    if(pl.onGround){ pl.vy = -13; pl.onGround=false; return; }
    if(!pl.flying && !pl.doubleUsed){ pl.doubleUsed=true; pl.flying=true; pl.vy=Math.min(pl.vy,-6); }
  }

  // ---------- ПРЕДМЕТЫ / ДЕЙСТВИЯ ----------
  function useItem(pl){
    const item = pl.items[pl.slot];
    if(item==='sword' || item==='mace'){
      pl.attackUntil = performance.now() + (item==='sword' ? (CFG.swordTimeMs??180):(CFG.maceTimeMs??200));
    } else if(item==='fire' || item==='water'){
      const spd = CFG.shotSpeed ?? 9;
      const vx = (pl.dir>0? spd : -spd);
      shots.push({type:item, x:pl.x+pl.w/2+(pl.dir>0?14:-14), y:pl.y+22, vx, vy:(pl.flying?pl.vy*0.2:0), life:CFG.shotLifeMs??1800, from:pl});
    } else if(item==='hand'){
      // толчок ближний
      const hit = {x: pl.dir>0? pl.x+pl.w-2 : pl.x-42, y: pl.y+8, w:42, h:pl.h-12};
      for(const e of enemies){
        if(e.dead) continue;
        if(rects(hit,e)){ e.vx += (pl.dir>0? 6:-6); e.y -= 4; }
      }
    } else if(item==='dash'){
      pl.dashUntil = performance.now() + (CFG.dashTimeMs??160);
      pl.invulnUntil = performance.now() + (CFG.dashInvulnMs??180);
      pl.vx = (pl.dir>0? 1:-1)*(CFG.dashSpeed??13);
    }
  }

  // ---------- ЧЕКПОИНТЫ/СМЕРТЬ ----------
  function updateCheckpoints(pl){
    for(const cp of checkpoints){
      if(!cp.activated && rects(pl, cp)){ cp.activated=true; pl.lastCP=cp; cpEl.textContent=Math.floor(cp.x)+'px'; }
    }
  }
  function onDeath(pl){
    if(pl.invulnUntil>performance.now()) return;
    if(pl.lastCP){
      pl.x=pl.lastCP.x; pl.y=pl.lastCP.y-pl.h+4; pl.vx=pl.vy=0; pl.flying=false; pl.doubleUsed=false; pl.onGround=false;
    } else { restart(false); }
  }

  // ---------- КАМЕРА ----------
  let camX=0;
  function updateCamera(){
    const mid = (p1.x+p2.x+p1.w)/2;
    camX = clamp(mid - c.width/2, 0, WORLD_W - c.width);
  }

  // ---------- СТОЛКНОВЕНИЯ/ЛОГИКА ----------
  function hitSpikes(pl){
    const cx=pl.x+pl.w/2, cy=pl.y+pl.h/2;
    for(const s of spikes){
      const dx=s.x-cx, dy=s.y-cy, rad=s.r+18;
      if(dx*dx+dy*dy<rad*rad){ onDeath(pl); return; }
    }
  }

  function updatePlayers(dt, now){
    moveAndCollide(p1, dt);
    moveAndCollide(p2, dt);

    // атаки ближние
    for(const pl of [p1,p2]){
      if(pl.attackUntil>now){
        const atk = { x: pl.dir>0? pl.x+pl.w-2 : pl.x-42, y: pl.y+6, w:42, h:44 };
        for(const e of enemies){
          if(e.dead) continue;
          if(rects(atk,e)){ e.dead=true; score++; scoreEl.textContent=score; splat(e.x+e.w/2, e.y+e.h/2); }
        }
      }
    }

    // столкновение с врагами
    for(const pl of [p1,p2]){
      for(const en of enemies){
        if(en.dead) continue;
        if(rects(pl,en) && pl.invulnUntil<=now && p1.attackUntil<=now && p2.attackUntil<=now){
          const dir = (pl.x+pl.w/2 < en.x+en.w/2)? -1 : 1;
          pl.vx = 6*dir; pl.vy = -8; onDeath(pl);
        }
      }
    }

    // снаряды
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i]; s.x+=s.vx; s.y+=s.vy; s.life-=dt;
      if(s.x<0 || s.x>WORLD_W || s.y>WORLD_H || s.life<=0){ shots.splice(i,1); continue; }
      for(const e of enemies){
        if(e.dead) continue;
        if(s.x>e.x-4 && s.x<e.x+e.w+4 && s.y>e.y && s.y<e.y+e.h){
          e.dead=true; shots.splice(i,1); score++; scoreEl.textContent=score; splat(e.x+e.w/2, e.y+e.h/2); break;
        }
      }
    }

    // частицы
    for(let i=parts.length-1;i>=0;i--){
      const p=parts[i]; p.life-=dt; p.x+=p.vx; p.y+=p.vy; p.vy+=0.35; if(p.life<=0) parts.splice(i,1);
    }

    // шипы/чекпоинты
    hitSpikes(p1); hitSpikes(p2);
    updateCheckpoints(p1); updateCheckpoints(p2);

    // победа — любой достигает правого края
    if(Math.max(p1.x+p1.w, p2.x+p2.w) >= WORLD_W-40) end(true);

    updateCamera();
  }

  // ---------- РЕНДЕР ----------
  function drawSky(){
    const sky=ctx.createLinearGradient(0,0,0,c.height);
    sky.addColorStop(0,'#eaf3ff'); sky.addColorStop(1,'#d8eaf6');
    ctx.fillStyle=sky; ctx.fillRect(0,0,c.width,c.height);
  }
  function drawMounts(color,h){
    ctx.strokeStyle=color; ctx.lineWidth=18; ctx.lineCap='round';
    ctx.beginPath(); let x=50;
    while(x<WORLD_W){ const y=90+Math.sin(x*0.001)*20; ctx.moveTo(x,y+h); ctx.lineTo(x+120,y); x+=220; }
    ctx.stroke();
  }
  function drawPlatform(p){
    ctx.fillStyle='rgba(0,0,0,.12)'; ctx.fillRect(p.x+4, p.y+6, p.w, p.h);
    const g=ctx.createLinearGradient(0,p.y,0,p.y+p.h); g.addColorStop(0,p.color||'#b9ad90'); g.addColorStop(1,'#8c826a');
    ctx.fillStyle=g; ctx.fillRect(p.x,p.y,p.w,p.h);
    ctx.fillStyle='rgba(255,255,255,.18)'; ctx.fillRect(p.x,p.y,p.w,4);
  }

  function drawRay(p, now){
    // тень
    ctx.fillStyle='rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(p.x+p.w/2, platforms[0].y+6, 22, 8, 0, 0, Math.PI*2); ctx.fill();
    // крыло
    const fl = (!p.onGround)? (Math.sin(now/120)*8):0;
    const wingY=p.y+12, wingX=p.x+(p.dir>0?-18:p.w+18);
    ctx.save(); ctx.translate(wingX,wingY); ctx.rotate((p.dir>0?-1:1)*(Math.PI/8)+fl*0.01);
    const wg=ctx.createLinearGradient(0,-20,0,10); wg.addColorStop(0,'#8fb6ff'); wg.addColorStop(1,'#5a86ff');
    ctx.fillStyle=wg; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-38,-20); ctx.lineTo(-70,-6); ctx.lineTo(-38,12); ctx.closePath(); ctx.fill(); ctx.restore();
    // тело
    const body=ctx.createLinearGradient(p.x,p.y,p.x,p.y+p.h); body.addColorStop(0,'#79e2d6'); body.addColorStop(1,'#4fb7aa');
    ctx.fillStyle=body; ctx.fillRect(p.x,p.y,p.w,p.h);
    ctx.strokeStyle='#155e4f'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(p.x+6,p.y+8); ctx.lineTo(p.x+p.w-6,p.y+p.h-12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x+6,p.y+p.h-10); ctx.lineTo(p.x+p.w-6,p.y+10); ctx.stroke();
    ctx.strokeStyle='#7d57ff'; ctx.beginPath(); ctx.moveTo(p.x+6,p.y+p.h*0.55); ctx.lineTo(p.x+p.w-6,p.y+p.h*0.55); ctx.stroke();
    // голова
    const hx=p.x+(p.dir>0?p.w:-24), hy=p.y-12;
    const head=ctx.createLinearGradient(hx,hy,hx,hy+20); head.addColorStop(0,'#5b49c0'); head.addColorStop(1,'#3f2f92');
    ctx.fillStyle=head; ctx.fillRect(hx,hy,24,20);
    ctx.fillStyle='#142626'; ctx.fillRect(hx,hy+14,24,7);
    ctx.fillStyle='#0fd09a'; if(p.dir>0) ctx.fillRect(hx+14,hy+4,5,5); else ctx.fillRect(hx+5,hy+4,5,5);
    // меч при атаке
    if(p.attackUntil>performance.now() && (p.items[p.slot]==='sword')){
      const swLen=34, swOff=22; const sx=p.dir>0?p.x+p.w-4:p.x-4-swLen; const sy=p.y+30-6;
      ctx.fillStyle='#dfe5ef'; ctx.fillRect(sx+(p.dir>0?swOff:-swOff), sy, swLen, 6);
      ctx.fillStyle='#3b3b3b'; ctx.fillRect(sx-4+(p.dir>0?swOff:-swOff), sy+2, 8, 10);
    }
    // огонёк при полёте
    if(p.flying && Math.floor(performance.now()/80)%2===0){
      ctx.fillStyle='rgba(255,140,50,.65)';
      ctx.beginPath(); ctx.ellipse(hx+(p.dir>0?26:-8), hy+10, 12,6,0,0,Math.PI*2); ctx.fill();
    }
  }

  function drawCat(p, now){
    // тень
    ctx.fillStyle='rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(p.x+p.w/2, platforms[0].y+6, 20, 7, 0, 0, Math.PI*2); ctx.fill();
    // туловище
    const g=ctx.createLinearGradient(p.x,p.y,p.x,p.y+p.h); g.addColorStop(0,'#ffdfb5'); g.addColorStop(1,'#e6a25c');
    ctx.fillStyle=g; ctx.fillRect(p.x,p.y,p.w,p.h);
    // морда
    const hx=p.x+(p.dir>0?p.w:-22), hy=p.y-10;
    ctx.fillStyle='#f5c27a'; ctx.fillRect(hx,hy,22,18);
    ctx.fillStyle='#0b0b0b'; ctx.beginPath(); ctx.arc(hx+(p.dir>0?16:6),hy+8,2,0,Math.PI*2); ctx.fill();
    // уши
    ctx.fillStyle='#e6a25c';
    ctx.beginPath(); ctx.moveTo(hx+(p.dir>0?2:14), hy-4); ctx.lineTo(hx+(p.dir>0?8:8), hy-12); ctx.lineTo(hx+(p.dir>0?14:2), hy-4); ctx.closePath(); ctx.fill();
    // булава при атаке
    if(p.attackUntil>performance.now() && p.items[p.slot]==='mace'){
      ctx.fillStyle='#7c4a1a';
      const bx=p.dir>0?p.x+p.w-6:p.x-26, by=p.y+30;
      ctx.fillRect(bx,by,6,16);
      ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(bx+(p.dir>0?8:-2),by,10,0,Math.PI*2); ctx.fill();
    }
  }

  function drawKolobok(e){
    ctx.fillStyle='rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(e.x+e.w/2,e.y+e.h+4,e.w*0.35,6,0,0,Math.PI*2); ctx.fill();
    const g=ctx.createRadialGradient(e.x+e.w*0.4,e.y+e.h*0.4,10, e.x+e.w/2,e.y+e.h/2,e.w/2);
    g.addColorStop(0,'#fbe59a'); g.addColorStop(1,'#eac76a');
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(e.x+e.w/2,e.y+e.h/2,e.w/2,e.h/2,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#2f2f2f'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(e.x+10,e.y+10); ctx.lineTo(e.x+e.w-10,e.y+e.h-10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.x+e.w-10,e.y+10); ctx.lineTo(e.x+10,e.y+e.h-10); ctx.stroke();
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(e.x+20,e.y+20,3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(e.x+e.w-20,e.y+20,3,0,Math.PI*2); ctx.fill();
    const a=Math.sin(e.animT/180)*10; ctx.fillStyle='#2a2a2a';
    ctx.fillRect(e.x-22,e.y+26+a,22,4); ctx.fillRect(e.x+e.w,e.y+26-a,22,4);
  }
  function drawChicken(e){
    ctx.fillStyle='rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(e.x+e.w/2,e.y+e.h+6,e.w*0.28,8,0,0,Math.PI*2); ctx.fill();
    const body=ctx.createRadialGradient(e.x+e.w*0.45,e.y+e.h*0.35,20, e.x+e.w*0.5,e.y+e.h*0.5,e.w*0.55);
    body.addColorStop(0,'#fff'); body.addColorStop(1,'#e9edf2');
    ctx.fillStyle=body; ctx.beginPath(); ctx.ellipse(e.x+e.w/2,e.y+e.h*0.55,e.w*0.38,e.h*0.4,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#444'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(e.x+e.w*0.35,e.y+e.h-8); ctx.lineTo(e.x+e.w*0.32,e.y+e.h+6);
    ctx.moveTo(e.x+e.w*0.65,e.y+e.h-8); ctx.lineTo(e.x+e.w*0.68,e.y+e.h+6); ctx.stroke();
    const k=Math.sin(e.animT/140)*10;
    drawHead(e.x+e.w*0.22,e.y+e.h*0.3+k,-1);
    drawHead(e.x+e.w*0.70,e.y+e.h*0.32-k,1);
    function drawHead(hx,hy,dir){
      ctx.strokeStyle='#444'; ctx.lineWidth=6;
      ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(hx+dir*34,hy-20); ctx.stroke();
      const head=ctx.createRadialGradient(hx+dir*36,hy-20,2,hx+dir*36,hy-20,16);
      head.addColorStop(0,'#fff'); head.addColorStop(1,'#e6ebf1');
      ctx.fillStyle=head; ctx.beginPath(); ctx.arc(hx+dir*38,hy-20,14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(hx+dir*42,hy-22,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffa200'; ctx.beginPath(); ctx.moveTo(hx+dir*48,hy-20); ctx.lineTo(hx+dir*66,hy-14); ctx.lineTo(hx+dir*48,hy-8); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ff4d4d'; ctx.beginPath(); ctx.arc(hx+dir*36,hy-30,4,0,Math.PI*2);
      ctx.arc(hx+dir*42,hy-30,4,0,Math.PI*2); ctx.arc(hx+dir*48,hy-30,4,0,Math.PI*2); ctx.fill();
    }
  }
  function drawSpike(s, now){
    const t=now*0.002+s.spin; ctx.strokeStyle='rgba(60,85,60,.6)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(s.x-24,s.y-20); ctx.lineTo(s.x,s.y); ctx.stroke();
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(t*0.2);
    for(let i=0;i<5;i++){ ctx.rotate((Math.PI*2)/5);
      const grad=ctx.createLinearGradient(0,-s.r,0,s.r*0.3); grad.addColorStop(0,'#3acb5d'); grad.addColorStop(1,'#1a8b3a');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.moveTo(0,-s.r); ctx.lineTo(8,-s.r*0.2); ctx.lineTo(-8,-s.r*0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(0,-s.r+2); ctx.lineTo(4,-s.r*0.25); ctx.lineTo(-4,-s.r*0.25); ctx.closePath(); ctx.fill();
    } ctx.restore();
  }
  function drawCheckpoint(cp){
    ctx.fillStyle='rgba(0,0,0,.12)'; ctx.fillRect(cp.x+6, cp.y+cp.h-6, 8, 16);
    ctx.fillStyle='#8b6a3a'; ctx.fillRect(cp.x+4, cp.y+10, 8, cp.h);
    const grad=ctx.createLinearGradient(cp.x,cp.y,cp.x,cp.y+30);
    if(cp.activated){ grad.addColorStop(0,'#ffd86b'); grad.addColorStop(1,'#ff9f1a'); }
    else{ grad.addColorStop(0,'#b7caff'); grad.addColorStop(1,'#6c90ff'); }
    ctx.fillStyle=grad; ctx.beginPath(); ctx.moveTo(cp.x+12,cp.y+12); ctx.lineTo(cp.x+12+28,cp.y+18); ctx.lineTo(cp.x+12,cp.y+28); ctx.closePath(); ctx.fill();
  }

  function drawShots(){
    for(const s of shots){
      const x=s.x-camX, y=s.y;
      ctx.fillStyle = s.type==='fire' ? '#ff7a2f' : '#38bdf8';
      ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x+2,y-2,2,0,Math.PI*2); ctx.fill();
    }
  }

  // ---------- ИНВЕНТАРЬ ----------
  function drawHotbars(){
    const pad = CFG.hotbarPad ?? 10, slot = CFG.hotbarSlot ?? 42, gap = CFG.hotbarGap ?? 8;
    // P1 слева
    let x = pad, y = c.height - pad - slot;
    for(let i=0;i<4;i++){
      const sel = (p1.slot===i);
      drawSlot(x, y, slot, sel);
      drawIcon(p1.items[i], x, y, slot);
      x += slot + gap;
    }
    // P2 справа
    x = c.width - pad - (slot*4 + gap*3); y = c.height - pad - slot;
    for(let i=0;i<4;i++){
      const sel = (p2.slot===i);
      drawSlot(x, y, slot, sel);
      drawIcon(p2.items[i], x, y, slot);
      x += slot + gap;
    }
  }
  function drawSlot(x,y,s,sel){
    ctx.fillStyle= sel? 'rgba(59,130,246,.95)':'rgba(255,255,255,.9)';
    ctx.fillRect(x,y,s,s); ctx.strokeStyle= sel? '#1e40af':'#9aa3b2';
    ctx.lineWidth=3; ctx.strokeRect(x+1.5,y+1.5,s-3,s-3);
  }
  function drawIcon(name,x,y,s){
    const cx=x+s/2, cy=y+s/2;
    ctx.save(); ctx.translate(cx,cy);
    if(name==='sword'||name==='mace'){
      ctx.rotate(-0.7); ctx.fillStyle='#cfd2d8'; ctx.fillRect(-14,-3,28,6);
      if(name==='mace'){ ctx.fillStyle='#6b7280'; ctx.beginPath(); ctx.arc(18,0,10,0,Math.PI*2); ctx.fill(); }
      else { ctx.fillStyle='#3b3b3b'; ctx.fillRect(-18,-1,8,4); }
    } else if(name==='fire'||name==='water'){
      ctx.fillStyle = name==='fire'? '#ff7a2f' : '#38bdf8';
      ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(3,-3,3,0,Math.PI*2); ctx.fill();
    } else if(name==='hand'){
      ctx.fillStyle='#fbbf24'; ctx.beginPath();
      ctx.moveTo(-10,6); ctx.lineTo(2,10); ctx.lineTo(10,0); ctx.lineTo(3,-6); ctx.closePath(); ctx.fill();
    } else if(name==='dash'){
      ctx.fillStyle='#10b981'; ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(6,-10); ctx.lineTo(6,10); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- ЦИКЛ ----------
  let camLast=performance.now(), running=true, startTime=performance.now();
  function update(dt, now){
    updatePlayers(dt, now);

    // враги/спрайты
    for(const e of enemies){ if(!e.dead) e.animT+=16; }
    for(let i=enemies.length-1;i>=0;i--) if(enemies[i].dead) enemies.splice(i,1);

    // чистим шоты
    for(let i=shots.length-1;i>=0;i--) if(shots[i].life<=0) shots.splice(i,1);

    // прогресс до конца
    // (прогресс-бар рисуем внизу)
  }

  function render(now){
    ctx.clearRect(0,0,c.width,c.height);

    // фон и параллаксы
    drawSky();
    ctx.save(); ctx.translate(-camX*0.4,0); drawMounts('#cfe0ee',110); ctx.restore();
    ctx.save(); ctx.translate(-camX*0.7,0); drawMounts('#bcd2e3',160); ctx.restore();

    ctx.save(); ctx.translate(-camX,0);

    // платформы
    for(const p of platforms) drawPlatform(p);
    // шипы
    for(const s of spikes) drawSpike(s, now);

    // враги
    for(const e of enemies){ if(!e.dead){ if(e.type==='kolobok') drawKolobok(e); else drawChicken(e); } }

    // игроки
    if(p1.kind==='ray') drawRay(p1, now); else drawCat(p1, now);
    if(p2.kind==='cat') drawCat(p2, now); else drawRay(p2, now);

    // чекпоинты
    for(const cp of checkpoints) drawCheckpoint(cp);

    // эффекты/снаряды
    drawShots();
    for(const p of parts){
      const a=Math.max(0,Math.min(1,p.life/900));
      ctx.globalAlpha=a; ctx.fillStyle='#222';
      ctx.beginPath(); ctx.arc(p.x-camX,p.y,3+Math.random()*2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    }

    ctx.restore();

    // прогресс-бар
    const far = Math.max(p1.x, p2.x);
    const prog = far/(WORLD_W-40);
    ctx.fillStyle='rgba(0,0,0,.08)'; ctx.fillRect(120, c.height-18, c.width-240, 6);
    ctx.fillStyle='#5aa1ff'; ctx.fillRect(120, c.height-18, (c.width-240)*prog, 6);

    // инвентарь-хотбары
    drawHotbars();
  }

  function loop(t){
    const dt = Math.min(33, t-camLast); camLast=t;
    if(running){ update(dt, t); render(t); requestAnimationFrame(loop); }
  }

  // ---------- КОНЕЦ / РЕСТАРТ ----------
  function end(won=false){
    running=false;
    const time=((performance.now()-startTime)/1000).toFixed(1);
    const header=won?(T.summaryWon||"Вы дошли до конца! 🎉"):(T.summaryEnded||"Раунд завершён.");
    sumText.innerHTML=`${header}<br>Побеждено: <b>${score}</b><br>Время: <b>${time}s</b>`;
    sumEl.classList.remove('hidden');
  }
  function restart(full=false){
    score=0; scoreEl.textContent=0;
    if(full){ generateLevel(); checkpoints.forEach(c=>c.activated=false); cpEl.textContent='—'; }
    for(const pl of [p1,p2]){
      pl.x=60; pl.y=420; pl.vx=pl.vy=0; pl.flying=false; pl.doubleUsed=false; pl.onGround=false; pl.lastCP=null; pl.slot=0;
    }
    enemies.length=0; parts.length=0; shots.length=0; camX=0;
    sumEl.classList.add('hidden'); running=true; startTime=performance.now(); requestAnimationFrame(loop);
  }

  // ---------- СТАРТ ----------
  generateLevel();
  setInterval(()=>{ if(running) end(false); }, CFG.softFailTimeoutMs ?? 180000);
  requestAnimationFrame(loop);
})();
