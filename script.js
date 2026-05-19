/* ============================================
   Yeston Sakura RTX 5080 — Script
   GSAP ScrollTrigger canvas image-sequence scrub + reveals
   ============================================ */

gsap.registerPlugin(ScrollTrigger);

// --- Image Sequence Canvas Scrub ---
(function initCanvasScrub() {
  const canvas = document.getElementById('heroCanvas');
  const hero   = document.getElementById('hero');
  const scrollHint = document.querySelector('.scroll-hint');

  if (!canvas || !hero) return;

  const ctx = canvas.getContext('2d', { alpha: false });

  /* ---- Config ---- */
  const TOTAL_FRAMES = 91;          // must match actual extracted frames
  const FRAME_DIR    = 'frames/';   // relative path from index.html
  const FRAME_PREFIX = 'frame_';
  const FRAME_EXT    = '.jpg';

  /* ---- Build paths ---- */
  function framePath(i) {
    // i is 1-based: frame_0001.jpg … frame_0091.jpg
    return FRAME_DIR + FRAME_PREFIX + String(i).padStart(4, '0') + FRAME_EXT;
  }

  /* ---- State ---- */
  const images   = new Array(TOTAL_FRAMES).fill(null);
  let loadedCount = 0;
  let allLoaded   = false;

  // Interpolated frame index (floating-point for smooth lerp)
  let targetFrame  = 0;   // 0-based float
  let currentFrame = 0;

  /* ---- Canvas sizing ---- */
  // Store DPR separately so drawFrame always knows the current pixel ratio
  let _dpr = 1;

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    _dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Use the wrap's bounding rect for the true CSS pixel size
    const rect = wrap.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Set the canvas backing buffer to physical pixels
    canvas.width  = Math.round(w * _dpr);
    canvas.height = Math.round(h * _dpr);

    // CSS display size matches the wrap exactly
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';

    // Reset transform completely, then apply DPR scale once
    ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);

    drawFrame(currentFrame);
  }

  /* ---- Draw a single frame index (0-based, may be float for lerp) ---- */
  function drawFrame(idx) {
    const i = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(idx)));
    const img = images[i];

    // Always paint white over the full backing buffer (in CSS px space after ctx.setTransform)
    const bw = canvas.width  / _dpr;
    const bh = canvas.height / _dpr;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, bw, bh);

    if (!img || !img.complete || !img.naturalWidth) return;

    // object-fit: contain centred
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min(bw / iw, bh / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (bw - dw) / 2;
    const dy = (bh - dh) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ---- Preload all frames ---- */
  function preload(onProgress) {
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = framePath(i + 1); // files are 1-based
      img.onload = () => {
        loadedCount++;
        if (onProgress) onProgress(loadedCount / TOTAL_FRAMES);
        if (loadedCount === TOTAL_FRAMES) {
          allLoaded = true;
          onAllLoaded();
        }
      };
      img.onerror = () => {
        // Count errors so we don't stall forever
        loadedCount++;
        if (loadedCount === TOTAL_FRAMES) {
          allLoaded = true;
          onAllLoaded();
        }
      };
      images[i] = img;
    }
  }

  /* ---- Bootstrap ScrollTrigger after everything loads ---- */
  function onAllLoaded() {
    // Draw first frame immediately
    drawFrame(0);
    hideLoader();
    initScrollTrigger();
  }

  /* ---- Loading overlay ---- */
  const loader = document.getElementById('canvasLoader');
  const loaderBar = document.getElementById('canvasLoaderBar');

  function updateLoader(pct) {
    if (loaderBar) loaderBar.style.width = (pct * 100).toFixed(1) + '%';
  }

  function hideLoader() {
    if (loader) {
      loader.style.transition = 'opacity 0.5s ease';
      loader.style.opacity    = '0';
      setTimeout(() => { loader.style.display = 'none'; }, 500);
    }
  }

  /* ---- ScrollTrigger + rAF render loop ---- */
  function initScrollTrigger() {
    const LERP = 0.07; // lower = smoother / more lag; higher = snappier

    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: () => `+=${window.innerHeight * 3}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate(self) {
        // Map scroll progress → frame index (0-based float)
        targetFrame = self.progress * (TOTAL_FRAMES - 1);
      },
      onEnter() {
        if (scrollHint) gsap.to(scrollHint, { opacity: 0, duration: 0.4 });
      },
      onLeaveBack() {
        if (scrollHint) gsap.to(scrollHint, { opacity: 0.5, duration: 0.4 });
      }
    });

    /* rAF render loop — Apple-style fluid lerp */
    function renderLoop() {
      // Exponential approach (frame-rate independent feel)
      currentFrame += (targetFrame - currentFrame) * LERP;

      // Only redraw when visually meaningful change
      if (Math.abs(currentFrame - lastRenderedFrame) > 0.05) {
        drawFrame(currentFrame);
        lastRenderedFrame = currentFrame;
      }

      requestAnimationFrame(renderLoop);
    }

    let lastRenderedFrame = -1;
    renderLoop();
  }

  /* ---- Init ---- */
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Start loading; show first frame as soon as it's ready for perceived speed
  images[0] = new Image();
  images[0].src = framePath(1);
  images[0].onload = () => {
    loadedCount++;
    drawFrame(0);
  };

  // Preload the rest
  for (let i = 1; i < TOTAL_FRAMES; i++) {
    const img = new Image();
    img.src = framePath(i + 1);
    img.onload = () => {
      loadedCount++;
      updateLoader(loadedCount / TOTAL_FRAMES);
      if (loadedCount === TOTAL_FRAMES) {
        allLoaded = true;
        onAllLoaded();
      }
    };
    img.onerror = () => {
      loadedCount++;
      if (loadedCount === TOTAL_FRAMES) { allLoaded = true; onAllLoaded(); }
    };
    images[i] = img;
  }

})();


// --- Scroll Reveal ---
(function initReveals() {
  const reveals = document.querySelectorAll('[data-reveal]');

  reveals.forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter() {
        const siblings = el.parentElement.querySelectorAll('[data-reveal]');
        const index = Array.from(siblings).indexOf(el);
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          delay: index * 0.1,
          ease: 'power2.out'
        });
      }
    });
  });

  const textEls = document.querySelectorAll('.section-eyebrow, .section-heading, .section-body');
  textEls.forEach(el => {
    gsap.set(el, { opacity: 0, y: 25 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter() {
        gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' });
      }
    });
  });
})();


// --- Hero intro animation ---
(function initHeroAnim() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.from('.hero-title-line', {
    y: 40,
    opacity: 0,
    duration: 1,
    stagger: 0.15
  })
  .from('.hero-subtitle', {
    y: 20,
    opacity: 0,
    duration: 0.8
  }, '-=0.5')
  .from('.hero-cta', {
    y: 15,
    opacity: 0,
    duration: 0.6
  }, '-=0.4')
  .from('.hero-canvas-wrap', {
    opacity: 0,
    scale: 0.96,
    duration: 1
  }, '-=0.6');
})();
