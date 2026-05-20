// voice-service.js - Direct-Decoded Serverless Voice Engine with Strict Menu Clamping
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    systemLogsCollection: [],
    
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
                        if (previewNode) previewNode.innerText = text || "Capturing speech...";
                    };
                    VoiceService.liveRecognizer.start();
                }
                
                VoiceService.recorder.start(250);
                VoiceService.active = true;
                
                btn?.classList.add('bg-red-500/20', 'text-red-500', 'border-red-500/40');
                overlay?.classList.remove('hidden');
                document.getElementById('voice-live-preview-box').innerText = "Speak now...";
                VoiceService.addLogNotification("Mic Status", "Recording pipeline initialized.");
            } catch (e) { 
                alert("Microphone connection failed: " + e.message); 
            }
        } else {
            VoiceService.active = false;
            btn?.classList.remove('bg-red-500/20', 'text-red-500', 'border-red-500/40');
            
            if (VoiceService.liveRecognizer) VoiceService.liveRecognizer.stop();
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") {
                VoiceService.recorder.stop();
                VoiceService.addLogNotification("Mic Status", "Audio segment closed.");
            }
        }
    },

    process: async (blob) => {
        if (typeof BEANS_STATIC_GROQ === 'undefined' || BEANS_STATIC_GROQ.includes("YOUR_BASE64")) {
            VoiceService.addLogNotification("Configuration Error", "Paste your fresh raw Groq key into menu-data.js.", true);
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
            
            if (!res.ok) throw new Error(`Groq Whisper Failure: Received HTTP ${res.status}`);
            const data = await res.json();
            let transcript = data.text;
            
            if (!transcript || transcript.trim() === "") {
                VoiceService.addLogNotification("Groq Alert", "Audio stream resolved to empty data blocks.", true);
                return;
            }

            // CRITICAL LINGUISTIC SANITIZER LAYER: Filters out non-Malayalam/non-English script characters (like Gurmukhi/Punjabi)
            transcript = transcript.replace(/[^\u0D00-\u0D7F\u0020-\u007E]/g, '').trim();
            if (transcript === "") {
                VoiceService.addLogNotification("Sanitizer Alert", "Filtered ambiguous cross-language character sets.", true);
                return;
            }

            VoiceService.addLogNotification("Step 2/2: LLaMA Intent", `Sanitized Phrasing: "${transcript}"`);

            // Compile a strict, minified text index of allowed menu entries directly from your array database
            let allowedItemsReferenceList = [];
            for (const [key, category] of Object.entries(menuData)) {
                category.items.forEach(i => allowedItemsReferenceList.push(`- ${i.title} (Price: ₹${i.price})`));
            }
            const structuredReferenceText = allowedItemsReferenceList.join("\n");

            // Reinforced System Instruction clamping prompt completely stopping model hallucinations
            const systemPrompt = `SYSTEM OPERATIONAL DIRECTIVE: You are an intent matching agent for a serverless food system. You analyze spoken user audio text written in phonetic Malayalam or casual Manglish. 
            
            CRITICAL BOUNDARY RULE: You can ONLY match items that are explicitly found in this menu list. Do not hallucinate or create items (e.g. do not match fish fry, beef, or any dish not listed below):
            ${structuredReferenceText}

            CONVERSATIONAL LIST PROTOCOL: If the user query is asking to see the menu, recite options, or asking what is available (e.g., "menu enthokke und", "what do you have", "recite menu"), you must return: {"matched": false, "itemName": "", "price": "0", "speechResponse": "ഞങ്ങളുടെ മെനുവിൽ ബണ്ടിലുകൾ, ക്വിക്ക് ബൈറ്റ്സ്, സൂപ്പുകൾ, റൈസ്, നൂഡിൽസ്, ഷെയ്ക്കുകൾ, ഫ്രഷ് ജ്യൂസുകൾ എന്നിവ ലഭ്യമാണ്. മുഴുവൻ കാണാൻ മെനു ബട്ടൺ അമർത്തുക."}

            For standard food item order intents, return a raw flat JSON object matching this schema layout structure exactly: 
            {"matched": true, "itemName": "Exact Item Title from List", "price": "Item Price from List", "speechResponse": "Short order confirmation statement written in clean Malayalam script"}
            
            If the user text doesn't clearly match any listed item, return {"matched": false, "itemName": "", "price": "0", "speechResponse": "ക്ഷമിക്കണം, നിങ്ങൾ പറഞ്ഞ ഇനം ഞങ്ങളുടെ മെനുവിൽ കണ്ടെത്താനായില്ല."}`;

            const groqChatUrl = 'https://api.groq.com/openai/v1/chat/completions';
            const chatRes = await fetch(groqChatUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqDecoded}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You output single, valid, flat minified JSON data blocks matching requested properties exactly. Never write markdown symbols, code block ticks, or comments." },
                        { role: "user", content: `User Voice Input Phrase: "${transcript}"\n\nInstructions:\n${systemPrompt}` }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" } 
                })
            });

            if (!chatRes.ok) throw new Error(`Groq LLaMA Engine Error: Received HTTP ${chatRes.status}`);
            const chatData = await chatRes.json();
            const cleanText = chatData.choices[0].message.content.trim();
            
            const output = JSON.parse(cleanText);
            VoiceService.addLogNotification("Pipeline Complete", `Action result: ${JSON.stringify(output)}`);
            
            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                window.speechSynthesis.speak(u);
            }
            
            if (output.matched && output.itemName !== "" && typeof window.openItemModalFallback === 'function') {
                window.openItemModalFallback(output.itemName, output.price);
            }
        } catch (err) {
            console.error(err);
            VoiceService.addLogNotification("Pipeline Failure", err.message, true);
        }
    }
};
