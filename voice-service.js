// voice-service.js - Serverless Voice AI Engine with Multi-Layer Log Stack & Copy Utilities
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
            .then(() => alert("Logs copied to tablet clipboard! Paste them to Gemini."))
            .catch(() => alert("Clipboard block. Select the text inside log cards manually."));
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
                        if (previewNode) previewNode.innerText = text || "Capturing speech waveforms...";
                    };
                    VoiceService.liveRecognizer.start();
                }
                
                VoiceService.recorder.start(250);
                VoiceService.active = true;
                
                btn?.classList.add('bg-red-500/20', 'text-red-500', 'border-red-500/40');
                overlay?.classList.remove('hidden');
                document.getElementById('voice-live-preview-box').innerText = "Speak now...";
                VoiceService.addLogNotification("Mic Status", "Hardware recording tracking connection active.");
            } catch (e) { 
                alert("Microphone capture access hardware fault: " + e.message); 
            }
        } else {
            VoiceService.active = false;
            btn?.classList.remove('bg-red-500/20', 'text-red-500', 'border-red-500/40');
            
            if (VoiceService.liveRecognizer) VoiceService.liveRecognizer.stop();
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") {
                VoiceService.recorder.stop();
                VoiceService.addLogNotification("Mic Status", "Audio capture track successfully packaged.");
            }
        }
    },

    process: async (blob) => {
        const groq = localStorage.getItem('beans_token_groq');
        const gemini = localStorage.getItem('beans_token_gemini');
        
        if (!groq || !gemini) {
            VoiceService.addLogNotification("Setup Fault", "API tokens are missing from local engine context parameters.", true);
            return;
        }

        try {
            VoiceService.addLogNotification("Step 1/3", "Uploading sound payload to Groq Cloud Api...");
            const fd = new FormData();
            fd.append('file', blob, 'audio.webm');
            fd.append('model', 'whisper-large-v3');
            
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groq}` },
                body: fd
            });
            
            if (!res.ok) throw new Error(`Groq Gateway Failure: HTTP Status Code ${res.status}`);
            const data = await res.json();
            const transcript = data.text;
            
            if (!transcript || transcript.trim() === "") {
                VoiceService.addLogNotification("Groq Alert", "No speech detected in audio playback.", true);
                return;
            }

            VoiceService.addLogNotification("Step 2/3", `Groq Transcribed Text: "${transcript}"`);

            // Reinforced System Instruction clamping framework to eliminate multi-language drift bugs
            const systemPrompt = `SYSTEM PROTOCOL DESIGNATION: You are an internal processing node for an single-page digital culinary menu. The text provided is a voice transcription containing mixed spoken Malayalam or casual Manglish (Malayalam vocabulary written with English words/characters). You must strictly ignore Chinese, Telugu, Hindi, or Tamil classification rules. If the user states an order request matching a menu item profile, extract the item details. Return ONLY a single raw flat JSON object with no markdown styling backticks (do not wrap with \`\`\`json). Do not include conversational text or responses.
            Structure Schema format: {"matched": true, "itemName": "Exact Item Title String Here", "price": "100", "speechResponse": "Confirmation feedback statement written in pure Malayalam script"}`;

            // Corrected, fully functional URL REST destination string targeting models namespace sequence
            const geminiTargetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemini}`;

            const gemRes = await fetch(geminiTargetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\nUser Voice Transcript String: "${transcript}"` }] }] })
            });
            
            if (!gemRes.ok) throw new Error(`Gemini Gateway Failure: HTTP Status Code ${gemRes.status}`);
            const gemData = await gemRes.json();
            
            if (!gemData.candidates || gemData.candidates.length === 0) {
                throw new Error("Zero content generation paths returned from the model runtime node.");
            }
            
            let cleanText = gemData.candidates[0].content.parts[0].text;
            cleanText = cleanText.replace(/```json|```/g, '').trim();
            const output = JSON.parse(cleanText);

            VoiceService.addLogNotification("Step 3/3", `Gemini returned structured match: ${JSON.stringify(output)}`);
            
            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                window.speechSynthesis.speak(u);
            }
            
            if (output.matched && typeof window.openItemModalFallback === 'function') {
                window.openItemModalFallback(output.itemName, output.price);
            }
        } catch (err) {
            console.error(err);
            VoiceService.addLogNotification("Pipeline Failure", err.message, true);
        }
    }
};
