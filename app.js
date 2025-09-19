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
  const logoCandidates = ['assets/ktpl-new-logo.png','assets/ktpl-new-logo.jpg','assets/ktpl-new-logo.webp','assets/ktpl-new-logo.jpeg','assets/ktpl new logo.png'];
  const mainLogo = document.getElementById('mainLogo');
  tryLoadVariants(logoCandidates, mainLogo, true);
  setTimeout(()=>{ if(!mainLogo.src){ mainLogo.style.display='none'; document.getElementById('logoFallback').style.display='flex' } }, 1400);

  // fetch products.json
  let PRODUCTS = {};
  try {
    const res = await fetch('products.json');
    PRODUCTS = await res.json();
  } catch (e) {
    console.error('Could not load products.json', e);
    PRODUCTS = {};
  }

  // choose product id from URL ?product=
  const params = new URLSearchParams(location.search);
  const productId = (params.get('product') || Object.keys(PRODUCTS)[0] || '').toLowerCase();
  const product = PRODUCTS[productId] || PRODUCTS[Object.keys(PRODUCTS)[0]];

  if(!product){
    document.getElementById('prodTitle').textContent = 'Product not found';
    return;
  }

  // populate DOM
  document.getElementById('prodTitle').textContent = product.title;
  document.getElementById('prodSize').innerHTML = `${product.sizeText} • <span class="price-badge" id="priceBadge">₹${product.price.toLocaleString('en-IN')}</span>`;

  // build gallery
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
  product.images.forEach(n=>{
    const img = document.createElement('img'); img.alt = product.title; img.loading='lazy';
    slidesEl.appendChild(img);
    tryLoadVariants(makeVariants(n), img);
    galleryList.push(img);
    img.addEventListener('click', ()=> openLightbox(galleryList.indexOf(img)));
  });

  // slider/dots logic
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
  document.getElementById('prevBtn').addEventListener('click', ()=>{ if(!slidesEl.children.length) return; idx = (idx-1+slidesEl.children.length)%slidesEl.children.length; updateSlide(); });
  document.getElementById('nextBtn').addEventListener('click', ()=>{ if(!slidesEl.children.length) return; idx = (idx+1)%slidesEl.children.length; updateSlide(); });

  setTimeout(()=>{ buildDots(); updateSlide(); }, 350);

  // lightbox (same as before, simplified)
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

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', showPrev);
  lbNext.addEventListener('click', showNext);
  lb.addEventListener('click', (e)=> { if(e.target === lb || e.target === lbImg) closeLightbox(); });

  // CHAT assistant minimal prompts (extendable)
  const PROMPTS = [
    { q:/(\bprice\b|\bcost\b|₹|rupee|દામ|કિંમત|કિંમતો)/i, en:`The ${product.title} is priced at ₹${product.price.toLocaleString('en-IN')} in our showroom (approx). EMI & exchange options available in store.`, gu:`આ ${product.title} નો અંદાજિત ભાવ ₹${product.price.toLocaleString('en-IN')} છે. EMI અને એક્સચેન્જ સ્ટોર પર ઉપલબ્ધ છે.` },
    { q:/(\bdimension|dimensions|size|height|width|depth|માપ|ઊંચાઈ|પહોળાઈ|ઊંડાઈ)/i, en:'Typical dimensions (with stand): W 83.8 cm × H 60.4 cm × D 18.45 cm.', gu:'સ્ટૅન્ડ સાથે માપ આશરે: પહોળાઈ 83.8 સેમી × ઊંચાઈ 60.4 સેમી × ઊંડાઈ 18.45 સેમી.' },
    { q:/.*/, en:'Sorry — please ask about price, dimensions, features, display, ports, power or warranty.', gu:'માફ કરો — કૃપા કરીને કિંમત, માપ, લક્ષણો, ડિસ્પ્લે અથવા વોરંટી વિશે પૂછો.' }
  ];
  function findAnswer(text, lang='en'){
    for(const p of PROMPTS) if(p.q.test(text)) return (lang === 'en' ? p.en : p.gu);
    return (lang === 'en' ? PROMPTS[PROMPTS.length-1].en : PROMPTS[PROMPTS.length-1].gu);
  }

  // language selection + persistence
  const langSelect = document.getElementById('langSelect');
  let lang = localStorage.getItem('ktpl_lang') || 'en';
  langSelect.value = lang;
  langSelect.addEventListener('change', ()=> { lang = langSelect.value || 'en'; localStorage.setItem('ktpl_lang', lang); document.getElementById('panelSub').textContent = (lang==='en'?'Tap mic or type your question':'માઇક દબાવો અથવા લખો'); });

  // panel open/close + messaging
  const panel = document.getElementById('panel');
  const messagesEl = document.getElementById('messages');
  const inputBox = document.getElementById('inputBox');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');
  function openPanel(){ panel.style.display='flex'; panel.setAttribute('aria-hidden','false'); setTimeout(()=> { inputBox.focus(); messagesEl.scrollTop = messagesEl.scrollHeight; }, 120); }
  function closePanel(){ panel.style.display='none'; panel.setAttribute('aria-hidden','true'); deactivateListeningUI(); }
  document.getElementById('closePanel').addEventListener('click', closePanel);
  document.getElementById('askBtn').addEventListener('click', ()=>{ openPanel(); inputBox.focus(); });
  document.getElementById('assistBtn').addEventListener('click', ()=>{ openPanel(); setTimeout(()=> micBtn.click(),220); });

  function pushMessage(text, who='bot'){
    if(!text) return;
    const el = document.createElement('div'); el.className = 'bubble ' + (who==='user' ? 'user' : 'bot'); el.textContent = text;
    messagesEl.appendChild(el); messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  sendBtn.addEventListener('click', function(){
    const v = inputBox.value && inputBox.value.trim();
    if(!v) return;
    inputBox.value = '';
    pushMessage(v,'user');
    const ans = findAnswer(v, lang);
    setTimeout(()=> { pushMessage(ans,'bot'); speak(ans); }, 160);
  });
  inputBox.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); sendBtn.click(); } });

  // SpeechRecognition + TTS
  let recognition = null, listening=false;
  function activateListeningUI(){ document.getElementById('listeningBanner').style.display='flex'; document.getElementById('listeningBanner').classList.add('active'); document.getElementById('listeningText').textContent = (lang==='en'?'Listening...':'સુનાઈ રહ્યું છે...'); document.getElementById('panelSub').textContent = document.getElementById('listeningText').textContent; }
  function deactivateListeningUI(){ document.getElementById('listeningBanner').classList.remove('active'); document.getElementById('listeningBanner').style.display='none'; document.getElementById('panelSub').textContent = (lang==='en'?'Tap mic or type your question':'માઇક દબાવો અથવા લખો'); }

  if(window.SpeechRecognition || window.webkitSpeechRecognition){
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = function(){ listening=true; activateListeningUI(); micBtn.textContent='●'; micBtn.style.transform='scale(1.03)'; micBtn.style.boxShadow='0 8px 28px rgba(255,122,90,0.12)'; };
    recognition.onresult = function(e){
      const txt = (e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) || '';
      if(txt){
        pushMessage(txt,'user');
        const ans = findAnswer(txt, lang);
        setTimeout(()=> { pushMessage(ans,'bot'); speak(ans); }, 160);
      }
    };
    recognition.onend = function(){ listening=false; deactivateListeningUI(); micBtn.textContent='🎤'; micBtn.style.transform=''; micBtn.style.boxShadow=''; };
    recognition.onerror = function(){ listening=false; deactivateListeningUI(); micBtn.textContent='🎤'; micBtn.style.transform=''; micBtn.style.boxShadow=''; };
  }

  // mic click: speak welcome then start recognition (localized)
  micBtn.addEventListener('click', async function(){
    if(!('speechSynthesis' in window) && !(window.SpeechRecognition || window.webkitSpeechRecognition)){
      alert(lang === 'en' ? 'Speech recognition and TTS not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ અને ટેક્સ્ટ-ટુ-સ્પીચ સપોર્ટ નથી.');
      return;
    }
    const welcomeText = (lang === 'en')
      ? `Welcome to Kalindi Tradelinks Private Limited. How can I help you about the ${product.title}?`
      : `Kalindi Tradelinks પ્રા. લિ. માં આપનું સ્વાગત છે. હું ${product.title} વિશે કેવી રીતે મદદ કરી શકું?`;

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
      try { window.speechSynthesis.speak(utter); } catch(e){ if(window.SpeechRecognition || window.webkitSpeechRecognition){ recognition.start(); } }
    } else {
      if(!recognition){ alert(lang==='en' ? 'Speech recognition not supported in this browser.' : 'આ બ્રાઉઝર માં સ્પીચ રેકોગ્નિશન સપોર્ટ નથી.'); return; }
      try { recognition.lang = (lang === 'en' ? 'en-IN' : 'gu-IN'); recognition.start(); } catch(e){}
    }
  });

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
      setTimeout(()=>{ messagesEl.scrollTop = messagesEl.scrollHeight; },200);
    });
    inputBox.addEventListener('focus', ()=> setTimeout(()=> { panelEl.style.transform=''; messagesEl.scrollTop = messagesEl.scrollHeight; },200));
  }

  // show initial tip message
  setTimeout(()=> pushMessage(lang==='en' ? `Hello — tap Product Assistant for voice or Ask Me to type a question about ${product.title}.` : `હેલો — અવાજ માટે Product Assistant દબાવો અથવા ${product.title} વિશે પૂછવા માટે લખો.`), 400);

});
