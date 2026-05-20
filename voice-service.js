// voice-service.js - Production-Ready Multi-Turn Native Malayalam AI Waiter Engine
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    systemLogsCollection: [],
    
    // Persistent Session Context for Local Tablet Memory
    conversationState: {
        currentOrder: [], 
        history: [], 
        totalBillAmount: 0,
        step: "ordering" 
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
        navigator.clipboard.writeText(textToCopy).then(() => alert("Logs copied!")).catch(() => alert("Copy blocked."));
    },
    
    toggle: async () => {
        const btn = document.getElementById('mic-assistant-btn');
        const overlay = document.getElementById('voice-diagnostic-overlay');
        
        // BARGE-IN FEATURE: കസ്റ്റമർ ബട്ടൺ അമർത്തുന്ന ഉടൻ എഐ സംസാരം നിർത്തുന്നു
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            VoiceService.addLogNotification("Barge-In", "AI speaking interrupted immediately.");
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
                btn?.setAttribute('class', 'p-3 rounded-xl bg-red-500/20 text-red-500 border border-red-500/40 shadow-lg transition-all duration-200 animate-pulse');
                overlay?.classList.remove('hidden');
                document.getElementById('voice-live-preview-box').innerText = "സംസാരിക്കൂ...";
            } catch (e) { alert("Microphone failed: " + e.message); }
        } else {
            VoiceService.active = false;
            btn?.setAttribute('class', 'p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-yellow-500 hover:bg-yellow-500 hover:text-black shadow-lg transition-all duration-200');
            if (VoiceService.liveRecognizer) VoiceService.liveRecognizer.stop();
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") { VoiceService.recorder.stop(); }
        }
    },

    process: async (blob) => {
        if (typeof BEANS_STATIC_GROQ === 'undefined' || BEANS_STATIC_GROQ.includes("YOUR_BASE64")) {
            VoiceService.addLogNotification("Error", "API keys are missing in menu-data.js.", true);
            return;
        }
        const groqDecoded = atob(BEANS_STATIC_GROQ).trim();

        try {
            VoiceService.addLogNotification("Step 1/2: Whisper STT", "Uploading audio data payload to Groq...");
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
            
            if (!transcript || transcript.trim() === "" || transcript.trim() === "?") {
                VoiceService.addLogNotification("Groq Alert", "Empty or unclear speech audio stream.", true);
                return;
            }

            transcript = transcript.replace(/[^\u0D00-\u0D7F\u0020-\u007Ea-zA-Z0-9\s?,.]/g, '').trim();
            VoiceService.addLogNotification("Step 2/2: LLaMA Brain", `Transcript Input: "${transcript}"`);

            let allowedItemsReferenceList = [];
            for (const [key, category] of Object.entries(menuData)) {
                category.items.forEach(i => allowedItemsReferenceList.push(`- ${i.title} (Price: ₹${i.price}, Category: ${category.name})`));
            }
            const structuredReferenceText = allowedItemsReferenceList.join("\n");

            // തനി നാടൻ കേരളീയ റസ്റ്റോറന്റ് വെയിറ്റർ ഇന്റലിജൻസ് പ്രോംപ്റ്റ്
            const systemPrompt = `CORE WAITER IDENTITY PROTOCOL: You are a friendly, natural-speaking human waiter at 'Beans n Leaves' restaurant in Kerala. Your speaking style must be fully natural, warm, and highly fluent local restaurant spoken Malayalam dialect. Avoid textbook, formal, or machine-like words.
            
            Current Active Order Array: ${JSON.stringify(VoiceService.conversationState.currentOrder)}
            Conversation Context Logs: ${JSON.stringify(VoiceService.conversationState.history.slice(-4))}

            Menu List Registry Database:
            ${structuredReferenceText}

            DIALECT TRANSLATION GUIDE FOR SPEECH SYNTHESIS ACCURACY:
            - Never write formal words like "ആഹാരം", "ആഗ്രഹം", "ലഭ്യമാണ്", "സ്വീകരിച്ചു", "മാർഗ്ഗം".
            - Instead use natural conversational words like "കഴിക്കാനായിട്ട്", "വേണം", "എടുത്തുതരാം", "ബിൽ", "ക്യുആർ കോഡ്".
            - Output clean Malayalam spelling. Avoid letters like "വ്വോ" or "മ്വോ" that break speech synthesis engines. (Use "വേണോ?" instead of "വേണംവോ?").

            CONVERSATIONAL AND UP-SELLING STRATEGY:
            1. Broad Category Queries (e.g., "ഷെയ്ക്ക് വേണം"): Reply naturally: "ഞങ്ങളുടെ അടുത്ത് Oreo, Nutella, Sharjah ഷെയ്ക്കുകൾ ഉണ്ട്. ഇതിൽ ഏതാ ഇപ്പൊ എടുത്തു തേണ്ടത്?". Never take a default choice without asking.
            2. Smart Cross-selling Suggestions: Whenever they add a valid dish, suggest a great side match to increase the order. (e.g., if they order a Burger, say: "തീർച്ചയായും, അതിന്റെ കൂടെ കഴിക്കാൻ നല്ല ക്രിസ്പി ഫ്രെഞ്ച് ഫ്രൈസോ അല്ലെങ്കിൽ കുടിക്കാൻ ഒരു കോൾഡ് കോഫിയോ കൂടി എടുക്കട്ടേ?").
            3. Order Finalization ("മതി", "ബിൽ എത്രയായി?"): Sum up all confirmed items. Recite the exact list back to them, state the total bill amount clearly in Malayalam, and ask if payment method is UPI or Cash. If UPI, explicitly say you are displaying the QR code on screen and set "showQRCode" to true.

            Return ONLY a raw JSON object with keys 'speechResponse', 'updateOrderList', 'triggerModalItem', 'totalBillAmount', 'showQRCode':
            {
                "speechResponse": "കസ്റ്റമറോട് തിരിച്ചു പറയേണ്ട മറുപടി തനി നാടൻ ഹോട്ടൽ ശൈലിയിൽ ഇവിടെ എഴുതുക",
                "updateOrderList": [{"title": "Exact Item Title", "price": "100", "quantity": 1}],
                "triggerModalItem": "Exact item title to pop up on screen (or empty string)",
                "totalBillAmount": "Total bill amount calculated as integer",
                "showQRCode": false
            }`;

            const groqChatUrl = 'https://api.groq.com/openai/v1/chat/completions';
            const chatRes = await fetch(groqChatUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqDecoded}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You output single, valid, flat JSON data objects matching required properties exactly. Never write code fences." },
                        { role: "user", content: `Customer Input: "${transcript}"\n\nInstructions:\n${systemPrompt}` }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                })
            });

            if (!chatRes.ok) throw new Error(`Groq LLaMA Error: HTTP ${chatRes.status}`);
            const chatData = await chatRes.json();
            const cleanText = chatData.choices[0].message.content.trim();
            const output = JSON.parse(cleanText);

            VoiceService.addLogNotification("Pipeline Complete", JSON.stringify(output));
            
            // ഹിസ്റ്ററിയും ഓർഡർ സ്റ്റേറ്റും അപ്‌ഡേറ്റ് ചെയ്യുന്നു
            VoiceService.conversationState.history.push({ user: transcript, assistant: output.speechResponse });
            if (output.updateOrderList && output.updateOrderList.length > 0) {
                VoiceService.conversationState.currentOrder = output.updateOrderList;
            }
            if (output.totalBillAmount) {
                VoiceService.conversationState.totalBillAmount = output.totalBillAmount;
            }

            // സ്പീച്ച് ഔട്ട്പുട്ട് ജനറേഷൻ
            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                u.rate = 0.95; // സ്വാഭാവികമായ വേഗത ക്രമീകരിച്ചു
                window.speechSynthesis.speak(u);
            }
            
            if (output.triggerModalItem && output.triggerModalItem !== "" && typeof window.openItemModalFallback === 'function') {
                window.openItemModalFallback(output.triggerModalItem, output.totalBillAmount);
            }

            if (output.showQRCode) {
                VoiceService.addLogNotification("Payment Node", "UPI Payment Request - Simulating Interface Barcode Screen.");
            }
        } catch (err) {
            console.error(err);
            VoiceService.addLogNotification("Pipeline Failure", err.message, true);
        }
    }
};
