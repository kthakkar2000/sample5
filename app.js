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

  // --- fetch and normalize products.json ---
  let rawProducts = [];
  try {
    const res = await fetch('products.json', {cache: "no-store"});
    rawProducts = await res.json();
  } catch (e) {
    console.error('Could not load products.json', e);
    rawProducts = [];
  }

  // normalize to object keyed by id (case-insensitive)
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
        sizeText: p.size || '',
        images: p.images || [],
        langs: p.langs || {}
      };
    });
  }

  // --- get productId from URL ---
  const params = new URLSearchParams(location.search);
  const productParam = (params.get('product') || params.get('id') || '').toLowerCase();

  let product = productParam && PRODUCTS[productParam] ? PRODUCTS[productParam] : null;
  if (!product) {
    const firstKey = Object.keys(PRODUCTS)[0];
    product = firstKey ? PRODUCTS[firstKey] : null;
  }

  if(!product){
    document.getElementById('prodTitle').textContent = 'Product not found';
    document.getElementById('prodSize').textContent = '';
    return;
  }

  // --- populate DOM ---
  document.getElementById('prodTitle').textContent = product.title;
  document.getElementById('prodSize').innerHTML = `${product.sizeText} • <span class="price-badge" id="priceBadge">₹${product.price.toLocaleString('en-IN')}</span>`;

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
  product.images.forEach(n=>{
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
  document.getElementById('prevBtn').addEventListener('click', ()=>{ if(!slidesEl.children.length) return; idx = (idx-1+slidesEl.children.length)%slidesEl.children.length; updateSlide(); });
  document.getElementById('nextBtn').addEventListener('click', ()=>{ if(!slidesEl.children.length) return; idx = (idx+1)%slidesEl.children.length; updateSlide(); });

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

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', showPrev);
  lbNext.addEventListener('click', showNext);
  lb.addEventListener('click', (e)=> { if(e.target === lb || e.target === lbImg) closeLightbox(); });

  // --- CHAT assistant minimal prompts ---
  const PROMPTS = [
    { q:/(\bprice\b|\bcost\b|₹|rupee|દામ|કિંમત|કિંમતો)/i, en:`The ${product.title} is priced at ₹${product.price.toLocaleString('en-IN')} in our showroom (approx). EMI & exchange options available in store.`, gu:`આ ${product.title} નો અંદાજિત ભાવ ₹${product.price.toLocaleString('en-IN')} છે. EMI અને એક્સચેન્જ સ્ટોર પર ઉપલબ્ધ છે.` },
    { q:/(\bdimension|dimensions|size|height|width|depth|માપ|ઊંચાઈ|પહોળાઈ|ઊંડાઈ)/i, en:'Typical dimensions (with stand): W 83.8 cm × H 60.4 cm × D 18.45 cm.', gu:'સ્ટૅન્ડ સાથે માપ આશરે: પહોળાઈ 83.8 સેમી × ઊંચાઈ 60.4 સેમી × ઊંડાઈ 18.45 સેમી.' },
    { q:/.*/, en:'Sorry — please ask about price, dimensions, features, display, ports, power or warranty.', gu:'માફ કરો — કૃપા કરીને કિંમત, માપ, લક્ષણો, ડિસ્પ્લે અથવા વોરંટી વિશે પૂછો.' }
  ];
  function findAnswer(text, lang='en'){
    for(const p of PROMPTS) if(p.q.test(text)) return (lang === 'en' ? p.en : p.gu);
    return (lang === 'en' ? PROMPTS[PROMPTS.length-1].en : PROMPTS[PROMPTS.length-1].gu);
  }

  // --- language selection ---
  const langSelect = document.getElementById('langSelect');
  let lang = localStorage.getItem('ktpl_lang') || 'en';
  langSelect.value = lang;
  langSelect.addEventListener('change', ()=> { lang = langSelect.value || 'en'; localStorage.setItem('ktpl_lang', lang); document.getElementById('panelSub').textContent = (lang==='en'?'Tap mic or type your question':'માઇક દબાવો અથવા લખો'); });

  // (rest of your chat + mic + speak code stays unchanged)
});
