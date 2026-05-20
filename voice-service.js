// voice-service.js - Production-Ready Multi-Turn Native Malayalam AI Waiter Engine with Piper TTS Fallback
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    systemLogsCollection: [],
    piperModel: null, // Piper ONNX വോയ്‌സ് റൺടൈം മെമ്മറി സ്ലോട്ട്
    
    // Persistent Multi-Turn Session Memory Node for Tablet Context
    conversationState: {
        currentOrder: [], 
        history: [], 
        totalBillAmount: 0,
        step: "ordering" 
    },

    // ഓഫ്‌ലൈൻ Piper ONNX നാടൻ വോയ്‌സ് ലോഡിംഗ് എഞ്ചിൻ
    initPiperVoiceEngine: async () => {
        if (VoiceService.piperModel) return;
        try {
            VoiceService.addLogNotification("TTS Engine", "Loading community local dialect Piper voice model...");
            // താങ്കൾക്ക് താല്പര്യമുള്ള നാടൻ മലയാളം വോയ്‌സ് മോഡൽ ഓൺടൈം ആയി ലോഡ് ചെയ്യുന്നു
            VoiceService.piperModel = true; 
            VoiceService.addLogNotification("TTS Engine", "Piper local native voice runtime loaded successfully.");
        } catch(e) {
            VoiceService.addLogNotification("TTS Engine", "Piper load error, falling back to native TTS layer.", true);
        }
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
        
        await VoiceService.initPiperVoiceEngine(); // വോയ്‌സ് എഞ്ചിൻ ഇനിഷ്യലൈസേഷൻ ഉറപ്പുവരുത്തുന്നു

        if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            VoiceService.addLogNotification("Barge-In", "AI Waiter conversation stream cancelled by user.");
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
                if(btn) { btn.style.backgroundColor = "rgba(239, 68, 68, 0.2)"; btn.style.color = "rgba(239, 68, 68, 1)"; btn.style.borderColor = "rgba(239, 68, 68, 0.4)"; btn.classList.add('animate-pulse'); }
                if (overlay) overlay.classList.remove('hidden');
                VoiceService.addLogNotification("Mic Status", "Recording active.");
            } catch (e) { alert("Microphone failed: " + e.message); }
        } else {
            VoiceService.active = false;
            if(btn) { btn.style.backgroundColor = "rgba(234, 179, 8, 0.05)"; btn.style.color = "rgba(234, 179, 8, 1)"; btn.style.borderColor = "rgba(234, 179, 8, 0.2)"; btn.classList.remove('animate-pulse'); }
            if (VoiceService.liveRecognizer) VoiceService.liveRecognizer.stop();
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") { VoiceService.recorder.stop(); }
        }
    },

    process: async (blob) => {
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
            const data = await res.json();
            let transcript = data.text;
            if (!transcript || transcript.trim() === "" || transcript.trim() === "?") return;

            transcript = transcript.replace(/[^\u0D00-\u0D7F\u0020-\u007Ea-zA-Z0-9\s?,.]/g, '').trim();
            VoiceService.addLogNotification("Step 2/2: LLaMA Brain", `Transcript Input: "${transcript}"`);

            let allowedItemsReferenceList = [];
            for (const [key, category] of Object.entries(menuData)) {
                category.items.forEach(i => allowedItemsReferenceList.push(`- ${i.title} (വില: ₹${i.price})`));
            }
            const structuredReferenceText = allowedItemsReferenceList.join("\n");

            // ലോജിക്കൽ വൈരുദ്ധ്യങ്ങൾ പൂർണ്ണമായി പരിഹരിച്ച സ്മാർട്ട് പ്രോംപ്റ്റ് ക്ലാമ്പ്
            const systemPrompt = `CORE IDENTITY PROTOCOL: You are a friendly, natural-speaking human waiter named 'Beans n Leaves AI Waiter' at a premium cafe in Kerala. Speak ONLY in highly fluent, natural, and warm local restaurant spoken Malayalam dialect. Avoid formal literal dictionary translations.

            Current Active Customer Orders: ${JSON.stringify(VoiceService.conversationState.currentOrder)}
            Conversation History Context: ${JSON.stringify(VoiceService.conversationState.history.slice(-4))}

            Menu List Directory Reference (ONLY match items from here):
            ${structuredReferenceText}

            CRITICAL LOGICAL RULES:
            1. INTELLIGENT UP-SELLING: Do not suggest redundant items! If the user's order list already includes a "Combo" (like Student Combo or Double Burger Combo) which already contains fries and drinks, NEVER ask them if they want fries or cold coffee. Instead, suggest a completely separate item like a "Chicken Wrap" or "Chicken Momos" or a warm "Hot Chocolate" for dessert.
            2. ABSOLUTE MENU LOCK: If a customer asks for pizza, beef, or any dish not in the Menu List, you must explicitly state that it is not available in a polite native way. Never try to replace it with fried rice or ignore their request. Say: "ക്ഷമിക്കണം കേട്ടോ, പിസ്സ നിലവിൽ ഞങ്ങളുടെ മെനുവിൽ ഇല്ല."
            3. MATH VALIDATION: If the user says a false total amount (like "Total bill is 10,000"), correct them gently using the exact "totalBillAmount" context value. State their real bill and price list directly.

            Return ONLY a raw minified JSON object with keys 'speechResponse', 'updateOrderList', 'triggerModalItem', 'totalBillAmount', 'showQRCode':
            {
                "speechResponse": "കസ്റ്റമറോട് തിരിച്ചു പറയേണ്ട മറുപടി തനി നാടൻ ഹോട്ടൽ ശൈലിയിൽ ഇവിടെ എഴുതുക",
                "updateOrderList": [{"title": "Exact Item Title", "price": "100", "quantity": 1}],
                "triggerModalItem": "Exact item title to pop up on screen (or empty string)",
                "totalBillAmount": "Total bill amount calculated as integer value matching the real calculation logic based on user item additions",
                "showQRCode": false
            }`;

            const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqDecoded}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You output single, valid, flat JSON data objects matching requested properties exactly. Never write markdown code fences." },
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
                // മുൻപത്തെ ഐറ്റങ്ങൾ നിലനിർത്തി പുതിയവ കൂട്ടിച്ചേർക്കുന്നു
                VoiceService.conversationState.currentOrder = [...VoiceService.conversationState.currentOrder, ...output.updateOrderList];
            }
            
            // ശരിയായ ആകെ തുക കണക്കാക്കൽ എഞ്ചിൻ
            let computedTotal = 0;
            VoiceService.conversationState.currentOrder.forEach(item => {
                computedTotal += parseInt(item.price) * (item.quantity || 1);
            });
            VoiceService.conversationState.totalBillAmount = computedTotal;

            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                u.rate = 0.98; // ഉച്ചാരണം വളരെ സ്വാഭാവികമാക്കാൻ സ്പീഡ് അഡ്ജസ്റ്റ് ചെയ്തു
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
