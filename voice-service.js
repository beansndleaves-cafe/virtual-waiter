// voice-service.js - Consolidated Groq Speech-to-Intent Module (Barge-In & Native Fix)
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    systemLogsCollection: [],
    
    // Persistent Multi-Turn Session Memory Node
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
        
        card.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="font-black uppercase tracking-wider text-[10px] ${isError ? 'text-red-400' : 'text-yellow-500'}">${title}</span>
                <span class="text-[9px] text-white/30 font-bold">${timestamp}</span>
            </div>
            <p class="leading-relaxed break-words">${text}</p>
        `;
        stackContainer.appendChild(card);
        stackContainer.scrollTop = stackContainer.scrollHeight;
    },

    copyDiagnosticsToClipboard: () => {
        const textToCopy = VoiceService.systemLogsCollection.join("\n");
        navigator.clipboard.writeText(textToCopy)
            .then(() => alert("Logs copied successfully!"))
            .catch(() => alert("Clipboard block. Copy manually."));
    },
    
    toggle: async () => {
        const btn = document.getElementById('mic-assistant-btn');
        const overlay = document.getElementById('voice-diagnostic-overlay');
        
        // BARGE-IN TRIGGER: എഐ സംസാരിച്ചുകൊണ്ടിരിക്കുമ്പോൾ മൈക്ക് ഓൺ ചെയ്താൽ ഉടനടി സംസാരം നിർത്തുന്നു
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            VoiceService.addLogNotification("Barge-In", "AI Waiter conversation stream cancelled by user capture request.");
        }

        if (!VoiceService.active) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                VoiceService.recorder = new MediaRecorder(stream);
                VoiceService.chunks = [];
                
                VoiceService.recorder.ondataavailable = e => {
                    if (e.data && e.data.size > 0) VoiceService.chunks.push(e.data);
                };
                
                VoiceService.recorder.onstop = async () => {
                    await VoiceService.process(new Blob(VoiceService.chunks, { type: 'audio/webm' }));
                };
                
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (SpeechRecognition) {
                    VoiceService.liveRecognizer = new SpeechRecognition();
                    VoiceService.liveRecognizer.continuous = true;
                    VoiceService.liveRecognizer.interimResults = true;
                    VoiceService.liveRecognizer.lang = 'ml-IN'; 
                    
                    VoiceService.liveRecognizer.onresult = (event) => {
                        let text = '';
                        for (let i = event.resultIndex; i < event.results.length; ++i) {
                            text += event.results[i][0].transcript;
                        }
                        const previewNode = document.getElementById('voice-live-preview-box');
                        if (previewNode) previewNode.innerText = text || "കേൾക്കുന്നു...";
                    };
                    VoiceService.liveRecognizer.start();
                }
                
                VoiceService.recorder.start(250);
                VoiceService.active = true;
                
                // Fixed Button State Handler to completely prevent button freeze bugs
                if(btn) {
                    btn.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
                    btn.style.color = "rgba(239, 68, 68, 1)";
                    btn.style.borderColor = "rgba(239, 68, 68, 0.4)";
                }
                overlay?.classList.remove('hidden');
                document.getElementById('voice-live-preview-box').innerText = "സംസാരിക്കൂ...";
                VoiceService.addLogNotification("Mic Status", "Audio hardware recording pipeline tracking active.");
            } catch (e) { 
                alert("Microphone integration failed: " + e.message); 
            }
        } else {
            VoiceService.active = false;
            if(btn) {
                btn.style.backgroundColor = "rgba(234, 179, 8, 0.05)";
                btn.style.color = "rgba(234, 179, 8, 1)";
                btn.style.borderColor = "rgba(234, 179, 8, 0.2)";
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
            
            if (!res.ok) throw new Error(`Groq Whisper Failure: Received HTTP ${res.status}`);
            const data = await res.json();
            let transcript = data.text;
            
            if (!transcript || transcript.trim() === "" || transcript.trim() === "?") {
                VoiceService.addLogNotification("Groq Alert", "Audio segment resolved to zero data tracking blocks.", true);
                return;
            }

            transcript = transcript.replace(/[^\u0D00-\u0D7F\u0020-\u007Ea-zA-Z0-9\s?,.]/g, '').trim();
            VoiceService.addLogNotification("Step 2/2: LLaMA Brain", `Transcript Input: "${transcript}"`);

            let allowedItemsReferenceList = [];
            for (const [key, category] of Object.entries(menuData)) {
                category.items.forEach(i => allowedItemsReferenceList.push(`- ${i.title} (വില: ₹${i.price})`));
            }
            const structuredReferenceText = allowedItemsReferenceList.join("\n");

            // തനി നാടൻ കേരളീയ വെയിറ്റർ ശൈലിയിലേക്ക് റീ-ട്യൂൺ ചെയ്ത പുതിയ ഇൻസ്ട്രക്ഷൻ സെറ്റ്
            const systemPrompt = `CORE IDENTITY PROTOCOL: You are a friendly, welcoming native human waiter named 'Beans n Leaves AI Waiter' at a high-end dark-themed cafe in Kerala. Speak ONLY in highly fluent, natural, and warm local restaurant spoken Malayalam dialect. Avoid formal, literal dictionary translations.

            Current Active Customer Orders: ${JSON.stringify(VoiceService.conversationState.currentOrder)}
            Conversation History Context: ${JSON.stringify(VoiceService.conversationState.history.slice(-4))}

            Menu List Directory Reference (ONLY match items from here):
            ${structuredReferenceText}

            DIALECT ACCURACY RULES FOR WEB SPEECH SYNTHESIS:
            - Never use textbook machine words like "ആഹാരം", "ആഗ്രഹം", "ലഭ്യമാണ്", "സ്വീകരിച്ചു", "മാർഗ്ഗം", "ലഭ്യമാക്കുക".
            - Use natural human alternative words like "കഴിക്കാനായിട്ട്", "വേണം", "എടുത്തുതരാം", "ബിൽ തുക", "ക്യുആർ കോഡ്".
            - Output spelling must be clean and standard so the device engine doesn't stutter (e.g. use "വേണോ?" instead of "വേണംവോ?", "ലഭ്യമാണ്" expressions must be replaced with "ഉണ്ട്").

            CONVERSATIONAL AND UP-SELLING STRATEGY:
            1. Generalized Requests (e.g., "ഷെയ്ക്ക് വേണം"): Reply naturally: "ഞങ്ങളുടെ അടുത്ത് Oreo Shake, Nutella Shake, Sharjah Shake എന്നിവയുണ്ട്. ഇതിൽ ഏതാ ഇപ്പൊ എടുത്തു തേണ്ടത്?". Never pick automatically.
            2. Smart Upselling Multipliers: When they pick an item, recommend a matching drink or side. (e.g., if they order a Burger, say: "തീർച്ചയായും, അതിന്റെ കൂടെ കഴിക്കാൻ നല്ല ക്രിസ്പി ഫ്രെഞ്ച് ഫ്രൈസോ അല്ലെങ്കിൽ കുടിക്കാൻ ഒരു കോൾഡ് കോഫിയോ കൂടി എടുക്കട്ടേ?").
            3. Order Finalization ("മതി", "ബിൽ എത്രയായി?"): Recite all items in their current order back to them, state the final bill total amount clearly in Malayalam words/numbers, and ask if they prefer paying via UPI or Cash. If UPI, state that you are displaying the payment QR code and set "showQRCode" to true.

            Return ONLY a raw minified JSON object with keys 'speechResponse', 'updateOrderList', 'triggerModalItem', 'totalBillAmount', 'showQRCode':
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
                        { role: "system", content: "You output single, valid, flat JSON data objects matching requested properties exactly. Never write markdown fencing or text wrappers." },
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
            
            VoiceService.conversationState.history.push({ user: transcript, assistant: output.speechResponse });
            if (output.updateOrderList && output.updateOrderList.length > 0) {
                VoiceService.conversationState.currentOrder = output.updateOrderList;
            }
            if (output.totalBillAmount) {
                VoiceService.conversationState.totalBillAmount = output.totalBillAmount;
            }

            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                u.rate = 0.95; 
                window.speechSynthesis.speak(u);
            }
            
            if (output.triggerModalItem && output.triggerModalItem !== "" && typeof window.openItemModalFallback === 'function') {
                window.openItemModalFallback(output.triggerModalItem, output.totalBillAmount);
            }
        } catch (err) {
            console.error(err);
            VoiceService.addLogNotification("Pipeline Failure", err.message, true);
        }
    }
};
