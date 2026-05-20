// voice-service.js - Serverless Voice AI Engine with Rigid Linguistic Boundaries
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    
    addLogNotification: (title, text, isError = false) => {
        const stackContainer = document.getElementById('voice-log-stack');
        if (!stackContainer) return;
        
        const card = document.createElement('div');
        card.className = `p-3 rounded-xl border text-xs font-medium backdrop-blur-md transition-all duration-300 shadow-md ${
            isError ? 'bg-red-950/90 border-red-500/40 text-red-200' : 'bg-neutral-900/90 border-yellow-500/20 text-white/90'
        }`;
        
        card.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="font-black uppercase tracking-wider text-[10px] ${isError ? 'text-red-400' : 'text-yellow-500'}">${title}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white/40 hover:text-white px-1 text-base">&times;</button>
            </div>
            <p class="leading-relaxed break-words">${text}</p>
        `;
        stackContainer.appendChild(card);
        stackContainer.scrollTop = stackContainer.scrollHeight;
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
                        if (previewNode) previewNode.innerText = text || "Capturing voice...";
                    };
                    VoiceService.liveRecognizer.start();
                }
                
                VoiceService.recorder.start(250);
                VoiceService.active = true;
                
                btn?.classList.add('bg-red-500/20', 'text-red-500', 'border-red-500/40');
                overlay?.classList.remove('hidden');
                document.getElementById('voice-live-preview-box').innerText = "Speak now...";
                VoiceService.addLogNotification("Mic Status", "Hardware recording tracking active.");
            } catch (e) { 
                alert("Microphone connection failed: " + e.message); 
            }
        } else {
            VoiceService.active = false;
            btn?.classList.remove('bg-red-500/20', 'text-red-500', 'border-red-500/40');
            
            if (VoiceService.liveRecognizer) VoiceService.liveRecognizer.stop();
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") {
                VoiceService.recorder.stop();
                VoiceService.addLogNotification("Mic Status", "Audio track packaged.");
            }
        }
    },

    process: async (blob) => {
        const groq = localStorage.getItem('beans_token_groq');
        const gemini = localStorage.getItem('beans_token_gemini');
        
        if (!groq || !gemini) {
            VoiceService.addLogNotification("Error", "API keys are missing from the configuration memory runtime.", true);
            return;
        }

        try {
            VoiceService.addLogNotification("Step 1/3", "Processing speech audio via Groq Whisper...");
            const fd = new FormData();
            fd.append('file', blob, 'audio.webm');
            fd.append('model', 'whisper-large-v3');
            
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groq}` },
                body: fd
            });
            
            if (!res.ok) throw new Error(`Groq Fault: Status ${res.status}`);
            const data = await res.json();
            const transcript = data.text;
            
            if (!transcript || transcript.trim() === "") {
                VoiceService.addLogNotification("Groq Alert", "No clear speech signals captured.", true);
                return;
            }

            VoiceService.addLogNotification("Step 2/3", `Transcribed: "${transcript}"`);

            // Reinforced Language Clamp parameters strictly chaining logic to Malayalam/Manglish semantic paths
            const systemPrompt = `SYSTEM OPERATIONAL PROTOCOL: You are the backend matching processor for a Malayalam food ordering engine. The incoming phrasing is strictly spoken Malayalam or Manglish dialect. Do not interpret it as Chinese, Telugu, Hindi, or any other language. If the phrase sounds like an item on our menu, extract it. Return ONLY a single raw flat JSON object. Do not include markdown code block syntax formatting wrappers (like \`\`\`json). Do not return extra conversation. Structure: {"matched": true, "itemName": "Item Title", "price": "100", "speechResponse": "Malayalam confirmation text in Malayalam script"}`;

            // Valid, active v1beta REST endpoint format configuration to fully drop 404 routing faults
            const geminiTargetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemini}`;

            const gemRes = await fetch(geminiTargetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\nUser Transcribed Audio Text: "${transcript}"` }] }] })
            });
            
            if (!gemRes.ok) throw new Error(`Gemini Server Error Code: ${gemRes.status}`);
            const gemData = await gemRes.json();
            
            if (!gemData.candidates || gemData.candidates.length === 0) {
                throw new Error("Zero response variants returned by model container.");
            }
            
            let cleanText = gemData.candidates[0].content.parts[0].text;
            cleanText = cleanText.replace(/```json|```/g, '').trim();
            const output = JSON.parse(cleanText);

            VoiceService.addLogNotification("Step 3/3", `Gemini response parsed cleanly.`);
            
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
