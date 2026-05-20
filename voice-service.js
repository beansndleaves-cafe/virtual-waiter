// voice-service.js - Direct-Decoded Multi-Turn Interactive Malayalam AI Waiter Engine
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    systemLogsCollection: [],
    
    // Multi-Turn State Management Node
    conversationState: {
        currentOrder: [], // കസ്റ്റമർ പറയുന്ന എല്ലാ വിഭവങ്ങളും ഓർത്തു വെയ്ക്കാൻ
        paymentMethod: null,
        step: "ordering" // ordering, confirming, payment
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
                        if (previewNode) previewNode.innerText = text || "കേൾക്കുന്നു (Listening)...";
                    };
                    VoiceService.liveRecognizer.start();
                }
                VoiceService.recorder.start(250);
                VoiceService.active = true;
                btn?.classList.add('bg-red-500/20', 'text-red-500', 'border-red-500/40');
                overlay?.classList.remove('hidden');
                VoiceService.addLogNotification("Mic Status", "AI Waiter listening stream opened.");
            } catch (e) { alert("Microphone failed: " + e.message); }
        } else {
            VoiceService.active = false;
            btn?.classList.remove('bg-red-500/20', 'text-red-500', 'border-red-500/40');
            if (VoiceService.liveRecognizer) VoiceService.liveRecognizer.stop();
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") { VoiceService.recorder.stop(); }
        }
    },

    process: async (blob) => {
        if (typeof BEANS_STATIC_GROQ === 'undefined' || BEANS_STATIC_GROQ.includes("YOUR_BASE64")) {
            VoiceService.addLogNotification("Error", "API keys are missing in menu-data.js constants.", true);
            return;
        }
        const groqDecoded = atob(BEANS_STATIC_GROQ).trim();

        try {
            VoiceService.addLogNotification("Step 1/2: Whisper STT", "Processing voice audio data via Groq...");
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

            // Updated Sanitizer: ചിഹ്നങ്ങൾ മാത്രം മാറ്റുന്നു, മലയാളം വാക്കുകളെ പൂർണ്ണമായി നിലനിർത്തുന്നു
            transcript = transcript.replace(/[^\u0D00-\u0D7F\u0020-\u007Ea-zA-Z0-9\s?,.]/g, '').trim();
            VoiceService.addLogNotification("Step 2/2: LLaMA Brain", `Transcript Input: "${transcript}"`);

            // ബിൽഡ് അപ്പ് മെനു ഡാറ്റ ഫോർമാറ്റ്
            let allowedItemsReferenceList = [];
            for (const [key, category] of Object.entries(menuData)) {
                category.items.forEach(i => allowedItemsReferenceList.push(`- ${i.title} (വില: ₹${i.price}, കാറ്റഗറി: ${category.name})`));
            }
            const structuredReferenceText = allowedItemsReferenceList.join("\n");

            // FLUENT MALAYALAM RESTAURANT WAITER INTELLIGENCE PROMPT
            const systemPrompt = `നിങ്ങൾ 'Beans n Leaves' റസ്റ്റോറന്റിലെ വളരെ സ്മാർട്ടും വിനീതനുമായ ഒരു ഒരു മലയാളി എഐ വെയിറ്റർ (AI Waiter) ആണ്. കസ്റ്റമറോട് വളരെ ശുദ്ധമായ മലയാളത്തിൽ മാത്രമേ സംസാരിക്കാവൂ. കസ്റ്റമറുടെ നിലവിലെ ഓർഡർ വിവരങ്ങൾ: ${JSON.stringify(VoiceService.conversationState.currentOrder)}.
            
            റസ്റ്റോറന്റ് മെനു ലിസ്റ്റ് ഇതാണ്:
            ${structuredReferenceText}

            കർശനമായ നിയമങ്ങൾ:
            1. കസ്റ്റമർ "ഷെയ്ക്ക് വേണം" എന്ന് പൊതുവായി പറഞ്ഞാൽ, നേരിട്ട് ഓർഡർ എടുക്കരുത്! മെനുവിലുള്ള Oreo Shake, Nutella Shake, Sharjah Shake എന്നിവയിൽ ഏതാണ് വേണ്ടതെന്ന് തിരിച്ചു ചോദിക്കുക.
            2. കസ്റ്റമർ ഒരു വിഭവം ഓർഡർ ചെയ്താൽ, അതിനൊപ്പം കഴിക്കാൻ പറ്റിയ മറ്റൊരു നല്ല വിഭവം സജസ്റ്റ് ചെയ്യുക (ഉദാഹരണം: ചിക്കൻ ബർഗർ ഓർഡർ ചെയ്താൽ ഫ്രെഞ്ച് ഫ്രൈസോ അല്ലെങ്കിൽ ഒരു കോൾഡ് കോഫിയോ കൂടി വേണോ എന്ന് ചോദിക്കുക). കൂടുതൽ ബിസിനസ്സ് കൊണ്ടുവരിക.
            3. ഓർഡർ പൂർത്തിയാക്കാൻ കസ്റ്റമർ ആവശ്യപ്പെടുമ്പോൾ (ബിൽ തരൂ / അത്രയും മതി എന്ന് പറയുമ്പോൾ), ടോട്ടൽ തുക (Total Amount) കണക്കുകൂട്ടി പറയുക. തുടർന്ന് പേയ്‌മെന്റ് രീതി UPI ആണോ അതോ Cash ആണോ എന്ന് ചോദിക്കുക. UPI ആണെങ്കിൽ ഭാവിയിൽ കാണിക്കാൻ പാകത്തിന് QR കോഡ് അപ്ഡേറ്റ് ചെയ്യുക.
            4. മെനുവിൽ ഇല്ലാത്ത ഒരു സാധനവും (ഉദാഹരണത്തിന് മീൻ ഫ്രൈ, ബീഫ്) ഓർഡർ എടുക്കാൻ പാടില്ല.
            
            മറുപടി എപ്പോഴും ഒരു RAW JSON ഒബ്ജക്റ്റ് മാത്രമായിരിക്കണം (No Markdown, No Backticks). ഫോർമാറ്റ് കൃത്യമായി താഴെ പറയുന്ന രീതിയിലായിരിക്കണം:
            {
                "speechResponse": "കസ്റ്റമറോട് തിരിച്ചു പറയേണ്ട മറുപടി മലയാളം ലിപിയിൽ ഇവിടെ എഴുതുക",
                "updateOrderList": [{"title": "Exact Item Title", "price": "100", "quantity": 1}], 
                "triggerModalItem": "കസ്റ്റമർ ഓർഡർ ചെയ്ത കൃത്യമായ ഇനത്തിന്റെ പേര് മാത്രം (ഇല്ലെങ്കിൽ ശൂന്യമായി വെക്കുക)",
                "totalBillAmount": "ഇതുവരെയുള്ള മൊത്തം ബിൽ തുക",
                "showQRCode": false
            }`;

            const groqChatUrl = 'https://api.groq.com/openai/v1/chat/completions';
            const chatRes = await fetch(groqChatUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqDecoded}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You output single, valid, flat JSON data objects with keys 'speechResponse', 'updateOrderList', 'triggerModalItem', 'totalBillAmount', 'showQRCode'. Never write markdown ticks or text fences." },
                        { role: "user", content: `കസ്റ്റമർ പറഞ്ഞത്: "${transcript}"\n\nനിർദ്ദേശങ്ങൾ അതനുസരിച്ച് നടപ്പിലാക്കുക.` + "\n" + systemPrompt }
                    ],
                    temperature: 0.2,
                    response_format: { type: "json_object" }
                })
            });

            if (!chatRes.ok) throw new Error(`Groq LLaMA Error: HTTP ${chatRes.status}`);
            const chatData = await chatRes.json();
            const cleanText = chatData.choices[0].message.content.trim();
            const output = JSON.parse(cleanText);

            VoiceService.addLogNotification("Pipeline Complete", JSON.stringify(output));
            
            // സ്റ്റേറ്റ് അപ്‌ഡേറ്റ് മെക്കാനിസം (ഓർഡറുകൾ മെമ്മറിയിൽ സൂക്ഷിക്കുന്നു)
            if (output.updateOrderList && output.updateOrderList.length > 0) {
                VoiceService.conversationState.currentOrder = output.updateOrderList;
            }

            // ഓഡിയോ ഫീഡ്‌ബാക്ക് ജനറേഷൻ
            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                window.speechSynthesis.speak(u);
            }
            
            // മോഡൽ പോപ്പ്-അപ്പ് വിൻഡോ ട്രിഗർ
            if (output.triggerModalItem && output.triggerModalItem !== "" && typeof window.openItemModalFallback === 'function') {
                window.openItemModalFallback(output.triggerModalItem, output.totalBillAmount);
            }

            // ഭാവിയിലേക്കുള്ള UPI QR കോഡ് ഇന്റഗ്രേഷൻ ഗാർഡ്
            if (output.showQRCode) {
                VoiceService.addLogNotification("Payment Node", "UPI Payment Triggered. Displaying Simulated Barcode.");
                // ഭാവിയിൽ ഇവിടെ QR കോഡ് ഡിസ്‌പ്ലേ ലോജിക് ചേർക്കാം
            }
        } catch (err) {
            console.error(err);
            VoiceService.addLogNotification("Pipeline Failure", err.message, true);
        }
    }
};
