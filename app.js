// Photobooth app.js - plain JS (no frameworks)
// Behavior:
// - Start/stop camera
// - Choose layout (rows x cols) and cell size
// - Capture images (manual or auto sequence)
// - Show thumbnails, assemble final combined image and download

const video = document.getElementById('video');
const hiddenCanvas = document.getElementById('hiddenCanvas');
const finalCanvas = document.getElementById('finalCanvas');
const thumbsEl = document.getElementById('thumbs');

const startBtn = document.getElementById('startCam');
const stopBtn = document.getElementById('stopCam');
const switchBtn = document.getElementById('switchCam');
const captureBtn = document.getElementById('capture');
const autoBtn = document.getElementById('autoCapture');
const resetBtn = document.getElementById('reset');
const assembleBtn = document.getElementById('assemble');
const downloadLink = document.getElementById('downloadLink');

const layoutSelect = document.getElementById('layout');
const cellSizeSelect = document.getElementById('cellSize');
const countdownEl = document.getElementById('countdown');

let stream = null;
let captures = [];
let autoInterval = null;
let facing = 'environment'; // 'environment' (back) or 'user' (front)
let countdownTimer = null;
let autoRunning = false;

function parseLayout(val){
  const [cols, rows] = val.split('x').map(n=>parseInt(n,10));
  // some options like 4x2 may be cols x rows
  return {cols, rows};
}

async function startCamera(){
  try{
    // Prefer requested facing camera
    try{
      const constraints = { video: { facingMode: { exact: facing } } };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    }catch(e){
      try{
        const constraints = { video: { facingMode: facing } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }catch(e2){
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio:false });
      }
    }

    video.srcObject = stream;

    startBtn.disabled = true;
    stopBtn.disabled = false;
    updateSwitchButton();
  }catch(err){
    alert('Camera access denied or not available: ' + err.message);
    console.error(err);
  }
}

function stopCamera(){
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    video.srcObject = null;
    stream = null;
  }
  if(countdownTimer){ cancelCountdown(); }
  autoRunning = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  autoBtn.disabled = false;
  captureBtn.disabled = false;
}

function captureFrame(){
  const layout = parseLayout(layoutSelect.value);
  const cellSize = parseInt(cellSizeSelect.value,10);
  // Use hiddenCanvas to capture current video frame at cell size
  hiddenCanvas.width = cellSize;
  hiddenCanvas.height = cellSize;
  const ctx = hiddenCanvas.getContext('2d');
  // draw video onto square cell: center-crop
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if(vw === 0 || vh === 0){
    alert('Camera not ready');
    return;
  }
  const vRatio = vw / vh;
  const size = Math.min(vw, vh);
  // Calculate cropping to square (center)
  let sx = 0, sy = 0, s = 0;
  if(vw > vh){
    s = vh;
    sx = (vw - vh)/2;
    sy = 0;
  }else{
    s = vw;
    sx = 0;
    sy = (vh - vw)/2;
  }
  ctx.drawImage(video, sx, sy, s, s, 0, 0, cellSize, cellSize);
  const data = hiddenCanvas.toDataURL('image/jpeg', 0.92);
  captures.push(data);
  addThumb(data);

  const cells = layout.cols * layout.rows;
  if(captures.length >= cells){
    assembleBtn.disabled = false;
    captureBtn.disabled = true;
    autoBtn.disabled = true;
  }
}

function addThumb(data){
  const img = document.createElement('img');
  img.src = data;
  img.className = 'thumb';
  thumbsEl.appendChild(img);
}

function resetAll(){
  captures = [];
  thumbsEl.innerHTML = '';
  assembleBtn.disabled = true;
  captureBtn.disabled = false;
  autoBtn.disabled = false;
  downloadLink.style.display = 'none';
  finalCanvas.width = finalCanvas.height = 0;
}

