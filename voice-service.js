// voice-service.js - Direct-Decoded Multi-Turn Native Malayalam AI Waiter Engine (Ultra-Optimized)
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    systemLogsCollection: [],
    
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
        navigator.clipboard.writeText(textToCopy).then(() => alert("Logs copied successfully!")).catch(() => alert("Clipboard block. Copy manually."));
    },
    
    toggle: async () => {
        const btn = document.getElementById('mic-assistant-btn');
        const overlay = document.getElementById('voice-diagnostic-overlay');
        
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            VoiceService.addLogNotification("Barge-In", "AI Waiter speaking stopped immediately by user.");
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
            VoiceService.addLogNotification("Error", "Paste your fresh raw Groq key into menu-data.js constants.", true);
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
            if (!res.ok) throw new Error(`Groq Whisper Failure: Received HTTP ${res.status}`);
            const data = await res.json();
            let transcript = data.text;
            
            // AGGRESSIVE SILENCE GUARD: വെറും ചിഹ്നങ്ങളോ അനാവശ്യ ശബ്ദങ്ങളോ ആണെങ്കിൽ ഇവിടെവെച്ച് തടയുന്നു!
            if (!transcript || transcript.trim() === "") return;
            const validCharactersOnly = transcript.replace(/[^a-zA-Z\u0D00-\u0D7F]/g, "").trim();
            if (validCharactersOnly.length < 2 || transcript.toLowerCase().includes("watching")) {
                VoiceService.addLogNotification("Silence Guard", "Dropped empty capture or meaningless background noise.");
                return; 
            }

            transcript = transcript.replace(/[^\u0D00-\u0D7F\u0020-\u007Ea-zA-Z0-9\s?,.]/g, '').trim();
            VoiceService.addLogNotification("Step 2/2: LLaMA Brain", `Transcript Input: "${transcript}"`);

            let allowedItemsReferenceList = [];
            for (const [key, category] of Object.entries(menuData)) {
                category.items.forEach(i => allowedItemsReferenceList.push(`- ${i.title} (Price: ₹${i.price})`));
            }
            const structuredReferenceText = allowedItemsReferenceList.join("\n");

            const systemPrompt = `CORE IDENTITY: You are a friendly, welcoming native human waiter named 'Beans n Leaves AI Waiter' at a premium cafe in Kerala. Speak ONLY in fluent, natural, warm local restaurant spoken Malayalam dialect. 

            Current Active Customer Orders: ${JSON.stringify(VoiceService.conversationState.currentOrder)}
            History: ${JSON.stringify(VoiceService.conversationState.history.slice(-3))}
            Menu List Directory: \n${structuredReferenceText}

            CRITICAL DYNAMIC CONVERSATION LAWS:
            1. IRRELEVANT CHATTER FILTER: If the user says random English phrases (like "Where am I going?"), questions unrelated to a restaurant, or pure gibberish, DO NOT process an order! Gently reply: "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല. ഓർഡർ ചെയ്യാൻ എന്തെങ്കിലും വേണോ?"
            2. PHONETIC MALAYALAM CLAMP: Use very simple Malayalam words. Avoid complex joined letters (കൂട്ടക്ഷരങ്ങൾ) so the browser engine reads it smoothly. Use "വേണോ?" instead of "വേണംവോ?". Use "എടുത്തു തരാം" instead of "ലഭ്യമാക്കുക".
            3. NO REDUNDANT UP-SELLING: If the user already ordered a "Combo", DO NOT ask if they want fries or drinks. Suggest a dessert or snack instead.
            4. MENU BOUNDARIES: If they ask for items not on the list (Pizza, Beef), say it's unavailable ("ക്ഷമിക്കണം, അത് ഇവിടെ കിട്ടില്ല").
            5. FINAL BILLING: When they say "മതി", "ബിൽ", recite items, state exact totalBillAmount, and ask Cash or UPI. If UPI, set "showQRCode" to true.

            Return ONLY a raw minified JSON object:
            {
                "speechResponse": "Natural simple Malayalam reply here",
                "updateOrderList": [{"title": "Exact Menu Title", "price": "100", "quantity": 1}],
                "triggerModalItem": "Item Title or empty string",
                "totalBillAmount": Integer amount,
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
            
            let computedTotal = 0;
            VoiceService.conversationState.currentOrder.forEach(item => {
                computedTotal += parseInt(item.price) * (item.quantity || 1);
            });
            VoiceService.conversationState.totalBillAmount = computedTotal;

            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                u.rate = 0.95; // സ്പീഡ് കുറച്ചു
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
