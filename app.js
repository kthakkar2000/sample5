// app.js - complete ready-to-paste (use with index.html from your project)
document.addEventListener('DOMContentLoaded', async () => {

  /* ---------- utilities ---------- */
  const exts = ['.avif','.webp','.jpg','.jpeg','.png'];
  function tryLoadVariants(candidates, imgEl, hideIfFail=true){
    let i = 0;
    const queue = [];
    candidates.forEach(b => {
      if (/\.[a-zA-Z0-9]{2,5}$/.test(b)) queue.push(b);
      else exts.forEach(e => queue.push(b + e));
    });
    function next() {
      if (i >= queue.length) { if (hideIfFail) imgEl.style.display = 'none'; return; }
      const src = queue[i++];
      const t = new Image();
      t.onload = () => { imgEl.src = src; imgEl.style.display = 'block'; };
      t.onerror = next;
      t.src = src;
    }
    next();
  }

  function makeVariantPaths(name){
    const ext = name.match(/\.[^/.]+$/) ? name.match(/\.[^/.]+$/)[0] : '';
    const base = name.replace(/\.[^/.]+$/,'');
    return [
      'assets/' + name,
      'assets/' + base + ext,
      'assets/' + base.replace(/\s+/g,'') + ext,
      'assets/' + base.replace(/\s+/g,'-') + ext,
      'assets/' + base.replace(/\s+/g,'_') + ext,
      'assets/' + base
    ];
  }

  /* ---------- load logo (try variants) ---------- */
  const mainLogo = document.getElementById('mainLogo');
  if (mainLogo) {
    tryLoadVariants(['assets/ktpl-new-logo.png','assets/ktpl-new-logo.jpg','assets/ktpl-new-logo.webp','assets/ktpl new logo.png','ktpl-new-logo.png'], mainLogo, true);
    setTimeout(()=> {
      if (!mainLogo.src) {
        const fb = document.getElementById('logoFallback');
        if (fb) fb.style.display='flex';
      }
    }, 1200);
  }

  /* ---------- load products.json ---------- */
  let PRODUCTS = {};
  try {
    const res = await fetch('products.json', {cache: "no-store"});
    if (!res.ok) throw new Error('products.json fetch failed: ' + res.status);
    PRODUCTS = await res.json();
  } catch (err) {
    console.error('Failed to load products.json:', err);
    PRODUCTS = {};
  }

  /* ---------- choose product (case-insensitive) ---------- */
  const params = new URLSearchParams(location.search);
  const requested = (params.get('product') || '').trim();
  let productKey = null;

  const keyMap = {};
  Object.keys(PRODUCTS || {}).forEach(k => { keyMap[k.toLowerCase()] = k; });

  if (requested) {
    if (PRODUCTS[requested]) productKey = requested;
    else if (keyMap[requested.toLowerCase()]) productKey = keyMap[requested.toLowerCase()];
  }
  if (!productKey) {
    const keys = Object.keys(PRODUCTS || {});
    productKey = keys.length ? keys[0] : null;
  }

  const product = productKey ? PRODUCTS[productKey] : null;
  console.log('Using productKey =>', productKey);
  console.log('Product object =>', product);

  if (!product) {
    const t = document.getElementById('prodTitle');
    if (t) t.textContent = 'Product not found';
    const s = document.getElementById('prodSize');
    if (s) s.textContent = '';
    return;
  }

  /* ---------- populate basic DOM ---------- */
  const prodTitleEl = document.getElementById('prodTitle');
  const prodSizeEl = document.getElementById('prodSize');
  if (prodTitleEl) prodTitleEl.textContent = product.title || 'Unnamed product';
  if (prodSizeEl) prodSizeEl.innerHTML = `${product.sizeText || ''} • <span class="price-badge" id="priceBadge">₹${Number(product.price || 0).toLocaleString('en-IN')}</span>`;

  /* ---------- build gallery ---------- */
  const slidesEl = document.getElementById('slides');
  if (slidesEl) slidesEl.innerHTML = '';
  const gallery = [];

  (product.images || []).forEach(fname => {
    const img = document.createElement('img');
    img.alt = product.title || 'product image';
    img.loading = 'lazy';
    slidesEl.appendChild(img);
    tryLoadVariants(makeVariantPaths(fname), img);
    gallery.push(img);
    img.addEventListener('click', ()=> openLightbox(gallery.indexOf(img)));
  });

  // slider controls
  const dotsEl = document.getElementById('dots');
  let idx = 0;
  function buildDots(){
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    for (let i=0;i<slidesEl.children.length;i++){
      const d = document.createElement('div'); d.className = 'dot' + (i===0 ? ' active' : '');
      d.style.cursor = 'pointer';
      d.addEventListener('click', ()=> { idx = i; updateSlide(); });
      dotsEl.appendChild(d);
    }
  }
  function updateSlide(){
    if (!slidesEl.children.length) return;
    slidesEl.style.transform = `translateX(${-idx*100}%)`;
    if (dotsEl) Array.from(dotsEl.children).forEach((d,i)=> d.classList.toggle('active', i===idx));
  }
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if (prevBtn) prevBtn.addEventListener('click', ()=> { if(!slidesEl.children.length) return; idx = (idx-1 + slidesEl.children.length) % slidesEl.children.length; updateSlide(); });
  if (nextBtn) nextBtn.addEventListener('click', ()=> { if(!slidesEl.children.length) return; idx = (idx+1) % slidesEl.children.length; updateSlide(); });

  // swipe support
  (function(){
    let startX = null;
    const c = document.getElementById('carousel');
    if (!c) return;
    c.addEventListener('touchstart', e => startX = e.changedTouches[0].clientX, {passive:true});
    c.addEventListener('touchend', e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) idx = Math.min(idx+1, slidesEl.children.length-1);
        else idx = Math.max(idx-1, 0);
        updateSlide();
      }
      startX = null;
    }, {passive:true});
  })();

  setTimeout(()=>{ buildDots(); updateSlide(); }, 250);

  /* ---------- lightbox ---------- */
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbClose = document.getElementById('lb-close');
  const lbPrev = document.getElementById('lb-prev');
  const lbNext = document.getElementById('lb-next');
  let lbIndex = 0, zoomed = false, startDist = 0, lastX=0, lastY=0;

  function openLightbox(i){
    lbIndex = i || 0;
    const src = slidesEl.children[lbIndex] && slidesEl.children[lbIndex].src;
    if (!src) return;
    if (lbImg) lbImg.src = src;
    if (lb) { lb.style.display = 'flex'; lb.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; }
    zoomed = false;
    if (lbImg) lbImg.style.transform = 'translate(0,0) scale(1)';
    if (lbPrev) lbPrev.style.display = gallery.length > 1 ? 'block' : 'none';
    if (lbNext) lbNext.style.display = gallery.length > 1 ? 'block' : 'none';
  }
  function closeLightbox(){ if (lb) { lb.style.display = 'none'; lb.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; } }
  function showPrev(){ if (slidesEl.children.length <= 1) return; lbIndex = (lbIndex-1 + slidesEl.children.length) % slidesEl.children.length; if (lbImg) lbImg.src = slidesEl.children[lbIndex].src; zoomed=false; if (lbImg) lbImg.style.transform='translate(0,0) scale(1)'; }
  function showNext(){ if (slidesEl.children.length <= 1) return; lbIndex = (lbIndex+1) % slidesEl.children.length; if (lbImg) lbImg.src = slidesEl.children[lbIndex].src; zoomed=false; if (lbImg) lbImg.style.transform='translate(0,0) scale(1)'; }

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbPrev) lbPrev.addEventListener('click', showPrev);
  if (lbNext) lbNext.addEventListener('click', showNext);
  if (lb) lb.addEventListener('click', (e)=> { if (e.target === lb || e.target === lbImg) closeLightbox(); });
  window.addEventListener('keydown', (e)=> { if (lb && lb.style.display === 'flex') { if (e.key === 'Escape') closeLightbox(); if (e.key === 'ArrowLeft') showPrev(); if (e.key === 'ArrowRight') showNext(); } });

  // double-tap and pinch-to-zoom
  let lastTap = 0;
  if (lbImg) {
    lbImg.addEventListener('touchstart', function(e){
      if (e.touches && e.touches.length === 2){
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startDist = Math.hypot(dx, dy);
      } else if (e.touches && e.touches.length === 1){
        const now = Date.now();
        if (now - lastTap < 300){ toggleZoom(e.touches[0].clientX, e.touches[0].clientY); lastTap = 0; } else lastTap = now;
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      }
    }, {passive:true});

    lbImg.addEventListener('touchmove', function(e){
      if (e.touches && e.touches.length === 2){
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (startDist > 0) {
          const scale = Math.max(1, Math.min(3, (dist / startDist)));
          lbImg.style.transform = `translate(0,0) scale(${scale})`;
          zoomed = scale > 1.05;
        }
      } else if (e.touches && e.touches.length === 1 && zoomed){
        e.preventDefault();
        const nx = e.touches[0].clientX;
        const ny = e.touches[0].clientY;
        const dx = nx - lastX;
        const dy = ny - lastY;
        const cur = lbImg.style.transform || 'translate(0,0) scale(1)';
        const m = cur.match(/translate\((-?\d+(?:\.\d+)?)px,(-?\d+(?:\.\d+)?)px\)/);
        let tx = 0, ty = 0;
        if (m){ tx = parseFloat(m[1]); ty = parseFloat(m[2]); }
        tx += dx; ty += dy;
        lbImg.style.transform = `translate(${tx}px,${ty}px) scale(${zoomed?2:1})`;
        lastX = nx; lastY = ny;
      }
    }, {passive:false});

    lbImg.addEventListener('touchend', function(){ startDist = 0; });
    lbImg.addEventListener('dblclick', ()=> toggleZoom());
  }
  function toggleZoom(){
    if (!zoomed){ if (lbImg) lbImg.style.transform='translate(0,0) scale(2)'; zoomed = true; }
    else { if (lbImg) lbImg.style.transform='translate(0,0) scale(1)'; zoomed = false; }
  }

  /* ---------- helper formatters for prompts ---------- */
  function formatFeatures(prod) {
    const f = prod.features;
    if (!f) return (lang === 'en') ? 'No specific features listed.' : 'કોઈ વિશિષ્ટ લક્ષણો સૂચવાયેલા નથી.';
    // handle string or array
    const list = Array.isArray(f) ? f : String(f).split(/\s*[,;·]\s*/).filter(Boolean);
    if (!list.length) return (lang === 'en') ? 'No specific features listed.' : 'કોઈ વિશિષ્ટ લક્ષણો સૂચવાયેલા નથી.';
    if (lang === 'en') {
      return 'Key features:\n• ' + list.join('\n• ');
    } else {
      // Gujarati short labels (keeps original items but add gu header)
      return 'મુખ્ય લક્ષણો:\n• ' + list.join('\n• ');
    }
  }

  function formatDescription(prod, useShort=false) {
    const descObj = prod.description || {};
    const en = descObj.en || prod.title || 'Description not available.';
    const gu = descObj.gu || prod.title || 'વર્ણન ઉપલબ્ધ નથી.';
    if (useShort) {
      if (lang === 'en') {
        // short one-line summary + image count
        const imgCount = (prod.images && prod.images.length) || 0;
        return `${en.split('.').slice(0,1).join('.')}${en.endsWith('.') ? '' : '.'} (${imgCount} image${imgCount===1 ? '' : 's'} available)`;
      } else {
        const imgCount = (prod.images && prod.images.length) || 0;
        return `${gu.split('.').slice(0,1).join('.')} ${imgCount > 0 ? `(${imgCount} છબી)` : ''}`;
      }
    }
    return (lang === 'en') ? en : gu;
  }

  /* ---------- updated PROMPTS (replace original PROMPTS block with this) ---------- */
  const PROMPTS = [
    { q:/(\bprice\b|\bcost\b|₹|rupee|દામ|કિંમત|કિંમतो)/i,
      en: () => `Price (approx): ₹${Number(product.price || 0).toLocaleString('en-IN')}. Ask in-store for EMI & exchange options.`,
      gu: () => `ભાવ (અંદ poisson): ₹${Number(product.price || 0).toLocaleString('en-IN')}. EMI અને એક્સચેન્જ વિકલ્પો સ્ટોર પર તપાસો.` },

    { q:/(\bdimension|dimensions|size|height|width|depth|માપ|ઊંચાઈ|પહોળાઈ|ઊંડાઈ)/i,
      en: () => product.dimensions ? `Dimensions: ${product.dimensions}` : 'Typical dimensions (with stand): W 83.8 cm × H 60.4 cm × D 18.45 cm (estimate).',
      gu: () => product.dimensions ? `માપ: ${product.dimensions}` : 'સ્ટૅંડ સાથે માપ આશરે: પહોળાઈ 83.8 સેમી × ઊંચાઈ 60.4 સેમી × ઊંડાઈ 18.45 સેમી.' },

    { q:/(\bwarranty|guarantee|service|વોરંટી|ગેરંટી)/i,
      en: () => product.warranty ? `Warranty: ${product.warranty}` : 'Warranty details are not available. Please check with the store.',
      gu: () => product.warranty ? `વોરંટી: ${product.warranty}` : 'વોરંટીની માહિતી ઉપલબ્ધ નથી. કૃપા કરીને સ્ટોરમાં તપાસો.' },

    { q:/(\binstall|installation|setup|fit|ઇન્સ્ટોલ|સ્થાપન)/i,
      en: () => product.installation ? `Installation: ${product.installation}` : 'Installation information is not available. Contact store for assistance.',
      gu: () => product.installation ? `ઇન્સ્ટોલેશન: ${product.installation}` : 'ઇન્સ્ટોલેશનની માહિતી ઉપલબ્ધ નથી. સહાય માટે સ્ટોરનો સંપર્ક કરો.' },

    { q:/(\bdelivery|deliver|ship|shipping|dispatch|ડિલિવરી|ડિલિવર|મોકલવું|શિપમેન્ટ)/i,
      en: () => product.delivery ? `Delivery: ${product.delivery}` : 'Delivery information is not available. Check with store.',
      gu: () => product.delivery ? `ડિલિવરી: ${product.delivery}` : 'ડિલિવરીની માહિતી ઉપલબ્ધ નથી. કૃપા કરીને સ્ટોરમાં તપાસો.' },

    // improved features reply (uses formatFeatures)
    { q:/(\bfeature|features|spec|specs|વિશેષતા|લક્ષણ|ફીચર)/i,
      en: () => formatFeatures(product),
      gu: () => formatFeatures(product) },

    { q:/(\bport|ports|hdmi|usb|ethernet|audio|પોર્ટ)/i,
      en: () => product.ports ? `Ports: ${product.ports}` : 'Includes HDMI, USB and audio ports — exact count varies by model. Check product label for details.',
      gu: () => product.ports ? `પોર્ટ્સ: ${product.ports}` : 'મોડેલ પર આધારિત HDMI, USB અને ઓડિયો પોર્ટ્સ ઉપલબ્ધ છે. વધુ વિગતો માટે પ્રોડક્ટ લેબલ જુઓ.' },

    // richer description reply (full and short options)
    { q:/(\bdescription|detail|describe|વિગત|વર્ણન|description)/i,
      en: (text) => {
        // if user asked "short" or "quick" return short summary, otherwise full
        const wantShort = /short|quick|summary|સંક્ષિપ્ત|સારાંશ/i.test(text);
        return formatDescription(product, wantShort);
      },
      gu: (text) => {
        const wantShort = /short|quick|summary|સંક્ષિપ્ત|ગારાંશ/i.test(text);
        return formatDescription(product, wantShort);
      } },

    { q:/(\badvantage|why buy|compare|benefit|ફાયદો|પ્રોડક્ટના ફાયદા)/i,
      en: () => {
        const fe = Array.isArray(product.features) ? product.features.slice(0,4).join(', ') : (product.features || 'Great value and reliable performance');
        return `Why buy: ${fe}. Strong picture/audio performance for the price and good after-sales support (model-dependent).`;
      },
      gu: () => {
        const fe = Array.isArray(product.features) ? product.features.slice(0,4).join(', ') : (product.features || 'શ્રેષ્ઠ કિંમત અને વિશ્વસનીય પ્રદર્શન');
        return `ક neden ખરીદશો: ${fe}. કિંમતના પ્રમાણમાં ઉત્તમ પ્રદર્શન અને મોડેલ-આધારિત સર્વિસ સપોર્ટ.`;
      } },

    { q:/(\bpower|watt|consumption|energy|વોટ|વીજ)/i,
      en: () => 'Typical operating power: ~70–200W depending on model & usage; standby <1W. Exact figures are on the spec label or manual.',
      gu: () => 'સામાન્ય ચલાવવાની વીજ વપરાશ ~70–200W મોડેલ અને ઉપયોગ પર આધાર રાખે છે; સ્ટેન્ડબાય <1W. ચોક્કસ આંકડા સ્પેક લેબલ અથવા મેન્યુઅલમાં જુઓ.' },

    { q:/(\breview|reviews|rating|customer feedback|પ્રતિસાદ|સમીક્ષા)/i,
      en: () => 'Common feedback: very good value for money, colors and sound praised; confirm peak brightness for very bright rooms before purchase.',
      gu: () => 'ગ્રાહક પ્રતિસાદ: કિંમત માટે સારું મૂલ્ય, રંગો અને અવાજની પ્રશંસા; ખૂબ તેજ રૂમ માટે પીક બ્રાઇટનેસ પુષ્ટિ કરો.' },

    // default fallback (more helpful guidance)
    { q:/.*/i,
      en: () => 'Sorry — please ask about price, features, description (or say "short description"), dimensions, warranty, installation, ports or delivery.',
      gu: () => 'માફ કરશો — કૃપા કરીને કિંમત, લક્ષણો, વર્ણન (અથવા "સંક્ષિપ્ત વર્ણન"), માપ, વોરંટી, ઇન્સ્ટોલેશન, પોર્ટ્સ અથવા ડિલિવરી વિષે પૂછો.' }
  ];

  function findAnswer(text, lang='en'){
    for (const p of PROMPTS) if (p.q.test(text)) {
      try {
        const resp = (lang === 'en' ? p.en : p.gu);
        if (typeof resp === 'function') return resp(text);
        return resp;
      } catch(err) {
        console.error('Prompt handler error', err);
        return (lang === 'en') ? 'Sorry, I could not get that information.' : 'માફ કરશો, હું તે માહિતી મેળવવામાં અસમર્થ હતો.';
      }
    }
    return (lang === 'en' ? PROMPTS[PROMPTS.length-1].en() : PROMPTS[PROMPTS.length-1].gu());
  }

  /* ---------- language selection ---------- */
  const langSelect = document.getElementById('langSelect');
  let lang = localStorage.getItem('ktpl_lang') || 'en';
  if (langSelect) {
    langSelect.value = lang;
    langSelect.addEventListener('change', ()=> {
      lang = langSelect.value || 'en';
      localStorage.setItem('ktpl_lang', lang);
      const panelSub = document.getElementById('panelSub');
      if (panelSub) panelSub.textContent = (lang === 'en' ? 'Tap mic or type your question' : 'માઇક દબાવો અથવા લખો');
    });
  }

  /* ---------- panel / messages / composer ---------- */
  const panel = document.getElementById('panel');
  const messagesEl = document.getElementById('messages');
  const inputBox = document.getElementById('inputBox');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');

  function openPanel(){ if (panel) { panel.style.display = 'flex'; panel.setAttribute('aria-hidden','false'); setTimeout(()=> { if (inputBox) { inputBox.focus(); if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight; } }, 120); } }
  function closePanel(){ if (panel) { panel.style.display = 'none'; panel.setAttribute('aria-hidden','true'); deactivateListeningUI(); } }
  const closePanelBtn = document.getElementById('closePanel');
  const askBtn = document.getElementById('askBtn');
  const assistBtn = document.getElementById('assistBtn');
  if (closePanelBtn) closePanelBtn.addEventListener('click', closePanel);
  if (askBtn) askBtn.addEventListener('click', ()=> { openPanel(); if (inputBox) inputBox.focus(); });
  if (assistBtn) assistBtn.addEventListener('click', ()=> { openPanel(); setTimeout(()=> { if (micBtn) micBtn.click(); }, 220); });

  function pushMessage(text, who='bot'){
    if (!text || !messagesEl) return;
    const el = document.createElement('div');
    el.className = 'bubble ' + (who === 'user' ? 'user' : 'bot');
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  if (sendBtn) sendBtn.addEventListener('click', function(){
    const v = inputBox && inputBox.value && inputBox.value.trim();
    if (!v) return;
    if (inputBox) inputBox.value = '';
    pushMessage(v, 'user');
    const ans = findAnswer(v, lang);
    setTimeout(()=> { pushMessage(ans, 'bot'); speak(ans); }, 160);
  });
  if (inputBox) inputBox.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); if (sendBtn) sendBtn.click(); } });

  /* ---------- speech recognition & TTS ---------- */
  let recognition = null, listening = false;

  function activateListeningUI(){ const lb = document.getElementById('listeningBanner'); if (lb) { lb.style.display = 'flex'; lb.classList.add('active'); const lt = document.getElementById('listeningText'); if (lt) lt.textContent = (lang === 'en' ? 'Listening...' : 'સુનાઈ રહ્યું છે...'); const ps = document.getElementById('panelSub'); if (ps) ps.textContent = (lt ? lt.textContent : (lang === 'en' ? 'Listening...' : 'સુનાઈ રહ્યું છે...')); } }
  function deactivateListeningUI(){ const lb = document.getElementById('listeningBanner'); if (lb) { lb.classList.remove('active'); lb.style.display = 'none'; const ps = document.getElementById('panelSub'); if (ps) ps.textContent = (lang === 'en' ? 'Tap mic or type your question' : 'માઇક દબાવો અથવા લખો'); } }

  if (window.SpeechRecognition || window.webkitSpeechRecognition){
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = function(){ listening = true; activateListeningUI(); if (micBtn) { micBtn.textContent='●'; micBtn.style.transform='scale(1.03)'; micBtn.style.boxShadow='0 8px 28px rgba(255,122,90,0.12)'; } };
    recognition.onresult = function(e){
      const txt = (e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) || '';
      if (txt) {
        pushMessage(txt, 'user');
        const ans = findAnswer(txt, lang);
        setTimeout(()=> { pushMessage(ans, 'bot'); speak(ans); }, 160);
      }
    };
    recognition.onend = function(){ listening = false; deactivateListeningUI(); if (micBtn) { micBtn.textContent='🎤'; micBtn.style.transform=''; micBtn.style.boxShadow=''; } };
    recognition.onerror = function(){ listening = false; deactivateListeningUI(); if (micBtn) { micBtn.textContent='🎤'; micBtn.style.transform=''; micBtn.style.boxShadow=''; } };
  }

  // mic click: speak welcome then start recognition (only once per session per product)
  if (micBtn) micBtn.addEventListener('click', async function(){
    if (!('speechSynthesis' in window) && !(window.SpeechRecognition || window.webkitSpeechRecognition)){
      alert(lang === 'en' ? 'Speech recognition and TTS not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ અને ટેક્સ્ટ-ટુ-સ્પીચ સપોર્ટ નથી.');
      return;
    }

    const welcomeKey = 'ktpl_welcome_spoken_' + (productKey || 'default');
    const alreadySpoken = sessionStorage.getItem(welcomeKey) === '1';

    const welcomeText = (lang === 'en')
      ? `Welcome to Kalindi Tradelinks Private Limited. How can I help you about the ${product.title}?`
      : `કાલિન્દી ટ્રેડલિંક્સ પ્રાયવેટ لિમિટેડમાં આપનું સ્વાગત છે. હું ${product.title} વિશે કેવી રીતે મદદ કરી શકું?`;

    function startRecognition() {
      if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        try { recognition.lang = (lang === 'en' ? 'en-IN' : 'gu-IN'); recognition.start(); } catch(e){ /* ignore */ }
      } else {
        pushMessage(lang === 'en' ? 'Speech recognition not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ રેકોગ્નિશન સપોર્ટ નથી.', 'bot');
      }
    }

    // if welcome already played earlier in this session — skip TTS and start recognition immediately
    if (alreadySpoken) {
      openPanel();
      setTimeout(() => startRecognition(), 180);
      return;
    }

    // speak welcome once then start recognition
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch(e){}
      const utter = new SpeechSynthesisUtterance(welcomeText);
      utter.lang = (lang === 'en' ? 'en-IN' : 'gu-IN');

      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
          const pref = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'gu'));
          if (pref) utter.voice = pref;
        }
      } catch(e){ /* ignore */ }

      utter.onstart = function(){
        sessionStorage.setItem(welcomeKey, '1'); // mark as spoken
        openPanel();
        activateListeningUI();
      };

      utter.onend = function(){
        startRecognition();
      };

      try {
        window.speechSynthesis.speak(utter);
      } catch(e){
        // fallback if speak fails
        startRecognition();
        sessionStorage.setItem(welcomeKey, '1');
      }
    } else {
      sessionStorage.setItem(welcomeKey, '1');
      openPanel();
      setTimeout(()=> startRecognition(), 120);
    }
  });

  // speak helper
  function speak(text){
    if (!('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = (lang === 'en' ? 'en-IN' : 'gu-IN');
      try {
        const voices = speechSynthesis.getVoices();
        if (voices && voices.length){
          const pref = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'gu'));
          if (pref) u.voice = pref;
        }
      } catch(e){ /* ignore */ }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error('TTS failed', e);
    }
  }

  // keyboard handling for mobile (keep composer visible)
  const panelEl = document.getElementById('panel');
  if (window.visualViewport && panelEl){
    let lastH = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', ()=> {
      const vh = window.visualViewport.height;
      const dh = window.innerHeight - vh;
      if (vh < lastH - 50) panelEl.style.transform = `translateY(-${dh}px)`;
      else panelEl.style.transform = '';
      lastH = vh;
      setTimeout(()=>{ if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight; },200);
    });
    if (inputBox) inputBox.addEventListener('focus', ()=> setTimeout(()=> { panelEl.style.transform=''; if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight; },200));
  } else {
    // fallback resize handling
    let lastInner = window.innerHeight;
    window.addEventListener('resize', ()=> {
      const now = window.innerHeight;
      if (now < lastInner - 80 && panelEl) panelEl.style.transform = 'translateY(-160px)';
      else if (panelEl) panelEl.style.transform = '';
      lastInner = now;
    });
  }

  // show initial tip message
  setTimeout(()=> {
    pushMessage(lang==='en' ? `Hello — tap Product Assistant for voice or Ask Me to type a question about ${product.title}.` : `હેલો — અવાજ માટે Product Assistant દબાવો અથવા ${product.title} વિશે પૂછવા માટે લખો.`);
  }, 400);

}); // DOMContentLoaded end