function assembleFinal(){
  const layout = parseLayout(layoutSelect.value);
  const cellSize = parseInt(cellSizeSelect.value,10);
  const cols = layout.cols;
  const rows = layout.rows;
  const w = cols * cellSize;
  const h = rows * cellSize;
  finalCanvas.width = w;
  finalCanvas.height = h;
  const ctx = finalCanvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,w,h);

  // draw each captured image into grid order (row-major)
  for(let i=0;i<cols*rows;i++){
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    const x = cx * cellSize;
    const y = cy * cellSize;
    if(i < captures.length){
      const img = new Image();
      img.src = captures[i];
      // draw synchronously by waiting for load - but images are from dataURLs and usually cached
      // Use closure to preserve i,x,y
      ((ix,xpos,ypos,imgRef)=>{
        imgRef.onload = ()=>{
          ctx.drawImage(imgRef, xpos, ypos, cellSize, cellSize);
          // After final draw, enable download
          if(ix === Math.min(captures.length, cols*rows)-1){
            enableDownload();
          }
        };
      })(i,x,y,img);
    }
  }
}

function enableDownload(){
  const data = finalCanvas.toDataURL('image/png');
  downloadLink.href = data;
  downloadLink.download = 'photobooth.png';
  downloadLink.textContent = 'Download Final Image';
  downloadLink.style.display = 'inline-block';
}

function runCountdown(seconds, onTick, onComplete){
  let remaining = seconds;
  countdownEl.style.display = 'flex';
  countdownEl.textContent = remaining;
  onTick && onTick(remaining);
  countdownTimer = setInterval(()=>{
    remaining--;
    if(remaining <= 0){
      clearInterval(countdownTimer);
      countdownTimer = null;
      countdownEl.style.display = 'none';
      onComplete && onComplete();
    } else {
      countdownEl.textContent = remaining;
      onTick && onTick(remaining);
    }
  },1000);
}

function cancelCountdown(){
  if(countdownTimer){
    clearInterval(countdownTimer);
    countdownTimer = null;
    countdownEl.style.display = 'none';
  }
}

function startAutoCapture(){
  const layout = parseLayout(layoutSelect.value);
  const cells = layout.cols * layout.rows;
  if(captures.length >= cells){
    alert('Grid already filled. Reset to capture again.');
    return;
  }
  autoRunning = true;
  autoBtn.disabled = true;
  captureBtn.disabled = true;

  const step = ()=>{
    if(!autoRunning) return;
    if(captures.length >= cells){
      autoRunning = false;
      autoBtn.disabled = false;
      assembleBtn.disabled = false;
      captureBtn.disabled = true;
      return;
    }
    runCountdown(3, null, ()=>{
      captureFrame();
      setTimeout(()=>{ step(); }, 600);
    });
  };
  step();
}

// wire up
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', ()=>{
  stopCamera();
  autoRunning = false;
  cancelCountdown();
});

switchBtn.addEventListener('click', async ()=>{
  facing = (facing === 'environment') ? 'user' : 'environment';
  updateSwitchButton();
  if(stream){
    stopCamera();
    await startCamera();
  }
});

captureBtn.addEventListener('click', ()=>{
  // manual capture with 3s countdown
  captureBtn.disabled = true;
  autoBtn.disabled = true;
  runCountdown(3, null, ()=>{
    captureFrame();
    captureBtn.disabled = false;
    autoBtn.disabled = false;
  });
});

autoBtn.addEventListener('click', ()=>{
  if(autoRunning){
    autoRunning = false; // stop
    cancelCountdown();
    autoBtn.disabled = false;
    captureBtn.disabled = false;
  }else{
    startAutoCapture();
  }
});

resetBtn.addEventListener('click', ()=>{
  autoRunning = false;
  cancelCountdown();
  resetAll();
});

assembleBtn.addEventListener('click', ()=>{
  assembleFinal();
});

// Prevent leaving camera on accidentally when page unloads
window.addEventListener('pagehide', ()=>{
  stopCamera();
});

function updateSwitchButton(){
  switchBtn.textContent = (facing === 'environment') ? 'Use Front Camera' : 'Use Back Camera';
}

// Accessibility: if browser doesn't support getUserMedia, show a helpful message
if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
  startBtn.disabled = true;
  captureBtn.disabled = true;
  autoBtn.disabled = true;
  switchBtn.disabled = true;
  alert('Your browser does not support camera access. Use a modern mobile browser (Chrome, Safari) to run this photobooth.');
}

// On load ensure buttons reflect state
updateSwitchButton();
resetAll();
