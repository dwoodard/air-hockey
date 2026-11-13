const $ = id => document.getElementById(id)
const canvas = document.querySelector('canvas')
const ctx = canvas.getContext('2d')
const W = 480, H = 760, R = 32, P = 15, goal = 92
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const paddle = y => ({ x: W/2, y, vx: 0, vy: 0 })
const a = paddle(H-105), b = paddle(105)
const aim = { x:a.x, y:a.y }, remote = { x:b.x, y:b.y }
const puck = {x:W/2,y:H/2,vx:0,vy:0}
const BOOST_SCALE = 1.6, BOOST_TIME = 8
const boost = { x: W/2, y: H/2, active: false, next: 8, remaining: [0,0], lastHit: 0 }
const radius = p => R * (boost.remaining[p===a?0:1]>0 ? BOOST_SCALE : 1)
function resetBoost() {
  boost.active=false; boost.next=8; boost.remaining=[0,0]; boost.lastHit=0
}
function updateBoost(dt) {
  for(let i=0;i<2;i++)boost.remaining[i]=Math.max(0,boost.remaining[i]-dt)
  if(boost.active) {
    if(Math.hypot(puck.x-boost.x,puck.y-boost.y)<P+18) {
      boost.remaining[boost.lastHit]=BOOST_TIME
      boost.active=false
      boost.next=15+Math.random()*5
    }
  } else if(boost.remaining.every(n=>n===0)) {
    boost.next-=dt
    if(boost.next<=0) {
      boost.x=80+Math.random()*(W-160)
      boost.y=H*.32+Math.random()*(H*.36)
      boost.active=true
    }
  }
}
let mode = '', phase = 'menu', peer, conn, generation = 0, inviteCode = ''
let scores = [0,0], pause = 0, last = 0, tick = 0, snapshot = null
const prefix = 'dwoodard-air-hockey-v1-'
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const gameOver = () => scores.some(n => n >= 7)
function serve(dir) {
  Object.assign(puck,{x:W/2,y:H/2,vx:90*(Math.random()-.5),vy:dir*240})
  pause=.75
}
function resetMatch(role) {
  mode=role; phase='play'; scores=[0,0]; snapshot=null; tick=0; resetBoost()
  Object.assign(a,paddle(H-105)); Object.assign(b,paddle(105))
  Object.assign(aim,{x:a.x,y:a.y}); Object.assign(remote,{x:b.x,y:b.y})
  serve(1); updateScore()
  $('panel').hidden=true; $('menu').hidden=false
  $('hint').textContent=role==='solo'?'You vs CPU • First to 7':'Online match • First to 7'
}
function updateScore() {
  const [me,them] = mode==='guest'?[scores[1],scores[0]]:scores
  $('score').innerHTML=me+' <span>:</span> '+them
}
function showMenu(message='Play the CPU or invite a friend.') {
  generation++; conn?.close(); peer?.destroy(); conn=null; peer=null
  mode=''; phase='menu'; scores=[0,0]; snapshot=null; resetBoost(); updateScore()
  $('panel').hidden=false; $('menu').hidden=true; $('choices').hidden=false
  $('join').hidden=false; $('invite').hidden=true; $('back').hidden=true
  $('headline').textContent='Hit the ice.'; $('notice').textContent=message
  $('hint').textContent='Drag your paddle • Mouse and touch supported'
}
function end() {
  phase='end'; $('panel').hidden=false; $('menu').hidden=true
  $('choices').hidden=true; $('join').hidden=true; $('invite').hidden=true; $('back').hidden=false
  const won=mode==='guest'?scores[1]>=7:scores[0]>=7
  $('headline').textContent=won?'You win!':'Good game.'
  $('notice').textContent=won?'First to seven.':'Your opponent reached seven.'
}
function move(p,t,dt,speed) {
  const r=radius(p), upper=p===b
  const tx=clamp(t.x,r,W-r), ty=clamp(t.y,upper?r:H/2+r,upper?H/2-r:H-r)
  const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy),f=d?Math.min(1,speed*dt/d):0
  p.x+=dx*f;p.y+=dy*f;p.vx=dx*f/dt;p.vy=dy*f/dt
}
function hit(p) {
  const dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy)
  const r=radius(p)
  if(d>=r+P)return
  const nx=d?dx/d:0,ny=d?dy/d:(p===a?-1:1)
  puck.x=p.x+nx*(r+P+.2); puck.y=p.y+ny*(r+P+.2)
  boost.lastHit=p===a?0:1
  const incoming=puck.vx*nx+puck.vy*ny, push=p.vx*nx+p.vy*ny
  const impulse=Math.max(0,Math.max(165,-incoming*.91+push*.8)-incoming)
  puck.vx+=nx*impulse; puck.vy+=ny*impulse
}
function step(dt) {
  move(a,aim,dt,1450)
  // Approach from behind the puck to drive it downfield, not into the top wall.
  // A puck in the top corner is unreachable from behind: retreat until it clears.
  const cornered = puck.y < R+P+24 && (puck.x < R+P+24 || puck.x > W-R-P-24)
  const attacking = puck.y < H*.44 && puck.y > R+P+20 && !cornered
  const cpu = {
    x: attacking ? clamp(puck.x+puck.vx*.04,R,W-R) : clamp(puck.y<H*.60?puck.x:W/2,R+P+8,W-R-P-8),
    y: attacking ? clamp(puck.y-radius(b)-P-10,R+4,H/2-R) : 105
  }
  move(b,mode==='solo'?cpu:remote,dt,mode==='solo'?480:1450)
  if(pause>0){pause-=dt;return}
  puck.x+=puck.vx*dt; puck.y+=puck.vy*dt
  hit(a); hit(b)
  updateBoost(dt)
  const speed=Math.hypot(puck.vx,puck.vy)
  const f=speed>1150?1150/speed:Math.pow(.992,dt*60)
  puck.vx*=f;puck.vy*=f
  if(puck.x<P||puck.x>W-P){puck.x=clamp(puck.x,P,W-P);puck.vx=(puck.x===P?1:-1)*Math.abs(puck.vx)}
  if(puck.y<P||puck.y>H-P){
    if(Math.abs(puck.x-W/2)<goal-P){
      const top=puck.y<P
      if(puck.y<-P||puck.y>H+P){
        scores[top?0:1]++;updateScore()
        if(gameOver()){sendState();end()}else serve(top?1:-1)
      }
    }else{puck.y=clamp(puck.y,P,H-P);puck.vy=(puck.y===P?1:-1)*Math.abs(puck.vy)}
  }
  // The CPU cannot get behind a puck trapped against the top corners.
  // Break a low-speed corner jam toward the center instead of pinning it forever.
  if(mode==='solo' && puck.y < R+P+25 && (puck.x < R+P+25 || puck.x > W-R-P-25) && Math.hypot(puck.vx,puck.vy)<110){
    puck.vx=puck.x<W/2?140:-140
    puck.vy=190
  }
  if(speed<14&&puck.y>P&&puck.y<H-P){puck.vx=55;puck.vy=puck.y>H/2?-165:165}
}
function disc(x,y,r,fill,stroke) {
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()
  ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke()
}
function draw() {
  const g=ctx.createLinearGradient(0,0,0,H)
  g.addColorStop(0,'#142c3d');g.addColorStop(1,'#0b2431');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
  ctx.strokeStyle='#41677a';ctx.lineWidth=2;ctx.strokeRect(7,7,W-14,H-14)
  ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke()
  ctx.beginPath();ctx.arc(W/2,H/2,73,0,Math.PI*2);ctx.stroke()
  ctx.fillStyle='#ff7186';ctx.fillRect(W/2-goal,0,goal*2,7)
  ctx.fillStyle='#54f4da';ctx.fillRect(W/2-goal,H-7,goal*2,7)
  const guest=mode==='guest'
  const paint=(p,color,inside,r)=>disc(guest?W-p.x:p.x,guest?H-p.y:p.y,r,inside,color)
  if(boost.active) {
    const x=guest?W-boost.x:boost.x,y=guest?H-boost.y:boost.y
    ctx.save();ctx.shadowColor='#ffe274';ctx.shadowBlur=24
    disc(x,y,18,'#77521e','#ffdc62')
    ctx.fillStyle='#fff3a6';ctx.font='bold 20px system-ui';ctx.textAlign='center';ctx.textBaseline='middle'
    ctx.fillText('↑',x,y);ctx.restore()
  }
  for(const [p,color,inside] of [[a,guest?'#ff7186':'#54f4da',guest?'#763948':'#1b665f'],[b,guest?'#54f4da':'#ff7186',guest?'#1b665f':'#763948']]) {
    if(radius(p)>R) {
      ctx.save();ctx.shadowColor=color;ctx.shadowBlur=22
      paint(p,color,inside,radius(p))
      ctx.restore()
    } else paint(p,color,inside,R)
  }
  paint(puck,'#d4f3ff','#7b9eae',P)
}
function send(data) {
  if(!conn?.open)return
  try{conn.send(data)}catch{showMenu('Connection lost. Start a new match.')}
}
function sendState(){
  if(mode==='host')send({type:'state',a:[a.x,a.y],b:[b.x,b.y],p:[puck.x,puck.y],s:scores.slice(),power:{active:boost.active,x:boost.x,y:boost.y,remaining:boost.remaining.slice()}})
}
function frame(t) {
  const dt=Math.min(.04,(t-last)/1000||.016);last=t
  if(phase==='play'){
    if(mode==='guest'){
      if(snapshot){
        const f=Math.min(1,dt*23)
        for(const [body,pos] of [[a,snapshot.a],[b,snapshot.b],[puck,snapshot.p]]){
          body.x+=(pos[0]-body.x)*f;body.y+=(pos[1]-body.y)*f
        }
      }
    }else{
      const slices=Math.ceil(dt/.007)
      for(let i=0;i<slices&&phase==='play';i++)step(dt/slices)
    }
    tick+=dt
    if(tick>=1/40){
      tick%=1/40
      if(mode==='host')sendState()
      if(mode==='guest')send({type:'input',x:W-aim.x,y:H-aim.y})
    }
  }
  draw();requestAnimationFrame(frame)
}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);point(e)})
canvas.addEventListener('pointermove',point)
function point(e) {
  if(phase!=='play')return
  const r=canvas.getBoundingClientRect()
  aim.x=clamp((e.clientX-r.left)*W/r.width,R,W-R)
  aim.y=clamp((e.clientY-r.top)*H/r.height,H/2+R,H-R)
}
function startOnline(role,code) {
  if(!window.Peer){showMenu('Online service did not load. You can still play solo.');return}
  showMenu(role==='host'?'Creating a room…':'Joining the room…')
  const id=generation
  $('choices').hidden=true;$('join').hidden=true;$('back').hidden=false
  $('headline').textContent=role==='host'?'Host a match':'Joining…'
  try{peer=role==='host'?new Peer(prefix+code):new Peer()}catch{showMenu('Could not start online play.');return}
  const current=()=>id===generation
  const fail=msg=>{if(current())showMenu(msg)}
  const timeout=setTimeout(()=>{
    if(current()&&phase==='menu'&&(role==='guest'||$('invite').hidden))fail('Connection timed out. Check the code or try another network.')
  },14000)
  peer.on('error',err=>fail(err.type==='peer-unavailable'?'Room not found. Check the code and try again.':'Could not connect. Try again or play solo.'))
  peer.on('open',()=>{
    if(!current())return
    if(role==='host'){
      clearTimeout(timeout);inviteCode=code
      $('room').textContent=code;$('invite').hidden=false
      $('notice').textContent='Share the code or invite link with one friend.'
    }else bind(peer.connect(prefix+code,{serialization:'json',reliable:true}))
  })
  if(role==='host')peer.on('connection',incoming=>{
    if(!current()||conn){incoming.on('open',()=>incoming.close());return}
    bind(incoming)
  })
  function bind(channel){
    conn=channel
    const limit=setTimeout(()=>{if(current()&&!channel.open)fail('Could not reach the other player. Try another network.')},14000)
    channel.on('open',()=>{clearTimeout(timeout);clearTimeout(limit);if(current())resetMatch(role)})
    channel.on('close',()=>fail('The other player disconnected.'))
    channel.on('error',()=>fail('Connection lost. Start a new match.'))
    channel.on('data',data=>{
      if(!current()||phase!=='play'||!data)return
      if(role==='host'&&data.type==='input'&&Number.isFinite(data.x)&&Number.isFinite(data.y)){
        remote.x=clamp(data.x,R,W-R);remote.y=clamp(data.y,R,H/2-R)
      }
      if(role==='guest'&&data.type==='state'){
        const validPair=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)
        if(![data.a,data.b,data.p,data.s].every(validPair))return
        snapshot=data
        if(data.power&&typeof data.power.active==='boolean'&&Number.isFinite(data.power.x)&&Number.isFinite(data.power.y)&&Array.isArray(data.power.remaining)&&data.power.remaining.length===2&&data.power.remaining.every(n=>Number.isFinite(n)&&n>=0&&n<=BOOST_TIME)) {
          boost.active=data.power.active;boost.x=data.power.x;boost.y=data.power.y;boost.remaining=data.power.remaining
        }
        if(scores[0]!==data.s[0]||scores[1]!==data.s[1]){scores=data.s;updateScore()}
        if(gameOver())end()
      }
    })
  }
}
$('solo').onclick=()=>resetMatch('solo')
$('menu').onclick=$('back').onclick=()=>showMenu()
$('host').onclick=()=>startOnline('host',Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%alphabet.length]).join(''))
$('join').onsubmit=e=>{e.preventDefault();startOnline('guest',$('code').value.trim().toUpperCase())}
function inviteLink(){
  const url=new URL('./',location.href)
  url.searchParams.set('room',inviteCode)
  return url.href
}
$('copy').onclick=async()=>{
  try{await navigator.clipboard.writeText(inviteLink());$('notice').textContent='Invite link copied.'}catch{$('notice').textContent='Share the room code shown below.'}
}
$('share').hidden=typeof navigator.share!=='function'
$('share').onclick=async()=>{
  try{await navigator.share({title:'Air Hockey',text:'Join my air hockey match!',url:inviteLink()})}
  catch(error){if(error.name!=='AbortError')$('notice').textContent='Could not open sharing. Use Copy link instead.'}
}
const incomingRoom=new URLSearchParams(location.search).get('room')
if(/^[A-Z0-9]{6}$/i.test(incomingRoom||'')){$('code').value=incomingRoom.toUpperCase();$('notice').textContent='Room code filled in. Tap Join to play.'}
requestAnimationFrame(frame)
const settingsDialog=$('settings-dialog')
const updateStatus=$('update-status')
const checkUpdate=$('check-update')
const applyUpdate=$('apply-update')
let swRegistration=null, updateReady=false, applyingUpdate=false
function refreshUpdateUI() {
  updateReady=!!swRegistration?.waiting
  applyUpdate.hidden=!updateReady
  applyUpdate.disabled=phase==='play'
  if(updateReady) updateStatus.textContent=phase==='play'
    ? 'Update ready. Finish your match, then return here to install.'
    : 'A new version is ready to install.'
}
$('settings-toggle').onclick=()=>{
  refreshUpdateUI()
  settingsDialog.showModal()
}
$('settings-close').onclick=()=>settingsDialog.close()
checkUpdate.onclick=async()=>{
  if(!('serviceWorker'in navigator)){
    updateStatus.textContent='Updates are not supported in this browser.'
    return
  }
  checkUpdate.disabled=true
  updateStatus.textContent='Checking for updates…'
  try {
    swRegistration=await navigator.serviceWorker.getRegistration('./') || await navigator.serviceWorker.register('./sw.js')
    await swRegistration.update()
    if(swRegistration.waiting)refreshUpdateUI()
    else if(swRegistration.installing){
      updateStatus.textContent='Downloading update…'
    }else updateStatus.textContent='No new update found. You are on the latest available version.'
  } catch {
    updateStatus.textContent='Could not check for updates. Check your connection and try again.'
  } finally {
    checkUpdate.disabled=false
  }
}
applyUpdate.onclick=()=>{
  if(phase==='play'||!swRegistration?.waiting)return
  updateStatus.textContent='Installing update…'
  applyingUpdate=true
  swRegistration.waiting.postMessage({type:'SKIP_WAITING'})
}
if('serviceWorker'in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applyingUpdate)location.reload()})
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    swRegistration=reg
    refreshUpdateUI()
    reg.addEventListener('updatefound',()=>{
      const worker=reg.installing
      worker?.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&navigator.serviceWorker.controller){
          refreshUpdateUI()
        }
      })
    })
  }).catch(()=>{})
}
