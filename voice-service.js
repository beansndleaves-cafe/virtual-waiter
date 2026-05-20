// voice-service.js - Production-Ready Multi-Turn Native Malayalam AI Waiter Engine (Hyper-Tuned Phonetics)
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    systemLogsCollection: [],
    
    conversationState: {
        currentOrder: [], 
        history: [], 
        totalBillAmount: 0
    },
    
    addLogNotification: (title, text, isError = false) => {
        const timestamp = new Date().toLocaleTimeString();
        VoiceService.systemLogsCollection.push(`[${timestamp}] ${title.toUpperCase()}: ${text}`);
        const stackContainer = document.getElementById('voice-log-stack');
        if (!stackContainer) return;
        const card = document.createElement('div');
        card.className = `p-3 rounded-xl border text-xs font-medium backdrop-blur-md transition-all duration-300 shadow-md ${
            isError ? 'bg-red-950/90 border-red-500/40 text-red-200' : 'bg-neutral-900/90 border-yellow-500/20 text-white/90'
        }`;
        card.innerHTML = `<div class="flex justify-between items-center mb-1"><span class="font-black uppercase tracking-wider text-[10px] ${isError ? 'text-red-400' : 'text-yellow-500'}">${title}</span><span class="text-[9px] text-white/30 font-bold">${timestamp}</span></div><p class="leading-relaxed break-words">${text}</p>`;
        stackContainer.appendChild(card);
        stackContainer.scrollTop = stackContainer.scrollHeight;
    },

    copyDiagnosticsToClipboard: () => {
        const textToCopy = VoiceService.systemLogsCollection.join("\n");
        navigator.clipboard.writeText(textToCopy).then(() => alert("Logs copied successfully!")).catch(() => alert("Clipboard block."));
    },
    
    toggle: async () => {
        const btn = document.getElementById('mic-assistant-btn');
        const overlay = document.getElementById('voice-diagnostic-overlay');
        
        // BARGE-IN FEATURE: കസ്റ്റമർ വീണ്ടും ബട്ടൺ അമർത്തുമ്പോൾ പഴയ ബോട്ട് സംസാരം ഉടനടി നിർത്തുന്നു
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            VoiceService.addLogNotification("Barge-In", "AI Waiter speaking stopped immediately.");
        }

        if (!VoiceService.active) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                VoiceService.recorder = new MediaRecorder(stream);
                VoiceService.chunks = [];
                VoiceService.recorder.ondataavailable = e => { if (e.data && e.data.size > 0) VoiceService.chunks.push(e.data); };
                VoiceService.recorder.onstop = async () => { await VoiceService.process(new Blob(VoiceService.chunks, { type: 'audio/webm' })); };
                
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (SpeechRecognition) {
                    VoiceService.liveRecognizer = new SpeechRecognition();
                    VoiceService.liveRecognizer.continuous = true;
                    VoiceService.liveRecognizer.interimResults = true;
                    VoiceService.liveRecognizer.lang = 'ml-IN'; 
                    VoiceService.liveRecognizer.onresult = (event) => {
                        let text = '';
                        for (let i = event.resultIndex; i < event.results.length; ++i) { text += event.results[i][0].transcript; }
                        const previewNode = document.getElementById('voice-live-preview-box');
                        if (previewNode) previewNode.innerText = text || "കേൾക്കുന്നു...";
                    };
                    VoiceService.liveRecognizer.start();
                }
                
                VoiceService.recorder.start(250);
                VoiceService.active = true;
                if(btn) {
                    btn.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
                    btn.style.color = "rgba(239, 68, 68, 1)";
                    btn.style.borderColor = "rgba(239, 68, 68, 0.4)";
                    btn.classList.add('animate-pulse');
                }
                if (overlay) overlay.classList.remove('hidden');
                document.getElementById('voice-live-preview-box').innerText = "സംസാരിക്കൂ...";
                VoiceService.addLogNotification("Mic Status", "Recording pipeline tracking active.");
            } catch (e) { alert("Microphone connection failed: " + e.message); }
        } else {
            VoiceService.active = false;
            if(btn) {
                btn.style.backgroundColor = "rgba(234, 179, 8, 0.05)";
                btn.style.color = "rgba(234, 179, 8, 1)";
                btn.style.borderColor = "rgba(234, 179, 8, 0.2)";
                btn.classList.remove('animate-pulse');
            }
            if (VoiceService.liveRecognizer) VoiceService.liveRecognizer.stop();
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") {
                VoiceService.recorder.stop();
                VoiceService.addLogNotification("Mic Status", "Voice packet pipeline closed.");
            }
        }
    },

    process: async (blob) => {
        if (typeof BEANS_STATIC_GROQ === 'undefined' || BEANS_STATIC_GROQ.includes("YOUR_BASE64")) {
            VoiceService.addLogNotification("Error", "Paste your fresh raw Groq key into menu-data.js constants first.", true);
            return;
        }
        const groqDecoded = atob(BEANS_STATIC_GROQ).trim();

        try {
            VoiceService.addLogNotification("Step 1/2: Whisper STT", "Uploading voice stream to Groq Cloud API...");
            const fd = new FormData();
            fd.append('file', blob, 'audio.webm');
            fd.append('model', 'whisper-large-v3');
            fd.append('language', 'ml'); 
            
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqDecoded}` },
                body: fd
            });
            if (!res.ok) throw new Error(`Groq Whisper HTTP Error: ${res.status}`);
            const data = await res.json();
            let transcript = data.text;
            
            if (!transcript || transcript.trim() === "") return;

            // SILENCE & BACKGROUND NOISE GUARD: തെറ്റായ ഫില്ലർ വാക്കുകളെ ഇവിടെ വെച്ച് പൂർണ്ണമായി തടയുന്നു
            const lowerTranscript = transcript.toLowerCase();
            if (lowerTranscript.includes("thank you for watching") || lowerTranscript.includes("watching") || transcript.trim() === "?") {
                VoiceService.addLogNotification("Silence Guard", "Ambient backdrop noise filtered out.");
                return;
            }

            transcript = transcript.replace(/[^\u0D00-\u0D7F\u0020-\u007Ea-zA-Z0-9\s?,.]/g, '').trim();
            VoiceService.addLogNotification("Step 2/2: LLaMA Brain", `Transcript Input: "${transcript}"`);

            let allowedItemsReferenceList = [];
            for (const [key, category] of Object.entries(menuData)) {
                category.items.forEach(i => allowedItemsReferenceList.push(`- ${i.title} (Price: ₹${i.price})`));
            }
            const structuredReferenceText = allowedItemsReferenceList.join("\n");

            // ലോജിക്കൽ വൈരുദ്ധ്യങ്ങൾ പൂർണ്ണമായി ഒഴിവാക്കിയും വോയ്‌സ് വ്യക്തമാക്കിയുമുള്ള പ്രോംപ്റ്റ് ക്ലാമ്പ്
            const systemPrompt = `CORE IDENTITY: You are a friendly, welcoming native human waiter named 'Beans n Leaves AI Waiter' at a premium cafe in Kerala. Speak ONLY in fluent, natural, warm local restaurant spoken Malayalam dialect. 

            Current Active Customer Orders: ${JSON.stringify(VoiceService.conversationState.currentOrder)}
            Conversation History Context Logs: ${JSON.stringify(VoiceService.conversationState.history.slice(-3))}

            Menu List Directory Reference (ONLY match items from here):
            ${structuredReferenceText}

            CRITICAL DYNAMIC CONVERSATION LAWS:
            1. PHONETIC MALAYALAM CLAMP (FOR BUILT-IN TTS ACCURACY):
               - Write responses in clean, simple, properly spaced Malayalam words. Never combine syllables or use complex conjunct letters (കൂട്ടക്ഷരങ്ങൾ) which cause stuttering in tablet synthesis engines.
               - Instead of writing formal machine words like "ആഹാരം", "ആഗ്രഹം", "ലഭ്യമാണ്", "സ്വീകരിച്ചു", "മാർഗ്ഗം", "ലഭ്യമാക്കുക", "താല്പര്യമുണ്ടോ", use words like "കഴിക്കാനായിട്ട്", "വേണം", "എടുത്തു തരാം", "ബിൽ തുക", "നോക്കട്ടെ", "തരാം".
            2. NO REDUNDANT RECOMMENDATIONS:
               - Look closely at "Current Active Customer Orders". If the user already ordered a "Combo" (like Student Combo, Double Burger Combo, etc.), it already has fries and a drink included! NEVER ask them if they want fries or cold coffee. Instead, ask if they want a tasty "Chicken Wrap" or "Chicken Momos" or some "Fresh Juice" alongside it.
            3. STRICT MENU BOUNDARIES:
               - If a customer mentions an item not on the menu list (like pizza, beef, fish fry), politely inform them in natural Malayalam that it's unavailable. Never suggest fried rice or ignore it. Example: "ക്ഷമിക്കണം കേട്ടോ, പിസ്സ ഇപ്പൊ ഇവിടെ കിട്ടില്ല."
            4. ACCURATE FINAL BILLING FLOW:
               - When they say "അത്രയും മതി", "ബിൽ എത്രയായി", summarize all ordered items, compute the accurate sum, state the real total amount in clear numbers, and ask if they prefer UPI or Cash. If UPI, state you are opening the QR code and set "showQRCode" to true. If they claim a false total (like 10,000), gently tell them the real total from the list computation.

            Return ONLY a raw minified JSON object with keys 'speechResponse', 'updateOrderList', 'triggerModalItem', 'totalBillAmount', 'showQRCode':
            {
                "speechResponse": "കസ്റ്റമറോട് തിരിച്ചു പറയേണ്ട മറുപടി നാടൻ ഹോട്ടൽ ശൈലിയിൽ ലളിതമായി ഇവിടെ എഴുതുക",
                "updateOrderList": [{"title": "Exact Item Title", "price": "100", "quantity": 1}],
                "triggerModalItem": "Exact item title string to pop up on screen (or empty string)",
                "totalBillAmount": "Total bill amount calculated accurately based on item additions",
                "showQRCode": false
            }`;

            const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqDecoded}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You output single, valid, flat JSON data objects matching requested properties exactly. Never write code fences." },
                        { role: "user", content: `Customer Input: "${transcript}"\n\nInstructions:\n${systemPrompt}` }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                })
            });

            const chatData = await chatRes.json();
            const cleanText = chatData.choices[0].message.content.trim();
            const output = JSON.parse(cleanText);

            VoiceService.addLogNotification("Pipeline Complete", JSON.stringify(output));
            
            VoiceService.conversationState.history.push({ user: transcript, assistant: output.speechResponse });
            if (output.updateOrderList && output.updateOrderList.length > 0) {
                VoiceService.conversationState.currentOrder = [...VoiceService.conversationState.currentOrder, ...output.updateOrderList];
            }
            
            // പ്രൊഡക്ഷൻ-ഗ്രേഡ് ടോട്ടൽ കാൽക്കുലേറ്റർ
            let computedTotal = 0;
            VoiceService.conversationState.currentOrder.forEach(item => {
                computedTotal += parseInt(item.price) * (item.quantity || 1);
            });
            VoiceService.conversationState.totalBillAmount = computedTotal;

            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                u.rate = 0.96; // സ്പീച്ച് എഞ്ചിൻ വായിക്കുമ്പോൾ കൂടുതൽ മനുഷ്യസഹജമാകാൻ വേഗത ചെറുതായി കുറച്ചു
                u.pitch = 1.0;
                window.speechSynthesis.speak(u);
            }
            
            if (output.triggerModalItem && output.triggerModalItem !== "" && typeof window.openItemModalFallback === 'function') {
                window.openItemModalFallback(output.triggerModalItem, VoiceService.conversationState.totalBillAmount);
            }
        } catch (err) {
            console.error(err);
            VoiceService.addLogNotification("Pipeline Failure", err.message, true);
        }
    }
};
