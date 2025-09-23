// app.js - loads products.json, reads ?product=, populates UI, handles gallery + chat + TTS/STT
document.addEventListener('DOMContentLoaded', async () => {

  // helpers to load images with variants
  const exts = ['.avif','.webp','.jpg','.jpeg','.png'];
  function tryLoadVariants(candidates, imgEl, hideIfFail=true){
    let i=0, queue=[];
    candidates.forEach(b=>{
      if(/\.[a-zA-Z]{2,4}$/.test(b)) queue.push(b);
      else exts.forEach(e=>queue.push(b+e));
    });
    function next(){
      if(i>=queue.length){ if(hideIfFail) imgEl.style.display='none'; return; }
      const s = queue[i++];
      const t = new Image();
      t.onload = ()=> { imgEl.src = s; imgEl.style.display='block'; };
      t.onerror = next;
      t.src = s;
    }
    next();
  }

  // load logo
  const logoCandidates = ['assets/ktpl new logo.png','assets/ktpl new logo.jpg','assets/ktpl new logo.webp','assets/ktpl new logo.jpeg','assets/ktpl new logo.png','assets/ktpl new logo.jpg'];
  const mainLogo = document.getElementById('mainLogo');
  tryLoadVariants(logoCandidates, mainLogo, true);
  setTimeout(()=>{ if(!mainLogo.src){ mainLogo.style.display='none'; const fb = document.getElementById('logoFallback'); if(fb) fb.style.display='flex' } }, 1400);

  // --- fetch and normalize products.json (works for array or object) ---
  let rawProducts = [];
  try {
    const res = await fetch('products.json', {cache: "no-store"});
    rawProducts = await res.json();
  } catch (e) {
    console.error('Could not load products.json', e);
    rawProducts = [];
  }

  // normalize to object keyed by id (lowercase)
  const PRODUCTS = {};
  if (Array.isArray(rawProducts)) {
    rawProducts.forEach(p => {
      if (!p || !p.id) return;
      const key = String(p.id).toLowerCase();
      let price = p.price;
      if (typeof price === 'string') {
        const digits = price.replace(/[^\d]/g,'');
        if (digits) price = Number(digits);
      }
      PRODUCTS[key] = {
        id: p.id,
        brand: p.brand || '',
        title: p.title || p.id,
        price: price || 0,
        sizeText: p.size || (p.sizeText || ''),
        images: p.images || [],
        lang: p.lang || p.langs || {}
      };
    });
  } else if (rawProducts && typeof rawProducts === 'object') {
    // object already - copy keys lowercased
    Object.keys(rawProducts).forEach(k => {
      const p = rawProducts[k];
      const key = String(k).toLowerCase();
      let price = p.price;
      if (typeof price === 'string') {
        const digits = price.replace(/[^\d]/g,'');
        if (digits) price = Number(digits);
      }
      PRODUCTS[key] = {
        id: p.id || k,
        brand: p.brand || '',
        title: p.title || p.id || k,
        price: price || 0,
        sizeText: p.size || (p.sizeText || ''),
        images: p.images || [],
        lang: p.lang || p.langs || {}
      };
    });
  } else {
    console.warn('products.json is empty or invalid');
  }

  // --- get productId from URL (support ?product= or ?id=) ---
  const params = new URLSearchParams(location.search);
  const productParam = (params.get('product') || params.get('id') || '').toLowerCase();

  let product = productParam && PRODUCTS[productParam] ? PRODUCTS[productParam] : null;
  if (!product) {
    const firstKey = Object.keys(PRODUCTS)[0];
    product = firstKey ? PRODUCTS[firstKey] : null;
  }

  if(!product){
    const t = document.getElementById('prodTitle');
    if(t) t.textContent = 'Product not found';
    const s = document.getElementById('prodSize');
    if(s) s.textContent = '';
    return;
  }

  // --- populate DOM ---
  document.getElementById('prodTitle').textContent = product.title;
  document.getElementById('prodSize').innerHTML = `${product.sizeText || ''} • <span class="price-badge" id="priceBadge">₹${Number(product.price || 0).toLocaleString('en-IN')}</span>`;

  // --- build gallery ---
  const slidesEl = document.getElementById('slides');
  slidesEl.innerHTML = '';
  const galleryList = [];
  function makeVariants(name){
    const ext = name.match(/\.[^/.]+$/) ? name.match(/\.[^/.]+$/)[0] : '';
    const base = name.replace(/\.[^/.]+$/,'');
    return [
      'assets/' + name,
      'assets/' + base.replace(/\s+/g,'') + ext,
      'assets/' + base.replace(/\s+/g,'-') + ext,
      'assets/' + base.replace(/\s+/g,'_') + ext,
      'assets/' + base
    ];
  }
  (product.images || []).forEach(n=>{
    const img = document.createElement('img'); img.alt = product.title; img.loading='lazy';
    slidesEl.appendChild(img);
    tryLoadVariants(makeVariants(n), img);
    galleryList.push(img);
    img.addEventListener('click', ()=> openLightbox(galleryList.indexOf(img)));
  });

  // --- slider/dots logic ---
  const dotsEl = document.getElementById('dots');
  function buildDots(){
    dotsEl.innerHTML='';
    for(let i=0;i<slidesEl.children.length;i++){
      const d = document.createElement('div'); d.className='dot'+(i===0?' active':''); d.style.cursor='pointer';
      d.addEventListener('click', ()=>{ idx = i; updateSlide(); });
      dotsEl.appendChild(d);
    }
  }
  let idx = 0;
  function updateSlide(){ if(!slidesEl.children.length) return; slidesEl.style.transform = `translateX(${-idx*100}%)`; Array.from(dotsEl.children).forEach((d,i)=> d.classList.toggle('active', i===idx)); }
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if(prevBtn) prevBtn.addEventListener('click', ()=>{ if(!slidesEl.children.length) return; idx = (idx-1+slidesEl.children.length)%slidesEl.children.length; updateSlide(); });
  if(nextBtn) nextBtn.addEventListener('click', ()=>{ if(!slidesEl.children.length) return; idx = (idx+1)%slidesEl.children.length; updateSlide(); });

  setTimeout(()=>{ buildDots(); updateSlide(); }, 350);

  // --- lightbox ---
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbClose = document.getElementById('lb-close');
  const lbPrev = document.getElementById('lb-prev');
  const lbNext = document.getElementById('lb-next');
  let lbIndex = 0;
  function openLightbox(i){
    lbIndex = i;
    const imgEl = slidesEl.children[lbIndex];
    if(!imgEl) return;
    lbImg.src = imgEl.src || '';
    lb.style.display='flex'; lb.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
  }
  function closeLightbox(){ lb.style.display='none'; lb.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  function showPrev(){ if(slidesEl.children.length<=1) return; lbIndex = (lbIndex-1 + slidesEl.children.length) % slidesEl.children.length; lbImg.src = slidesEl.children[lbIndex].src; }
  function showNext(){ if(slidesEl.children.length<=1) return; lbIndex = (lbIndex+1) % slidesEl.children.length; lbImg.src = slidesEl.children[lbIndex].src; }

  if(lbClose) lbClose.addEventListener('click', closeLightbox);
  if(lbPrev) lbPrev.addEventListener('click', showPrev);
  if(lbNext) lbNext.addEventListener('click', showNext);
  if(lb) lb.addEventListener('click', (e)=> { if(e.target === lb || e.target === lbImg) closeLightbox(); });

  // --- CHAT assistant minimal prompts ---
  // --- CHAT assistant prompts (replace your old PROMPTS array with this) ---
// --- CHAT assistant prompts (replace your old PROMPTS array with this) ---
const PROMPTS = [
  {
    // price
    q: /(\bprice\b|\bcost\b|₹|rupee|દામ|કિંમત|કિંમતો)/i,
    en: `The ${product.title} is priced at ₹${Number(product.price || 0).toLocaleString('en-IN')} in our showroom (approx). EMI & exchange options available in store.`,
    gu: `આ ${product.title} નો અંદાજિત ભાવ ₹${Number(product.price || 0).toLocaleString('en-IN')} છે. EMI અને એક્સચેન્જ સ્ટોર પર ઉપલબ્ધ છે.`
  },

  {
    // dimensions / size
    q: /(\bdimension|dimensions|size|height|width|depth|માપ|ઊંચાઈ|પહોળાઈ|ઊંડાઈ)/i,
    en: product.sizeText ? `Size: ${product.sizeText}.` : 'Dimensions information is not available.',
    gu: product.sizeText ? `સાઇઝ: ${product.sizeText}.` : 'માપની માહિતી ઉપલબ્ધ નથી.'
  },

  {
    // warranty
    q: /(\bwarranty|guarantee|service|વોરંટી|સરવિસ|ગેરન્ટી)/i,
    en: product.warranty ? `Warranty: ${product.warranty}` : 'Warranty details are not available.',
    gu: product.warranty ? `વોરંટી: ${product.warranty}` : 'વોરંટી માહિતી ઉપલબ્ધ નથી.'
  },

  {
    // description (supports en / gu)
    q: /(\bdescription\b|detail|about|વિવરણ|વર્ણન|ડિટેઇલ)/i,
    en: (product.description && product.description.en) ? product.description.en : 'Description not available.',
    gu: (product.description && product.description.gu) ? product.description.gu : 'વર્ણન ઉપલબ્ધ નથી.'
  },

  {
    // installation / setup / fit
    q: /(\binstall|installation|setup|fit|ઇન્સ્ટોલ|સ્થાપન|સેટઅપ)/i,
    en: product.installation ? `Installation: ${product.installation}` : 'Installation info not available.',
    gu: product.installation ? `ઇન્સ્ટોલેશન: ${product.installation}` : 'ઇન્સ્ટોલેશનની માહિતી ઉપલબ્ધ નથી.'
  },

  {
    // fallback catch-all
    q: /.*/,
    en: 'Sorry — please ask about price, dimensions, warranty, description, installation, or ports.',
    gu: 'માફ કરો — કૃપા કરીને કિંમત, માપ, વોરંટી, વર્ણન, ઇન્સ્ટોલેશન અથવા પોર્ટ્સ વિશે પૂછો.'
  }
];


  function findAnswer(text, lang='en'){
    for(const p of PROMPTS) if(p.q.test(text)) return (lang === 'en' ? p.en : p.gu);
    return (lang === 'en' ? PROMPTS[PROMPTS.length-1].en : PROMPTS[PROMPTS.length-1].gu);
  }

  // --- language selection ---
  const langSelect = document.getElementById('langSelect');
  let lang = localStorage.getItem('ktpl_lang') || 'en';
  if(langSelect) langSelect.value = lang;
  if(langSelect) langSelect.addEventListener('change', ()=> { lang = langSelect.value || 'en'; localStorage.setItem('ktpl_lang', lang); const ps = document.getElementById('panelSub'); if(ps) ps.textContent = (lang==='en'?'Tap mic or type your question':'માઇક દબાવો અથવા લખો'); });

  // panel open/close + messaging
  const panel = document.getElementById('panel');
  const messagesEl = document.getElementById('messages');
  const inputBox = document.getElementById('inputBox');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');

  function openPanel(){ if(panel){ panel.style.display='flex'; panel.setAttribute('aria-hidden','false'); setTimeout(()=> { if(inputBox) inputBox.focus(); if(messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight; }, 120); } }
  function closePanel(){ if(panel){ panel.style.display='none'; panel.setAttribute('aria-hidden','true'); deactivateListeningUI(); } }
  const closePanelBtn = document.getElementById('closePanel');
  if(closePanelBtn) closePanelBtn.addEventListener('click', closePanel);
  const askBtn = document.getElementById('askBtn');
  const assistBtn = document.getElementById('assistBtn');
  if(askBtn) askBtn.addEventListener('click', ()=>{ openPanel(); if(inputBox) inputBox.focus(); });
  if(assistBtn) assistBtn.addEventListener('click', ()=>{ openPanel(); setTimeout(()=> { if(micBtn) micBtn.click(); },220); });

  function pushMessage(text, who='bot'){
    if(!text) return;
    if(!messagesEl) return;
    const el = document.createElement('div'); el.className = 'bubble ' + (who==='user' ? 'user' : 'bot'); el.textContent = text;
    messagesEl.appendChild(el); messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  if(sendBtn){
    sendBtn.addEventListener('click', function(){
      const v = inputBox && inputBox.value && inputBox.value.trim();
      if(!v) return;
      if(inputBox) inputBox.value = '';
      pushMessage(v,'user');
      const ans = findAnswer(v, lang);
      setTimeout(()=> { pushMessage(ans,'bot'); speak(ans); }, 160);
    });
  }
  if(inputBox){
    inputBox.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); if(sendBtn) sendBtn.click(); } });
  }

  // SpeechRecognition + TTS
  let recognition = null, listening=false;
  function activateListeningUI(){ const lbanner = document.getElementById('listeningBanner'); if(lbanner){ lbanner.style.display='flex'; lbanner.classList.add('active'); } const ltxt = document.getElementById('listeningText'); if(ltxt) ltxt.textContent = (lang==='en'?'Listening...':'સુનાઈ રહ્યું છે...'); const ps = document.getElementById('panelSub'); if(ps) ps.textContent = (ltxt && ltxt.textContent) || (lang==='en'?'Listening...':'સુનાઈ રહ્યું છે...'); }
  function deactivateListeningUI(){ const lbanner = document.getElementById('listeningBanner'); if(lbanner){ lbanner.classList.remove('active'); lbanner.style.display='none'; } const ps = document.getElementById('panelSub'); if(ps) ps.textContent = (lang==='en'?'Tap mic or type your question':'માઇક દબાવો અથવા لکھો'); }

  if(window.SpeechRecognition || window.webkitSpeechRecognition){
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = function(){ listening=true; activateListeningUI(); if(micBtn) { micBtn.textContent='●'; micBtn.style.transform='scale(1.03)'; micBtn.style.boxShadow='0 8px 28px rgba(255,122,90,0.12)'; } };
    recognition.onresult = function(e){
      const txt = (e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) || '';
      if(txt){
        pushMessage(txt,'user');
        const ans = findAnswer(txt, lang);
        setTimeout(()=> { pushMessage(ans,'bot'); speak(ans); }, 160);
      }
    };
    recognition.onend = function(){ listening=false; deactivateListeningUI(); if(micBtn){ micBtn.textContent='🎤'; micBtn.style.transform=''; micBtn.style.boxShadow=''; } };
    recognition.onerror = function(){ listening=false; deactivateListeningUI(); if(micBtn){ micBtn.textContent='🎤'; micBtn.style.transform=''; micBtn.style.boxShadow=''; } };
  }

  // mic click: speak welcome then start recognition (localized)
  if(micBtn){
    micBtn.addEventListener('click', async function(){
      if(!('speechSynthesis' in window) && !(window.SpeechRecognition || window.webkitSpeechRecognition)){
        alert(lang === 'en' ? 'Speech recognition and TTS not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ અને ટેક્સ્ટ-ટુ-સ્પીચ સપોર્ટ નથી.');
        return;
      }
      const welcomeText = (lang === 'en')
        ? `Welcome to Kalindi Tradelinks Private Limited. How can I help you about the ${product.title}?`
        : `કાલિંદી ટ્રેડલિન્ક્સ પ્રાઇવેટ લિમિટેડ માં આપનું સ્વાગત છે. હું ${product.title} વિશે કેવી રીતે મદદ કરી શકું?`;

      if('speechSynthesis' in window){
        try { window.speechSynthesis.cancel(); } catch(e){}
        const utter = new SpeechSynthesisUtterance(welcomeText);
        utter.lang = (lang === 'en' ? 'en-IN' : 'gu-IN');
        try {
          const voices = window.speechSynthesis.getVoices();
          if(voices && voices.length){
            const pref = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'gu'));
            if(pref) utter.voice = pref;
          }
        } catch(e){}
        utter.onstart = function(){ openPanel(); activateListeningUI(); };
        utter.onend = function(){
          if(window.SpeechRecognition || window.webkitSpeechRecognition){
            try { recognition.lang = (lang === 'en' ? 'en-IN' : 'gu-IN'); recognition.start(); } catch(e) {}
          } else {
            pushMessage(lang==='en' ? 'Speech recognition not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ રેકોગ્નિશન સપોર્ટ નથી.', 'bot');
          }
        };
        try { window.speechSynthesis.speak(utter); } catch(e){ if(window.SpeechRecognition || window.webkitSpeechRecognition){ try{ recognition.start(); }catch(e){} } }
      } else {
        if(!recognition){ alert(lang==='en' ? 'Speech recognition not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ રેકોગ્નિશન સપોર્ટ નથી.'); return; }
        try { recognition.lang = (lang === 'en' ? 'en-IN' : 'gu-IN'); recognition.start(); } catch(e){}
      }
    });
  }

  // speak function
  function speak(text){
    if(!('speechSynthesis' in window)) return;
    try{
      const u = new SpeechSynthesisUtterance(text);
      u.lang = (lang === 'en' ? 'en-IN' : 'gu-IN');
      try {
        const voices = speechSynthesis.getVoices();
        if(voices && voices.length){
          const pref = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'gu'));
          if(pref) u.voice = pref;
        }
      } catch(e){}
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }catch(e){}
  }

  // keyboard handling for mobile (keep composer visible)
  const panelEl = document.getElementById('panel');
  if(window.visualViewport){
    let lastH = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', ()=> {
      const vh = window.visualViewport.height;
      const dh = window.innerHeight - vh;
      if(vh < lastH - 50) panelEl.style.transform = `translateY(-${dh}px)`;
      else panelEl.style.transform = '';
      lastH = vh;
      setTimeout(()=>{ if(messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight; },200);
    });
    if(inputBox) inputBox.addEventListener('focus', ()=> setTimeout(()=> { panelEl.style.transform=''; if(messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight; },200));
  }

  // show initial tip message
  setTimeout(()=> pushMessage(lang==='en' ? `Hello — tap Product Assistant for voice or Ask Me to type a question about ${product.title}.` : `હેલો — અવાજ માટે Product Assistant દબાવો અથવા ${product.title} વિશે પ્રશ્ન પૂછવા માટે લખો.`), 400);

});
