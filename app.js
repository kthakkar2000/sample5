000// app.js - complete ready-to-paste
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
  tryLoadVariants(['assets/ktpl-new-logo.png','assets/ktpl-new-logo.jpg','assets/ktpl-new-logo.webp','assets/ktpl new logo.png','ktpl-new-logo.png'], mainLogo, true);
  setTimeout(()=> {
    if (!mainLogo.src) {
      const fb = document.getElementById('logoFallback');
      if (fb) fb.style.display='flex';
    }
  }, 1200);

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
  // console.log('Loaded PRODUCTS:', PRODUCTS);

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
    document.getElementById('prodTitle').textContent = 'Product not found';
    document.getElementById('prodSize').textContent = '';
    return;
  }

  /* ---------- populate basic DOM ---------- */
  document.getElementById('prodTitle').textContent = product.title || 'Unnamed product';
  document.getElementById('prodSize').innerHTML = `${product.sizeText || ''} • <span class="price-badge" id="priceBadge">₹${Number(product.price || 0).toLocaleString('en-IN')}</span>`;

  /* ---------- build gallery ---------- */
  const slidesEl = document.getElementById('slides');
  slidesEl.innerHTML = '';
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
    Array.from(dotsEl.children).forEach((d,i)=> d.classList.toggle('active', i===idx));
  }
  document.getElementById('prevBtn').addEventListener('click', ()=> { if(!slidesEl.children.length) return; idx = (idx-1 + slidesEl.children.length) % slidesEl.children.length; updateSlide(); });
  document.getElementById('nextBtn').addEventListener('click', ()=> { if(!slidesEl.children.length) return; idx = (idx+1) % slidesEl.children.length; updateSlide(); });

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
    lbImg.src = src;
    lb.style.display = 'flex';
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    zoomed = false;
    lbImg.style.transform = 'translate(0,0) scale(1)';
    lbPrev.style.display = gallery.length > 1 ? 'block' : 'none';
    lbNext.style.display = gallery.length > 1 ? 'block' : 'none';
  }
  function closeLightbox(){ lb.style.display = 'none'; lb.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }
  function showPrev(){ if (slidesEl.children.length <= 1) return; lbIndex = (lbIndex-1 + slidesEl.children.length) % slidesEl.children.length; lbImg.src = slidesEl.children[lbIndex].src; zoomed=false; lbImg.style.transform='translate(0,0) scale(1)'; }
  function showNext(){ if (slidesEl.children.length <= 1) return; lbIndex = (lbIndex+1) % slidesEl.children.length; lbImg.src = slidesEl.children[lbIndex].src; zoomed=false; lbImg.style.transform='translate(0,0) scale(1)'; }

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', showPrev);
  lbNext.addEventListener('click', showNext);
  lb.addEventListener('click', (e)=> { if (e.target === lb || e.target === lbImg) closeLightbox(); });
  window.addEventListener('keydown', (e)=> { if (lb.style.display === 'flex') { if (e.key === 'Escape') closeLightbox(); if (e.key === 'ArrowLeft') showPrev(); if (e.key === 'ArrowRight') showNext(); } });

  // double-tap and pinch-to-zoom
  let lastTap = 0;
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
      // parse current translate
      const cur = lbImg.style.transform || 'translate(0,0) scale(1)';
      const m = cur.match(/translate\((-?\d+)px,(-?\d+)px\)/);
      let tx = 0, ty = 0;
      if (m){ tx = parseFloat(m[1]); ty = parseFloat(m[2]); }
      tx += dx; ty += dy;
      lbImg.style.transform = `translate(${tx}px,${ty}px) scale(${zoomed?2:1})`;
      lastX = nx; lastY = ny;
    }
  }, {passive:false});

  lbImg.addEventListener('touchend', function(){ startDist = 0; });
  lbImg.addEventListener('dblclick', ()=> toggleZoom());
  function toggleZoom(){
    if (!zoomed){ lbImg.style.transform='translate(0,0) scale(2)'; zoomed = true; }
    else { lbImg.style.transform='translate(0,0) scale(1)'; zoomed = false; }
  }

  /* ---------- CHAT assistant / PROMPTS ---------- */
  const PROMPTS = [
    { q:/(\bprice\b|\bcost\b|₹|rupee|દામ|કિંમત|કિંમતો)/i,
      en: `The ${product.title} is priced at ₹${Number(product.price || 0).toLocaleString('en-IN')} in our showroom (approx). EMI & exchange options available in store.`,
      gu: `આ ${product.title} નો અંદાજપાત્ર ભાવ ₹${Number(product.price || 0).toLocaleString('en-IN')} છે. EMI અને એક્સચેન્જ વિકલ્પો સ્ટોર પર ઉપલબ્ધ છે.` },

    { q:/(\bdimension|dimensions|size|height|width|depth|માપ|ઊંચાઈ|પહોળાઈ|ઊંડાઈ)/i,
      en: product.dimensions ? `Dimensions: ${product.dimensions}` : 'Typical dimensions (with stand): W 83.8 cm × H 60.4 cm × D 18.45 cm.',
      gu: product.dimensions ? `માપ: ${product.dimensions}` : 'સ્ટૅન્ડ સાથે માપ આશરે: પહોળાઈ 83.8 સેમી × ઊંચાઈ 60.4 સેમી × ઊંડાઈ 18.45 સેમી.' },

    { q:/(\bwarranty|guarantee|service|વોરંટી|ગેરંટી)/i,
      en: product.warranty ? `Warranty: ${product.warranty}` : 'Warranty details are not available.',
      gu: product.warranty ? `વોરંટી: ${product.warranty}` : 'વોરંટીની માહિતી ઉપલબ્ધ નથી.' },

    { q:/(\binstall|installation|setup|fit|ઇન્સ્ટોલ|સ્થાપન)/i,
      en: product.installation ? `Installation time: ${product.installation}` : 'Installation information is not available.',
      gu: product.installation ? `ઇન્સ્ટોલેશન સમય: ${product.installation}` : 'ઇન્સ્ટોલેશનની માહિતી ઉપલબ્ધ નથી.' },

    { q:/(\bdelivery|deliver|ship|shipping|dispatch|ડિલિવરી|ડિલિવર|મોકલવું|શિપમેન્ટ)/i,
      en: product.delivery ? `Delivery time: ${product.delivery}` : 'Delivery information is not available.',
      gu: product.delivery ? `ડિલિવરી સમય: ${product.delivery}` : 'ડિલિવરીની માહિતી ઉપલબ્ધ નથી.' },

    { q:/(\bfeature|features|spec|specs|વિશેષતા|લક્ષણ|ફીચર)/i,
      en: product.features ? `Features: ${product.features}` : 'Key features: 4K UHD/HDR, Google TV (smart), AiPQ upscaling, Dolby Audio, HDMI ports.',
      gu: product.features ? `લક્ષણો: ${product.features}` : 'મુખ્ય લક્ષણો: 4K UHD/HDR, Google TV, AiPQ અપસ્કેલિંગ, Dolby Audio, HDMI પોર્ટ્સ.' },

    { q:/(\bport|ports|hdmi|usb|ethernet|audio|પોર્ટ)/i,
      en: product.ports ? `Ports: ${product.ports}` : 'Includes multiple HDMI ports, USB, audio out and Ethernet (exact count varies by model).',
      gu: product.ports ? `પોર્ટ્સ: ${product.ports}` : 'ઘણા HDMI પોર્ટ, USB, ઓડિયો અને Ethernet — ચોક્કસ સંખ્યા મોડેલ માટે બદલાય છે.' },

    { q:/(\bdescription|detail|describe|વિગત|વર્ણન|description)/i,
      en: (product.description && product.description.en) ? product.description.en : 'Description not available.',
      gu: (product.description && product.description.gu) ? product.description.gu : 'વર્ણન ઉપલબ્ધ નથી.' },

    { q:/(\badvantage|why buy|compare|benefit|ફાયદો|પ્રોડક્ટના ફાયદા)/i,
      en: 'Advantages: great value, vivid 4K HDR colors, AiPQ upscaling and Google TV for apps & casting.',
      gu: 'લાભ: કિંમતના ભાગે ઉત્તમ, ઝવાળતા 4K HDR રંગો, AiPQ અપસ્કેલ અને Google TV માટે એપ્સ અને કાસ્ટિંગ.' },

    { q:/(\bpower|watt|consumption|energy|વોટ|વીજ)/i,
      en: 'Typical power usage ~70–110W while operating; standby <0.5W. Exact numbers depend on settings.',
      gu: 'સામાન્ય વીજ-upbhog ~70–110W; સ્ટેન્ડબાય <0.5W. ચોક્કસ સંખ્યાઓ સેટિંગ્સ પર નિર્ભર છે.' },

    { q:/(\breview|reviews|rating|customer feedback|પ્રતિસાદ|સમીક્ષા)/i,
      en: 'Common feedback: strong picture quality for the price, reliable Google TV experience. Peak brightness moderate in very bright rooms.',
      gu: 'ગ્રાહકો કહે છે: કિંમત માટે સારી તસવીર ગુણવત્તા અને વિશ્વસનીય Google TV અનુભવ; ખૂબ તેજ રૂમમાં પીક બ્રાઇટનેસ સામાન્ય.' },

    // default fallback
    { q:/.*/i,
      en: 'Sorry — please ask about price, dimensions, warranty, description, installation, ports or features.',
      gu: 'માફ કરો — કૃપા કરીને કિંમત, માપ, વોરંટી, વર્ણન, ઇન્સ્ટોલેશન, પોર્ટ્સ અથવા લક્ષણો વિશે પૂછો.' }
  ];

  function findAnswer(text, lang='en'){
    for (const p of PROMPTS) if (p.q.test(text)) return (lang === 'en' ? p.en : p.gu);
    return (lang === 'en' ? PROMPTS[PROMPTS.length-1].en : PROMPTS[PROMPTS.length-1].gu);
  }

  /* ---------- language selection ---------- */
  const langSelect = document.getElementById('langSelect');
  let lang = localStorage.getItem('ktpl_lang') || 'en';
  if (langSelect) {
    langSelect.value = lang;
    langSelect.addEventListener('change', ()=> {
      lang = langSelect.value || 'en';
      localStorage.setItem('ktpl_lang', lang);
      document.getElementById('panelSub').textContent = (lang === 'en' ? 'Tap mic or type your question' : 'માઇક દબાવો અથવા લખો');
    });
  }

  /* ---------- panel / messages / composer ---------- */
  const panel = document.getElementById('panel');
  const messagesEl = document.getElementById('messages');
  const inputBox = document.getElementById('inputBox');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');

  function openPanel(){ panel.style.display = 'flex'; panel.setAttribute('aria-hidden','false'); setTimeout(()=> { inputBox.focus(); messagesEl.scrollTop = messagesEl.scrollHeight; }, 120); }
  function closePanel(){ panel.style.display = 'none'; panel.setAttribute('aria-hidden','true'); deactivateListeningUI(); }
  document.getElementById('closePanel').addEventListener('click', closePanel);
  document.getElementById('askBtn').addEventListener('click', ()=> { openPanel(); inputBox.focus(); });
  document.getElementById('assistBtn').addEventListener('click', ()=> { openPanel(); setTimeout(()=> micBtn.click(), 220); });

  function pushMessage(text, who='bot'){
    if (!text) return;
    const el = document.createElement('div');
    el.className = 'bubble ' + (who === 'user' ? 'user' : 'bot');
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  sendBtn.addEventListener('click', function(){
    const v = inputBox.value && inputBox.value.trim();
    if (!v) return;
    inputBox.value = '';
    pushMessage(v, 'user');
    const ans = findAnswer(v, lang);
    setTimeout(()=> { pushMessage(ans, 'bot'); speak(ans); }, 160);
  });
  inputBox.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); } });

  /* ---------- speech recognition & TTS ---------- */
  let recognition = null, listening = false;

  function activateListeningUI(){ document.getElementById('listeningBanner').style.display = 'flex'; document.getElementById('listeningBanner').classList.add('active'); document.getElementById('listeningText').textContent = (lang === 'en' ? 'Listening...' : 'સુનાઈ રહ્યું છે...'); document.getElementById('panelSub').textContent = document.getElementById('listeningText').textContent; }
  function deactivateListeningUI(){ document.getElementById('listeningBanner').classList.remove('active'); document.getElementById('listeningBanner').style.display = 'none'; document.getElementById('panelSub').textContent = (lang === 'en' ? 'Tap mic or type your question' : 'માઇક દબાવો અથવા લખો'); }

  if (window.SpeechRecognition || window.webkitSpeechRecognition){
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = function(){ listening = true; activateListeningUI(); micBtn.textContent='●'; micBtn.style.transform='scale(1.03)'; micBtn.style.boxShadow='0 8px 28px rgba(255,122,90,0.12)'; };
    recognition.onresult = function(e){
      const txt = (e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) || '';
      if (txt) {
        pushMessage(txt, 'user');
        const ans = findAnswer(txt, lang);
        setTimeout(()=> { pushMessage(ans, 'bot'); speak(ans); }, 160);
      }
    };
    recognition.onend = function(){ listening = false; deactivateListeningUI(); micBtn.textContent='🎤'; micBtn.style.transform=''; micBtn.style.boxShadow=''; };
    recognition.onerror = function(){ listening = false; deactivateListeningUI(); micBtn.textContent='🎤'; micBtn.style.transform=''; micBtn.style.boxShadow=''; };
  }

  // mic click: speak welcome then start recognition
  micBtn.addEventListener('click', async function(){
    if (!('speechSynthesis' in window) && !(window.SpeechRecognition || window.webkitSpeechRecognition)){
      alert(lang === 'en' ? 'Speech recognition and TTS not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ અને ટેક્સ્ટ-ટુ-સ્પીચ સપોર્ટ નથી.');
      return;
    }

    const welcomeText = (lang === 'en')
      ? `Welcome to Kalindi Tradelinks Private Limited. How can I help you about the ${product.title}?`
      : `કાલિન્દી ટ્રેડલિંક્સ પ્રાયવેટ લિમિટેડમાં આપનું સ્વાગત છે. હું ${product.title} વિશે કેવી રીતે મદદ કરી શકું?`;

    if ('speechSynthesis' in window){
      try { window.speechSynthesis.cancel(); } catch(e){}
      const utter = new SpeechSynthesisUtterance(welcomeText);
      utter.lang = (lang === 'en' ? 'en-IN' : 'gu-IN');
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length){
          const pref = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'gu'));
          if (pref) utter.voice = pref;
        }
      } catch(e){ }
      utter.onstart = function(){ openPanel(); activateListeningUI(); };
      utter.onend = function(){
        if (window.SpeechRecognition || window.webkitSpeechRecognition){
          try { recognition.lang = (lang === 'en' ? 'en-IN' : 'gu-IN'); recognition.start(); } catch(e) {}
        } else {
          pushMessage(lang === 'en' ? 'Speech recognition not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ રેકોગ્નિશન સપોર્ટ નથી.', 'bot');
        }
      };
      try { window.speechSynthesis.speak(utter); } catch(e){ if (window.SpeechRecognition || window.webkitSpeechRecognition) { recognition.start(); } }
    } else {
      if (!recognition){ alert(lang === 'en' ? 'Speech recognition not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ રેકોગ્નિશન સપોર્ટ નથી.'); return; }
      try { recognition.lang = (lang === 'en' ? 'en-IN' : 'gu-IN'); recognition.start(); } catch(e){}
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
      } catch(e){}
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch(e){}
  }

  /* ---------- keyboard / mobile composer handling ---------- */
  const panelEl = document.getElementById('panel');
  if (window.visualViewport){
    let lastH = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', ()=> {
      const vh = window.visualViewport.height;
      const dh = window.innerHeight - vh;
      if (vh < lastH - 50) panelEl.style.transform = `translateY(-${dh}px)`;
      else panelEl.style.transform = '';
      lastH = vh;
      setTimeout(()=> { messagesEl.scrollTop = messagesEl.scrollHeight; }, 200);
    });
    inputBox.addEventListener('focus', ()=> setTimeout(()=> { panelEl.style.transform=''; messagesEl.scrollTop = messagesEl.scrollHeight; }, 200));
  } else {
    let lastInner = window.innerHeight;
    window.addEventListener('resize', ()=> {
      const now = window.innerHeight;
      if (now < lastInner - 80) panelEl.style.transform = 'translateY(-160px)';
      else panelEl.style.transform = '';
      lastInner = now;
    });
  }

  /* ---------- initial tip message ---------- */
  setTimeout(()=> pushMessage(lang === 'en' ? `Hello — tap Product Assistant for voice or Ask Me to type a question about ${product.title}.` : `હેલો — અવાજ માટે Product Assistant દબાવો અથવા ${product.title} વિશે પૂછવા માટે લખો.`), 400);

}); // DOMContentLoaded end
