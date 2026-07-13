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
const captureBtn = document.getElementById('capture');
const autoBtn = document.getElementById('autoCapture');
const resetBtn = document.getElementById('reset');
const assembleBtn = document.getElementById('assemble');
const downloadLink = document.getElementById('downloadLink');

const layoutSelect = document.getElementById('layout');
const cellSizeSelect = document.getElementById('cellSize');

let stream = null;
let captures = [];
let autoInterval = null;

function parseLayout(val){
  const [cols, rows] = val.split('x').map(n=>parseInt(n,10));
  // some options like 4x2 may be cols x rows
  return {cols, rows};
}

async function startCamera(){
  try{
    // Prefer environment (rear) camera on phones
    const constraints = { video: { facingMode: { exact: 'environment' } } };
    try{
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    }catch(e){
      // fallback to user camera if environment not available
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio:false });
    }
    video.srcObject = stream;

    startBtn.disabled = true;
    stopBtn.disabled = false;
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
  startBtn.disabled = false;
  stopBtn.disabled = true;
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

function startAutoCapture(){
  const layout = parseLayout(layoutSelect.value);
  const cells = layout.cols * layout.rows;
  if(captures.length >= cells){
    alert('Grid already filled. Reset to capture again.');
    return;
  }
  let remaining = cells - captures.length;
  autoBtn.disabled = true;
  captureBtn.disabled = true;

  // 3s between captures
  let count = 0;
  autoInterval = setInterval(()=>{
    if(captures.length >= cells){
      clearInterval(autoInterval);
      autoInterval = null;
      assembleBtn.disabled = false;
      autoBtn.disabled = false;
      return;
    }
    // small visual countdown could be added; here we capture
    captureFrame();
    count++;
  }, 3000);
}

// wire up
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', ()=>{
  stopCamera();
  if(autoInterval){ clearInterval(autoInterval); autoInterval = null; }
});

captureBtn.addEventListener('click', ()=>{
  captureFrame();
});

autoBtn.addEventListener('click', ()=>{
  startAutoCapture();
});

resetBtn.addEventListener('click', ()=>{
  if(autoInterval){ clearInterval(autoInterval); autoInterval = null; }
  resetAll();
});

assembleBtn.addEventListener('click', ()=>{
  assembleFinal();
});

// Prevent leaving camera on accidentally when page unloads
window.addEventListener('pagehide', ()=>{
  stopCamera();
});

// Accessibility: if browser doesn't support getUserMedia, show a helpful message
if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
  startBtn.disabled = true;
  captureBtn.disabled = true;
  autoBtn.disabled = true;
  alert('Your browser does not support camera access. Use a modern mobile browser (Chrome, Safari) to run this photobooth.');
}

// On load ensure buttons reflect state
resetAll();
