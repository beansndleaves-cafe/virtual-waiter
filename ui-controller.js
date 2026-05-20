// ui-controller.js - UI Orchestration & Admin Canvas Studio
let currentSlide = 0, slideInterval = null, isFullMenuView = false, currentActiveCategory = "all", uploadMode = 'file', globalActiveSourceImage = null;
const slideshowItems = [];

// Automated Safe Token Hydration Strategy
(function hydrateDecodedCredentialsStore() {
    if (typeof BEANS_STATIC_GROQ !== 'undefined' && BEANS_STATIC_GROQ && BEANS_STATIC_GROQ !== "PASTE_YOUR_BASE64_GROQ_KEY_HERE") {
        localStorage.setItem('beans_token_groq', atob(BEANS_STATIC_GROQ));
    }
    if (typeof BEANS_STATIC_GEMINI !== 'undefined' && BEANS_STATIC_GEMINI && BEANS_STATIC_GEMINI !== "PASTE_YOUR_BASE64_GEMINI_KEY_HERE") {
        localStorage.setItem('beans_token_gemini', atob(BEANS_STATIC_GEMINI));
    }
})();

function startExperience() {
    if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen().catch(() => {}); }
    document.getElementById('start-overlay').classList.add('fade-out');
    setTimeout(() => { document.getElementById('start-overlay').style.display = 'none'; document.getElementById('nav-header').classList.remove('hidden'); }, 400);
    document.getElementById('progress-bar').classList.add('progress-bar-fill');
    slideInterval = setInterval(() => {
        if (isFullMenuView) return;
        document.getElementById(`slide-${currentSlide}`)?.classList.remove('active');
        currentSlide = (currentSlide + 1) % slideshowItems.length;
        document.getElementById(`slide-${currentSlide}`)?.classList.add('active');
    }, 6000);
}

function toggleMenuView() {
    isFullMenuView = !isFullMenuView;
    const menu = document.getElementById('full-menu-view');
    menu.classList.toggle('hidden', !isFullMenuView);
    setTimeout(() => menu.classList.toggle('opacity-0', !isFullMenuView), 10);
    document.getElementById('toggle-icon-grid').classList.toggle('hidden', isFullMenuView);
    document.getElementById('toggle-icon-close').classList.toggle('hidden', !isFullMenuView);
    document.getElementById('toggle-btn-text').innerText = isFullMenuView ? "GO BACK HOME" : "VIEW FULL MENU";
    document.getElementById('progress-bar').classList.toggle('hidden', isFullMenuView);
}

function setupFullMenuUI() {
    let html = `<button onclick="filterCategory('all')" id="tab-all" class="p-3 rounded-xl bg-yellow-500 text-black shadow-md"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z"/></svg></button>`;
    for (const [key, cat] of Object.entries(menuData)) {
        html += `<button onclick="filterCategory('${key}')" id="tab-${key}" class="p-3 rounded-xl border border-white/10 bg-white/5 text-white/60">${cat.icon}</button>`;
        if(slideshowItems.length < 8) slideshowItems.push(...cat.items.slice(0,2));
    }
    document.getElementById('category-tabs').innerHTML = html;
    renderGridItems(); renderSlideshow();
}

