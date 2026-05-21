// voice-service.js - Ultra-Optimized Apple-Level Native AI Waiter with Flawless Logic
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
        navigator.clipboard.writeText(textToCopy).then(() => alert("Logs copied successfully!")).catch(() => alert("Clipboard block."));
    },
    
    toggle: async () => {
        const btn = document.getElementById('mic-assistant-btn');
        const overlay = document.getElementById('voice-diagnostic-overlay');
        
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
                VoiceService.addLogNotification("Mic Status", "Recording active.");
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
                VoiceService.addLogNotification("Mic Status", "Voice closed.");
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
            VoiceService.addLogNotification("Step 1/2: Whisper STT", "Uploading to Groq Cloud...");
            const fd = new FormData();
            fd.append('file', blob, 'audio.webm');
            fd.append('model', 'whisper-large-v3');
            fd.append('language', 'ml'); 
            
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqDecoded}` },
                body: fd
            });
            if (!res.ok) throw new Error(`Groq Whisper Failure: HTTP ${res.status}`);
            const data = await res.json();
            let transcript = data.text;
            
            // AGGRESSIVE SILENCE & GIBBERISH GUARD
            if (!transcript) return;
            let strictClean = transcript.replace(/[^\u0D00-\u0D7F\a-zA-Z0-9]/g, '');
            const lowerT = transcript.toLowerCase();
            
            if (strictClean.length < 2 || lowerT.includes("watching") || lowerT.includes("thank you")) {
                VoiceService.addLogNotification("Silence Guard", "Dropped meaningless noise / mic hallucination.");
                return; 
            }

            transcript = transcript.replace(/[^\u0D00-\u0D7F\u0020-\u007Ea-zA-Z0-9\s]/g, '').trim();
            VoiceService.addLogNotification("Step 2/2: LLaMA Brain", `Input: "${transcript}"`);

            let allowedItemsReferenceList = [];
            for (const [key, category] of Object.entries(menuData)) {
                category.items.forEach(i => allowedItemsReferenceList.push(`- ${i.title} (Price: ₹${i.price})`));
            }
            const structuredReferenceText = allowedItemsReferenceList.join("\n");

            // THE MASTER PROMPT (Fixing Pasta, Cutlet Veg/Chicken, Math, and Repetitions)
            const systemPrompt = `CORE IDENTITY: You are an intelligent, natural-speaking Malayalam AI Waiter at 'Beans n Leaves'. Speak ONLY in short, native Malayalam. Do not act like a robot.

            Current Orders: ${JSON.stringify(VoiceService.conversationState.currentOrder)}
            Conversation History: ${JSON.stringify(VoiceService.conversationState.history.slice(-3))}

            Menu List: \n${structuredReferenceText}

            CRITICAL RULES (MUST FOLLOW):
            1. REPETITION & CONFIRMATION LOGIC:
               - If the user confirms an order (e.g., "ok", "take it", "ഇഡുതോളോ", "ശരി"), DO NOT repeat your previous pitch. Acknowledge it instantly: "ഓക്കേ സെറ്റ്! ഓർഡറിൽ ചേർത്തിട്ടുണ്ട്. വേറെ എന്തെങ്കിലും എടുക്കട്ടേ?".
               - ONLY add items to 'updateOrderList' if they are NEWLY requested in this turn.
            2. MENU HALLUCINATION STRICT BAN (PASTA/PIZZA ETC):
               - If a user asks for PASTA, PIZZA, SHAWARMA, ALFAHAM, or ANY item NOT in the Menu List, you MUST decline playfully: "ക്ഷമിക്കണം, സാധനം കയ്യിലില്ല! പാസ്ത/പിസ്സ ഞങ്ങളുടെ മെനുവിൽ ഇല്ല. പകരം നല്ല ഫ്രൈഡ് റൈസോ ബർഗറോ എടുത്താലോ?". NEVER say it is available.
            3. SNACKS (VEG/CHICKEN HIDDEN OPTIONS):
               - We have BOTH Veg and Chicken options for most snacks (Cutlet, Momos, Spring Roll, Samosa, Nuggets).
               - If they ask for "Cutlet" or any snack, you MUST ask: "വെജ് ആണോ അതോ ചിക്കൻ ആണോ വേണ്ടത്?".
            4. GENERAL INQUIRY ("What do you have?"):
               - If asked "മെനുവിൽ എന്തൊക്കെയുണ്ട്?", DO NOT list everything. Say: "ഞങ്ങളുടെ പക്കൽ പലതരം ബർഗർ, ഫ്രൈഡ് റൈസ്, സ്നാക്ക്സ്, ഷെയ്ക്കുകൾ എന്നിവയുണ്ട്. എന്താണ് വേണ്ടത്?".
            5. CONTEXTUAL MOVIE DIALOGUES:
               - ONLY use "അതൊരു ഒന്നൊന്നര ഓർഡർ ആയിപ്പോയി!" for HUGE orders or multiple combos. Do NOT use it for small snacks.
               - For simple items use "ഓക്കേ സെറ്റ്!".
            6. FLAWLESS FINAL BILLING:
               - When the user asks "ബിൽ", "Bill amount", summarize the items. 
               - ALWAYS use the exact string <TOTAL> when speaking the bill amount (e.g., "നിങ്ങളുടെ ആകെ തുക <TOTAL> രൂപയാണ്. Cash ആണോ UPI ആണോ?"). The system will calculate and replace <TOTAL> automatically.

            Return ONLY a raw minified JSON object:
            {
                "speechResponse": "Natural Malayalam reply (use <TOTAL> if mentioning bill sum)",
                "updateOrderList": [{"title": "Exact Menu Title", "price": "100", "quantity": 1}],
                "triggerModalItem": "Menu item title or empty string",
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

            // JAVASCRIPT MATH CALCULATOR (100% Accurate)
            let computedTotal = VoiceService.conversationState.totalBillAmount;
            if (output.updateOrderList && output.updateOrderList.length > 0) {
                // പുതിയ ഓർഡറുകൾ മെമ്മറിയിലേക്ക് ചേർക്കുന്നു
                VoiceService.conversationState.currentOrder = [...VoiceService.conversationState.currentOrder, ...output.updateOrderList];
                // ആകെ തുക കൃത്യമായി കണക്കാക്കുന്നു
                output.updateOrderList.forEach(item => {
                    computedTotal += parseInt(item.price) * (item.quantity || 1);
                });
                VoiceService.conversationState.totalBillAmount = computedTotal;
            }

            // <TOTAL> എന്ന പദം മാറ്റി കൃത്യമായ തുക നൽകുന്നു
            let finalSpeech = output.speechResponse;
            if (finalSpeech.includes("<TOTAL>")) {
                finalSpeech = finalSpeech.replace("<TOTAL>", computedTotal.toString());
            }

            VoiceService.addLogNotification("Pipeline Complete", `Reply: ${finalSpeech}`);
            VoiceService.conversationState.history.push({ user: transcript, assistant: finalSpeech });

            // സ്പീച്ച് എഞ്ചിൻ
            if (finalSpeech) {
                const u = new SpeechSynthesisUtterance(finalSpeech);
                u.lang = 'ml-IN';
                u.rate = 0.95; 
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
