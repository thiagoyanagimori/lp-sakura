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
  const TOTAL_FRAMES = 91;
  const FRAME_DIR    = 'frames/';
  const FRAME_PREFIX = 'frame_';
  const FRAME_EXT    = '.jpg';

  /* ---- Build paths ---- */
  function framePath(i) {
    return FRAME_DIR + FRAME_PREFIX + String(i).padStart(4, '0') + FRAME_EXT;
  }

  /* ---- State ---- */
  const images = new Array(TOTAL_FRAMES).fill(null);
  let loadedCount = 0;

  let targetFrame  = 0;
  let currentFrame = 0;
  let lastRenderedFrame = -1;

  // Reference to the active ScrollTrigger instance so we can kill/recreate on resize
  let st = null;

  /* ---- Canvas sizing ---- */
  let _dpr = 1;

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    _dpr = Math.min(window.devicePixelRatio || 1, 2);

    const rect = wrap.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width  = Math.round(w * _dpr);
    canvas.height = Math.round(h * _dpr);
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';

    ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
    drawFrame(currentFrame);
  }

  /* ---- Draw a single frame index (0-based, may be float) ---- */
  function drawFrame(idx) {
    const i = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(idx)));
    const img = images[i];

    const bw = canvas.width  / _dpr;
    const bh = canvas.height / _dpr;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, bw, bh);

    if (!img || !img.complete || !img.naturalWidth) return;

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

  /* ---- Loading overlay ---- */
  const loader    = document.getElementById('canvasLoader');
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

  /* ---- Create (or recreate) the ScrollTrigger ---- */
  function createScrollTrigger() {
    // Kill any existing instance cleanly before making a new one
    if (st) {
      st.kill();
      st = null;
    }

    // Reset scroll position tracking
    targetFrame = 0;

    st = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      // Use a function so the value is always recalculated fresh on every refresh
      end: () => `+=${window.innerHeight * 1}`,
      pin: true,
      anticipatePin: 1,
      // invalidateOnRefresh forces GSAP to re-call start/end functions on every refresh
      invalidateOnRefresh: true,
      onUpdate(self) {
        targetFrame = self.progress * (TOTAL_FRAMES - 1);
      },
      onEnter() {
        if (scrollHint) gsap.to(scrollHint, { opacity: 0, duration: 0.4 });
      },
      onLeaveBack() {
        if (scrollHint) gsap.to(scrollHint, { opacity: 0.5, duration: 0.4 });
      }
    });
  }

  /* ---- Full refresh: recalculate everything and re-sync GSAP ---- */
  function fullRefresh() {
    resizeCanvas();
    // ScrollTrigger.refresh() forces GSAP to re-measure all pinned sections
    // and recompute start/end positions based on current DOM layout
    ScrollTrigger.refresh(true);
  }

  /* ---- Bootstrap after all frames are loaded ---- */
  function onAllLoaded() {
    drawFrame(0);
    hideLoader();

    // Step 1: create the trigger now with current layout
    createScrollTrigger();

    // Step 2: once the full page (fonts, images, everything) has settled,
    // do a final authoritative refresh so the pin spacer reflects true heights
    if (document.readyState === 'complete') {
      // Already fully loaded — refresh on next frame so paint has settled
      requestAnimationFrame(() => {
        requestAnimationFrame(fullRefresh);
      });
    } else {
      window.addEventListener('load', () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(fullRefresh);
        });
      }, { once: true });
    }
  }

  /* ---- rAF render loop — Apple-style fluid lerp ---- */
  (function renderLoop() {
    const LERP = 0.07;
    currentFrame += (targetFrame - currentFrame) * LERP;

    if (Math.abs(currentFrame - lastRenderedFrame) > 0.05) {
      drawFrame(currentFrame);
      lastRenderedFrame = currentFrame;
    }

    requestAnimationFrame(renderLoop);
  })();

  /* ---- Resize: debounce to avoid thrashing ---- */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      // After resize, recalculate all ScrollTrigger positions
      ScrollTrigger.refresh(true);
    }, 150);
  });

  /* ---- Init: size canvas and kick off preload ---- */
  resizeCanvas();

  // Load frame 0 first for instant first-paint
  const firstImg = new Image();
  firstImg.src = framePath(1);
  firstImg.onload = () => {
    images[0] = firstImg;
    loadedCount++;
    updateLoader(loadedCount / TOTAL_FRAMES);
    drawFrame(0);
  };
  firstImg.onerror = () => { loadedCount++; };
  images[0] = firstImg;

  // Load remaining frames in parallel
  for (let i = 1; i < TOTAL_FRAMES; i++) {
    const img = new Image();
    const idx = i; // capture for closure
    img.src = framePath(idx + 1);
    img.onload = () => {
      loadedCount++;
      updateLoader(loadedCount / TOTAL_FRAMES);
      if (loadedCount === TOTAL_FRAMES) onAllLoaded();
    };
    img.onerror = () => {
      loadedCount++;
      if (loadedCount === TOTAL_FRAMES) onAllLoaded();
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