function renderGridItems() {
    let combined = [], idx = 0;
    for (const [catKey, cat] of Object.entries(menuData)) {
        if (currentActiveCategory !== 'all' && currentActiveCategory !== catKey) continue;
        cat.items.forEach(item => {
            const uid = `card-${idx++}`;
            const cleanTitle = item.title.replace(/'/g, "\\'");
            const cleanSubtitle = item.subtitle.replace(/'/g, "\\'");
            combined.push(`<div id="${uid}" onclick="handleCardAction('${uid}','${cleanTitle}','${cleanSubtitle}','${item.price}','${item.image}','${cat.name}')" class="menu-card bg-[#131313] border border-white/5 rounded-2xl overflow-hidden p-4 flex flex-col justify-between cursor-pointer"><div class="h-44 relative mb-4 bg-neutral-900 rounded-xl overflow-hidden"><img src="${item.image}" class="w-full h-full object-cover" onerror="this.src=resolveDynamicCulinaryAsset('${cleanTitle}');"></div><div><span class="text-[9px] text-yellow-500 uppercase font-bold">${cat.name}</span><h4 class="text-base font-black text-white uppercase">${item.title}</h4><p class="text-xs text-white/50">${item.subtitle}</p></div><div class="mt-4 bg-white/5 text-center text-xs py-3 rounded-xl font-black text-yellow-500">₹${item.price} - ORDER</div></div>`);
        });
    }
    document.getElementById('grid-items-container').innerHTML = combined.join('');
}

function filterCategory(key) {
    document.getElementById(`tab-${currentActiveCategory}`)?.classList.replace('bg-yellow-500', 'bg-white/5');
    currentActiveCategory = key;
    document.getElementById(`tab-${key}`)?.classList.replace('bg-white/5', 'bg-yellow-500');
    renderGridItems();
}

function handleCardAction(id, t, s, p, img, cat) {
    document.getElementById(id)?.classList.add('clicked-action');
    setTimeout(() => { document.getElementById(id)?.classList.remove('clicked-action'); openItemModal(t, s, p, img, cat); }, 150);
}

function openItemModal(t, s, p, img, cat) {
    document.getElementById('modal-title').innerText = t; document.getElementById('modal-subtitle').innerText = s;
    document.getElementById('modal-price').innerText = p; document.getElementById('modal-badge').innerText = cat || "Special Item";
    document.getElementById('modal-img').src = img || resolveDynamicCulinaryAsset(t);
    document.getElementById('modal-order-btn').onclick = (e) => {
        e.target.classList.add('order-btn-active');
        const tbl = new URLSearchParams(window.location.search).get('table') || "Takeaway";
        setTimeout(() => window.open(`https://wa.me/918848170406?text=${encodeURIComponent(`*New Order!*\nTable: ${tbl}\nItem: ${t}\nPrice: ₹${p}`)}`, '_blank'), 200);
    };
    document.getElementById('item-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('item-modal').classList.remove('opacity-0'), 10);
}

window.openItemModalFallback = function(itemName, fallbackPrice) {
    let foundItem = null, foundCat = "";
    const lowerName = itemName.toLowerCase().trim();
    
    for (const [key, cat] of Object.entries(menuData)) {
        const match = cat.items.find(i => lowerName.includes(i.title.toLowerCase().trim()) || i.title.toLowerCase().trim().includes(lowerName));
        if (match) { foundItem = match; foundCat = cat.name; break; }
    }
    
    if (foundItem) {
        openItemModal(foundItem.title, foundItem.subtitle, foundItem.price, foundItem.image, foundCat);
    } else {
        openItemModal(itemName, "Spoken Voice Order Request", fallbackPrice, "", "AI Match");
    }
};

function closeItemModal() { document.getElementById('item-modal').classList.add('opacity-0'); setTimeout(() => document.getElementById('item-modal').classList.add('hidden'), 200); }

function renderSlideshow() {
    document.getElementById('slideshow-container').innerHTML = slideshowItems.map((s, i) => `
        <div class="slide absolute inset-0 ${i === 0 ? 'active' : ''}" id="slide-${i}">
            <img src="${s.image}" class="w-full h-full object-cover ken-burns" onerror="this.src=resolveDynamicCulinaryAsset('${s.title.replace(/'/g, "\\'")}');">
            <div class="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-black/40 to-transparent flex flex-col justify-end p-8">
                <h2 class="text-4xl font-black text-white uppercase">${s.title}</h2>
                <p class="text-white/80 text-sm mb-4 max-w-sm">${s.subtitle}</p>
                <button onclick="openItemModal('${s.title.replace(/'/g, "\\'")}','${s.subtitle.replace(/'/g, "\\'")}','${s.price}','${s.image}')" class="bg-yellow-500 text-black font-black px-6 py-3 rounded-xl max-w-max">ORDER NOW FOR ₹${s.price}</button>
            </div>
        </div>
    `).join('');
}

function openAdminPanel() {
    const sel = document.getElementById('admin-item-selector');
    let opts = [];
    for (const [k, cat] of Object.entries(menuData)) {
        cat.items.forEach(i => opts.push(`<option value="${i.title.toLowerCase()}">${cat.name} -> ${i.title}</option>`));
    }
    sel.innerHTML = opts.join('');
    document.getElementById('admin-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-modal').classList.remove('opacity-0'), 10);
}

function closeAdminPanel() { document.getElementById('admin-modal').classList.add('opacity-0'); setTimeout(() => document.getElementById('admin-modal').classList.add('hidden'), 200); }

function switchUploadMode(m) {
    uploadMode = m;
    document.getElementById('wrapper-input-file').classList.toggle('hidden', m !== 'file');
    document.getElementById('wrapper-input-url').classList.toggle('hidden', m !== 'url');
}

function processIncomingFile(e) {
    const r = new FileReader();
    r.onload = (evt) => {
        const img = new Image();
        img.onload = () => { globalActiveSourceImage = img; document.getElementById('studio-preview-box').classList.remove('hidden'); document.getElementById('btn-studio-save').disabled = false; applyFilters(); };
        img.src = evt.target.result;
    };
    r.readAsDataURL(e.target.files[0]);
}

function applyFilters() {
    if (!globalActiveSourceImage) return;
    const c = document.getElementById('studio-processing-canvas'), ctx = c.getContext('2d');
    c.width = 400; c.height = 300;
    ctx.drawImage(globalActiveSourceImage, 0, 0, 400, 300);
    let id = ctx.getImageData(0,0,400,300), d = id.data, ctrl = parseFloat(document.getElementById('param-contrast').value)/100;
    for(let i=0; i<d.length; i+=4) { d[i]=128+(d[i]-128)*ctrl; d[i+1]=128+(d[i+1]-128)*ctrl; d[i+2]=128+(d[i+2]-128)*ctrl; }
    ctx.putImageData(id, 0, 0);
}

function commitStudioAsset() {
    const k = document.getElementById('admin-item-selector').value;
    localStorage.setItem(`custom_studio_img_${k}`, document.getElementById('studio-processing-canvas').toDataURL('image/jpeg', 0.8));
    renderGridItems(); renderSlideshow(); closeAdminPanel();
}

window.onload = () => { setupFullMenuUI(); };
