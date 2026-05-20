// menu-data.js - Centralized Menu Registry and Fallback Asset Engine
const menuData = {
    "bundles": {
        name: "Super Saver Bundles",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0l1.9-5.7a1.125 1.125 0 011.07-.79h10.96c.458 0 .858.277 1.07.79l1.9 5.7M6.75 6.75h.75m-.75 3h.75M16.5 6.75h.75m-.75 3h.75"/></svg>`,
        items: [
            { title: "Double Burger Combo", subtitle: "2 Chicken Burgers + Fries + Cold Drink (Save ₹200)", price: "249", image: "img/double_burger_combo.jpeg" },
            { title: "Student Combo", subtitle: "Chicken Burger + Fries + Lime Juice or Cold Drink (Save ₹99)", price: "199", image: "img/Burger_combo.jpeg" },
            { title: "Wrap Combo", subtitle: "BBQ/Peri Peri Wrap + Lime Juice or Cold Drink (Save ₹20)", price: "179", image: "img/wrap_combo.jpeg" },
            { title: "Snack Combo", subtitle: "Chicken Momos (6 pcs) + Lime Soda (Save ₹20)", price: "159", image: "img/snack_combo.jpeg" },
            { title: "Tea Time Combo", subtitle: "Hot Tea + 2 pcs Pazham Pori (Save ₹11)", price: "39", image: "img/tea_combo.jpeg" }
        ]
    },
    "bites": {
        name: "Quick Bites",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h.008v.008H12V7.5zM12 10.5h.008v.008H12V10.5zM12 13.5h.008v.008H12V13.5zM3.75 18h16.5M4.5 18v-3.375c0-.621.504-1.125 1.125-1.125h12.75c.621 0 1.125.504 1.125 1.125V18M7.5 13.5h9m-10.5-3h12m-10.5-3h9M6.31 3.97a3 3 0 014.243 0L12 5.414l1.446-1.444a3 3 0 014.243 4.242L12 13.914 6.31 8.212a3 3 0 010-4.243z"/></svg>`,
        items: [
            { title: "Chicken Momos (6 pcs)", subtitle: "Signature steamed juicy chicken momos", price: "139", image: "img/momos.jpeg" },
            { title: "Chicken Nuggets (6 pcs)", subtitle: "Crispy, golden & tender fried treats", price: "149", image: "img/nuggets.jpeg" },
            { title: "Chicken Wrap", subtitle: "Your choice of BBQ or savory Peri Peri spread", price: "159", image: "img/chicken_wrap.jpeg" },
            { title: "Double Burger", subtitle: "Dual layered classic gourmet stacks", price: "199", image: "img/double_burger.jpeg" },
            { title: "Chicken Cheese Burger", subtitle: "Juicy burger loaded with extra melted cheddar cheese", price: "159", image: "img/cheese_burger.jpeg" },
            { title: "Veg Spring Roll (4 pcs)", subtitle: "Crispy fried wrappers with seasoned garden veggies", price: "99", image: "img/spring_roll.jpeg" },
            { title: "Chicken Cutlet (2 pcs)", subtitle: "Perfectly spiced breaded pulled chicken patties", price: "60", image: "img/chicken_cutlet.jpeg" },
            { title: "Loaded Fries", subtitle: "Crispy potato fries heavily seasoned & dressed", price: "260", image: "img/loaded_fries.jpeg" },
            { title: "French Fries", subtitle: "Classic salted crispy golden potato fingers", price: "99", image: "img/french_fries.jpeg" },
            { title: "Pazham Pori (2 pcs)", subtitle: "Authentic Kerala sweet ripe banana fritters", price: "25", image: "img/pazham_pori.jpeg" }
        ]
    },
    "soups": {
        name: "Healthy Soups",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m3.375-2.25l-.75 2.25M8.625 3l.75 2.25M3 14.25c0 3.728 3.022 6.75 6.75 6.75h4.5c3.728 0 6.75-3.022 6.75-6.75v-1.5H3v1.5zM21 9.75H3"/></svg>`,
        items: [
            { title: "Hot & Sour Soup", subtitle: "Tangy & spicy classic broth (Veg/Non-Veg)", price: "100", image: "img/hot_sour_soup.jpeg" },
            { title: "Sweet Corn Veg Soup", subtitle: "Light, comforting creamed corn base with fine veggies", price: "90", image: "img/veg_corn_soup.jpeg" },
            { title: "Sweet Corn Chicken Soup", subtitle: "Wholesome sweet corn soup loaded with shredded chicken", price: "100", image: "img/chicken_corn_soup.jpeg" }
        ]
    },
    "mains": {
        name: "Rice & Noodles",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>`,
        items: [
            { title: "Chicken Fried Rice", subtitle: "Classic aromatic wok-tossed savory rice & chicken", price: "199", image: "img/fried_rice.jpeg" },
            { title: "Egg Fried Rice", subtitle: "Fragrant seasoned rice tossed with scrambled eggs", price: "189", image: "img/egg_rice.jpeg" },
            { title: "Veg Fried Rice", subtitle: "Healthy garden vegetable stir-fried medley rice", price: "169", image: "img/veg_rice.jpeg" },
            { title: "Chicken Noodles", subtitle: "Savory stir-fried noodles cooked with tender chicken pieces", price: "210", image: "img/chicken_noodles.jpeg" },
            { title: "Egg Noodles", subtitle: "Flavored wok noodles tossed with spiced fried eggs", price: "199", image: "img/egg_noodles.jpeg" },
            { title: "Veg Noodles", subtitle: "Light pan-fried street noodles with fresh shredded vegetables", price: "170", image: "img/veg_noodles.jpeg" }
        ]
    },
    "shakes": {
        name: "Shakes & Cold Sips",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 4.5l-4.5 4.5m0 0L10.5 4.5M15 9l-3 12M9 21h6M6 7.5h12M7.5 21l-1.5-13.5h12L16.5 21h-9z"/></svg>`,
        items: [
            { title: "Sharjah Shake", subtitle: "Classic thick, creamy banana & milk staple favorite", price: "99", image: "img/sharjah_shake.jpeg" },
            { title: "Special Sharjah", subtitle: "Premium thick Sharjah profile topped with fine nuts", price: "129", image: "img/special_sharjah.jpeg" },
            { title: "Fruit Shake", subtitle: "Rich blended seasonal fruits with dairy cream base", price: "120", image: "img/fruit_shake.jpeg" },
            { title: "Peanut Shake", subtitle: "Rich nutty profile packed with premium peanut butter notes", price: "120", image: "img/peanut_shake.jpeg" },
            { title: "Cold Coffee", subtitle: "Classic chilled, exceptionally creamy & frothy caffeine hit", price: "95", image: "img/cold_coffee.jpeg" },
            { title: "Oreo Shake", subtitle: "Thick double cream milk chocolate base & crunchy Oreo cookies", price: "120", image: "img/oreo_shake.jpeg" },
            { title: "Nutella Shake", subtitle: "Decadent, hazelnut-loaded premium cocoa blend spread", price: "150", image: "img/nutella_shake.jpeg" }
        ]
    },
    "refreshments": {
        name: "Refreshments & Hot Sips",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.625a2.25 2.25 0 01-2.241 2.125H6.616a2.25 2.25 0 01-2.241-2.125L3.75 7.5m16.5 0H3.75m16.5 0A2.25 2.25 0 0018 5.25H6A2.25 2.25 0 003.75 7.5m13.5-3V3.375c0-.621-.504-1.125-1.125-1.125h-4.25c-.621 0-1.125.504-1.125 1.125V4.5M10.5 11.25h3M9.75 15h4.5"/></svg>`,
        items: [
            { title: "Watermelon Juice", subtitle: "100% Pure fresh, hydrating crushed crimson melon", price: "70", image: "img/watermelon.jpeg" },
            { title: "Musk Melon Juice", subtitle: "Sweet, pulpy cantaloupe nectar chilled to perfection", price: "90", image: "img/muskmelon.jpeg" },
            { title: "Seasonal Fruit Juice", subtitle: "Freshly squeezed local harvest dynamic fruit extract", price: "90", image: "img/seasonal_juice.jpeg" },
            { title: "Pineapple Juice", subtitle: "Tangy, sweet tropical golden pineapple press juice", price: "90", image: "img/pineapple.jpeg" },
            { title: "Fresh Lime Soda", subtitle: "Zesty, fizzy & highly effervescent citrus soda mixer", price: "50", image: "img/lime_soda.jpeg" },
            { title: "Hot Chocolate/Boost/Horlicks", subtitle: "Steaming hot mug of intensely rich cocoa or malt comfort", price: "50", image: "img/hot_chocolate.jpeg" },
            { title: "Hot Coffee", subtitle: "Perfectly brewed traditional rich, aromatic house roast coffee", price: "35", image: "img/hot_coffee.jpeg" },
            { title: "Hot Tea", subtitle: "Classic restorative piping hot milk tea infusion", price: "25", image: "img/tea_combo.jpeg" }
        ]
    }
};

