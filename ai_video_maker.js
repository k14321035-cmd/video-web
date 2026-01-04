// Simple in-browser video maker: scenes -> canvas -> webm
const scenes = [];
const sceneList = document.getElementById('sceneList');
const addSceneBtn = document.getElementById('addScene');
const generateBtn = document.getElementById('generate');
const downloadLink = document.getElementById('downloadLink');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');

function bytesToSize(bytes){
  const sizes = ['Bytes','KB','MB','GB','TB'];
  if(bytes==0) return '0 Byte';
  const i=Math.floor(Math.log(bytes)/Math.log(1024));
  return Math.round(bytes/Math.pow(1024,i),2)+' '+sizes[i];
}

function renderSceneList(){
  sceneList.innerHTML = '';
  scenes.forEach((s, idx) =>{
    const li = document.createElement('li');
    li.innerHTML = `<strong>Scene ${idx+1}</strong> — ${s.duration}s<br>${s.text ? s.text.substring(0,80) : ''}`;
    const thumb = document.createElement('img');
    thumb.className = 'thumb';
    thumb.alt = '';
    if(s.imageData) thumb.src = s.imageData;
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.onclick = ()=>{ scenes.splice(idx,1); renderSceneList(); };
    li.prepend(thumb);
    li.appendChild(remove);
    sceneList.appendChild(li);
  });
}

addSceneBtn.addEventListener('click', async ()=>{
  const text = document.getElementById('sceneText').value.trim();
  const imgInput = document.getElementById('sceneImage');
  const duration = Math.max(1, Number(document.getElementById('sceneDuration').value || 3));
  let imageData = null;
  if(imgInput.files && imgInput.files[0]){
    imageData = await readFileAsDataURL(imgInput.files[0]);
    imgInput.value = '';
  }
  scenes.push({text, imageData, duration});
  document.getElementById('sceneText').value='';
  renderSceneList();
});

function readFileAsDataURL(file){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = ()=>rej(r.error);
    r.readAsDataURL(file);
  });
}

function drawSceneToCanvas(scene){
  // Clear
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,canvas.width, canvas.height);
  // Draw image if present
  if(scene.imageObj){
    const img = scene.imageObj;
    // scale to cover canvas
    const scale = Math.max(canvas.width/img.width, canvas.height/img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (canvas.width - w)/2;
    const y = (canvas.height - h)/2;
    ctx.drawImage(img, x, y, w, h);
  }
  // Overlay text
  if(scene.text){
    const padding = 40;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(padding, canvas.height - 180, canvas.width - padding*2, 140);
    ctx.fillStyle = '#fff';
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    wrapText(scene.text, canvas.width/2, canvas.height - 100, canvas.width - padding*4, 42);
  }
}

function wrapText(text, x, y, maxWidth, lineHeight){
  const words = text.split(' ');
  let line = '';
  let offsetY = 0;
  for(let n=0;n<words.length;n++){
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if(testWidth > maxWidth && n>0){
      ctx.fillText(line, x, y + offsetY);
      line = words[n] + ' ';
      offsetY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y + offsetY);
}

function preloadImages(){
  const promises = scenes.map(s=>{
    if(!s.imageData) return Promise.resolve(null);
    return new Promise((res, rej)=>{
      const img = new Image();
      img.onload = ()=>{ s.imageObj = img; res(img); };
      img.onerror = rej;
      img.src = s.imageData;
    });
  });
  return Promise.all(promises);
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function generateVideo(){
  if(scenes.length===0){ alert('Add at least one scene'); return; }
  generateBtn.disabled = true;
  await preloadImages();

  const audioInput = document.getElementById('audioFile');
  let audioElement = null;
  let audioDestination = null;
  let audioDuration = 0;

  if(audioInput.files && audioInput.files[0]){
    audioElement = new Audio(URL.createObjectURL(audioInput.files[0]));
    audioElement.crossOrigin = 'anonymous';
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();
    const src = audioCtx.createMediaElementSource(audioElement);
    audioDestination = audioCtx.createMediaStreamDestination();
    src.connect(audioDestination);
    src.connect(audioCtx.destination);
    // get duration if available
    audioElement.onloadedmetadata = ()=>{ audioDuration = audioElement.duration; };
  }

  const fps = 30;
  const canvasStream = canvas.captureStream(fps);
  const tracks = [...canvasStream.getVideoTracks()];
  if(audioDestination){
    const audioTracks = audioDestination.stream.getAudioTracks();
    audioTracks.forEach(t=>tracks.push(t));
  }
  const mixedStream = new MediaStream(tracks);
  let options = {mimeType: 'video/webm'};
  let recorder;
  try{ recorder = new MediaRecorder(mixedStream, options);}catch(e){ recorder = new MediaRecorder(mixedStream); }
  const recorded = [];
  recorder.ondataavailable = e=>{ if(e.data && e.data.size) recorded.push(e.data); };

  recorder.start();

  if(audioElement){
    // start audio playback (user gesture present)
    try{ await audioElement.play(); }catch(e){ console.warn('Audio play prevented', e); }
  }

  // Render each scene for its duration
  for(const scene of scenes){
    drawSceneToCanvas(scene);
    const durationMs = scene.duration * 1000;
    const start = performance.now();
    while(performance.now() - start < durationMs){
      // keep the frame updating so capture is stable
      await new Promise(requestAnimationFrame);
    }
  }

  // stop
  await sleep(200); // small buffer
  recorder.stop();
  if(audioElement){ audioElement.pause(); }

  recorder.onstop = ()=>{
    const blob = new Blob(recorded, {type: 'video/webm'});
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = `ai_video_${Date.now()}.webm`;
    downloadLink.style.display = 'inline-block';
    downloadLink.textContent = `Download video (${bytesToSize(blob.size)})`;
    generateBtn.disabled = false;
  };
}

generateBtn.addEventListener('click', async ()=>{
  await generateVideo();
});

// init: draw first blank frame
ctx.fillStyle = '#111';
ctx.fillRect(0,0,canvas.width, canvas.height);
ctx.fillStyle = '#fff';
ctx.font = '28px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('Add scenes and click Generate', canvas.width/2, canvas.height/2);

renderSceneList();
