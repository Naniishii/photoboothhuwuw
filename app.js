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
const templateSelect = document.getElementById('template');
const captionInput = document.getElementById('caption');
const borderColorInput = document.getElementById('borderColor');
const grayscaleCheckbox = document.getElementById('grayscale');

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
  const cells = cols * rows;
  const template = templateSelect ? templateSelect.value : 'strip';
  const caption = captionInput ? captionInput.value : '';
  const borderColor = borderColorInput ? borderColorInput.value : '#000';
  const useGray = grayscaleCheckbox ? grayscaleCheckbox.checked : false;

  // base content size (photos area)
  const photosW = cols * cellSize;
  const photosH = rows * cellSize;

  // template-specific canvas sizing
  let canvasW = photosW;
  let canvasH = photosH;
  let margin = Math.max(12, Math.round(cellSize*0.06));

  if(template === 'strip' || template === 'receipt'){
    // add margins around strip
    canvasW = photosW + margin*2;
    canvasH = photosH + margin*2 + 60; // footer area
  } else if(template === 'polaroid'){
    // polaroid: larger bottom border
    canvasW = photosW + margin*2;
    canvasH = photosH + margin*2 + 120;
  } else if(template === 'postcard'){
    // postcard: landscape style - add side margins
    canvasW = photosW + margin*2 + 40;
    canvasH = photosH + margin*2 + 40;
  }

  finalCanvas.width = canvasW;
  finalCanvas.height = canvasH;
  const ctx = finalCanvas.getContext('2d');

  // background depending on template
  if(template === 'strip'){
    // colored border background
    ctx.fillStyle = borderColor;
    ctx.fillRect(0,0,canvasW,canvasH);
    // inner white area for photos
    const innerX = margin;
    const innerY = margin;
    const innerW = photosW;
    const innerH = photosH;
    ctx.fillStyle = '#fff';
    ctx.fillRect(innerX, innerY, innerW, innerH);
    // small gap between photos
    var gap = Math.max(8, Math.round(cellSize*0.04));
  } else if(template === 'polaroid'){
    // white card
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvasW,canvasH);
    // thin frame color
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(6,6,canvasW-12,canvasH-12);
    var innerX = margin;
    var innerY = margin;
    var innerW = photosW;
    var innerH = photosH;
    var gap = Math.max(8, Math.round(cellSize*0.04));
  } else if(template === 'postcard'){
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvasW,canvasH);
    ctx.fillStyle = '#f8f4f2';
    ctx.fillRect(0,0,canvasW,40);
    var innerX = margin + 20;
    var innerY = margin + 20;
    var innerW = photosW;
    var innerH = photosH;
    var gap = Math.max(8, Math.round(cellSize*0.03));
  } else { // receipt or default
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvasW,canvasH);
    var innerX = margin;
    var innerY = margin;
    var innerW = photosW;
    var innerH = photosH;
    var gap = Math.max(6, Math.round(cellSize*0.03));
  }

  // prepare positions for each cell inside inner area with small gaps
  const positions = [];
  // compute scaled cell size if we want gaps
  const totalGapX = (cols - 1) * gap;
  const totalGapY = (rows - 1) * gap;
  const drawCellW = Math.floor((innerW - totalGapX) / cols);
  const drawCellH = Math.floor((innerH - totalGapY) / rows);

  for(let i=0;i<cells;i++){
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    const x = innerX + cx * (drawCellW + gap);
    const y = innerY + cy * (drawCellH + gap);
    positions.push({x,y,w:drawCellW,h:drawCellH});
  }

  // draw placeholder frames for polaroid style (thin stroke)
  if(template === 'polaroid'){
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 4;
    positions.forEach(p=>{
      ctx.strokeRect(p.x-4, p.y-4, p.w+8, p.h+8);
    });
  }

  // draw images into positions respecting grayscale option
  if(useGray){ ctx.filter = 'grayscale(100%)'; } else { ctx.filter = 'none'; }

  let drawn = 0;
  let toLoad = Math.min(captures.length, cells);
  if(toLoad === 0){ enableDownload(); return; }

  for(let i=0;i<toLoad;i++){
    const pos = positions[i];
    const img = new Image();
    img.src = captures[i];
    ((imgRef,posRef,idx)=>{
      imgRef.onload = ()=>{
        // draw image center-cropped into pos
        // create temp canvas to crop to square maintaining aspect
        const tmp = document.createElement('canvas');
        tmp.width = imgRef.width; tmp.height = imgRef.height;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(imgRef,0,0);
        // draw directly using drawImage with cover behavior
        const iw = imgRef.width, ih = imgRef.height;
        let sx=0, sy=0, s=0;
        if(iw > ih){ s = ih; sx = Math.floor((iw - ih)/2); sy = 0; } else { s = iw; sx = 0; sy = Math.floor((ih - iw)/2); }
        try{
          ctx.drawImage(imgRef, sx, sy, s, s, posRef.x, posRef.y, posRef.w, posRef.h);
        }catch(e){
          // fallback draw
          ctx.drawImage(imgRef, posRef.x, posRef.y, posRef.w, posRef.h);
        }

        drawn++;
        if(drawn === toLoad){
          // draw footer/caption depending on template
          ctx.filter = 'none';
          if(template === 'strip'){
            // draw caption area at bottom center
            ctx.fillStyle = '#fff';
            ctx.font = '18px "Helvetica Neue", Arial';
            const text = caption || '';
            ctx.fillText(text, margin + 8, innerY + innerH + 36);
          } else if(template === 'polaroid'){
            // draw large caption centered in bottom area
            ctx.fillStyle = '#fff';
            ctx.font = '20px "Helvetica Neue", Arial';
            ctx.fillStyle = '#111';
            const txt = caption || '';
            ctx.textAlign = 'center';
            ctx.fillText(txt, canvasW/2, innerY + innerH + 72);
            ctx.textAlign = 'start';
          } else if(template === 'receipt'){
            // fake barcode
            const bx = margin + 10;
            const by = innerY + innerH + 12;
            for(let b=0;b<40;b++){
              const bw = 2 + (b%3==0?2:0);
              ctx.fillStyle = (b%2===0)?'#000':'#222';
              ctx.fillRect(bx + b*(bw+1), by, bw, 40);
            }
            ctx.fillStyle = '#111';
            ctx.font = '14px Arial';
            ctx.fillText(caption || '', margin, by + 60);
          } else if(template === 'postcard'){
            ctx.fillStyle = '#333';
            ctx.font = '18px Arial';
            ctx.fillText(caption || '', innerX, innerY + innerH + 28);
          }

          // enable download
          enableDownload();
        }
      };
    })(img,pos,i);
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