function resolveDynamicCulinaryAsset(title) {
    const norm = title.toLowerCase();
    const stored = localStorage.getItem(`custom_studio_img_${norm}`);
    if (stored) return stored;
    if (norm.includes("double burger combo")) return "img/Burger_combo.jpeg";
    if (norm.includes("pazham pori")) return "img/tea_combo.jpeg";
    if (norm.includes("special sharjah")) return "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=600&q=70";
    if (norm.includes("sharjah shake")) return "https://images.unsplash.com/photo-1553787499-6f9133860278?w=600&q=70";
    if (norm.includes("peanut shake")) return "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=600&q=70";
    if (norm.includes("nutella shake")) return "https://images.unsplash.com/photo-1600718374662-0483d2b9da44?w=600&q=70";
    if (norm.includes("fruit shake")) return "https://images.unsplash.com/photo-1505252585461-04db1edf8525?w=600&q=70";
    if (norm.includes("cold coffee")) return "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&q=70";
    if (norm.match(/juice|watermelon|melon|pineapple/)) return "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&q=70";
    if (norm.includes("spring roll")) return "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=70";
    if (norm.includes("cutlet")) return "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&q=70";
    if (norm.match(/french fries|loaded fries/)) return "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=600&q=70";
    if (norm.includes("soup")) return "https://images.unsplash.com/photo-1547592165-e1d17fed6005?w=600&q=70";
    if (norm.includes("rice")) return "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=70";
    if (norm.includes("noodle")) return "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&q=70";
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=70";
}
