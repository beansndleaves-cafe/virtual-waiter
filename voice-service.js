// voice-service.js - Serverless Voice AI Engine with Multi-Layer Log Stack
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
                        if (previewNode) previewNode.innerText = text || "ക്യാപ്ചർ ചെയ്യുന്നു (Listening)...";
                    };
                    VoiceService.liveRecognizer.start();
                }
                
                VoiceService.recorder.start(250);
                VoiceService.active = true;
                
                btn?.classList.add('bg-red-500/20', 'text-red-500', 'border-red-500/40');
                overlay?.classList.remove('hidden');
                document.getElementById('voice-live-preview-box').innerText = "Speak now...";
                VoiceService.addLogNotification("Mic Status", "Hardware recording layer open.");
            } catch (e) { 
                alert("Microphone capture permission error: " + e.message); 
            }
        } else {
            VoiceService.active = false;
            btn?.classList.remove('bg-red-500/20', 'text-red-500', 'border-red-500/40');
            
            if (VoiceService.liveRecognizer) VoiceService.liveRecognizer.stop();
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") {
                VoiceService.recorder.stop();
                VoiceService.addLogNotification("Mic Status", "Recording closed. Packing blob payload...");
            }
        }
    },

    process: async (blob) => {
        const groq = localStorage.getItem('beans_token_groq');
        const gemini = localStorage.getItem('beans_token_gemini');
        
        if (!groq || !gemini) {
            VoiceService.addLogNotification("Error", "Missing API tokens in configuration layers.", true);
            return;
        }

        try {
            VoiceService.addLogNotification("Step 1/3", "Uploading audio stream to Groq Whisper...");
            const fd = new FormData();
            fd.append('file', blob, 'audio.webm');
            fd.append('model', 'whisper-large-v3');
            
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groq}` },
                body: fd
            });
            
            if (!res.ok) throw new Error(`Groq STT Failed: HTTP ${res.status}`);
            const data = await res.json();
            const transcript = data.text;
            
            if (!transcript || transcript.trim() === "") {
                VoiceService.addLogNotification("Groq Complete", "No readable text transcribed.", true);
                return;
            }

            VoiceService.addLogNotification("Step 2/3", `Groq Transcribed Text: "${transcript}"`);

            const systemPrompt = `CRITICAL LANGUAGE ASSIGNMENT: Interpret this spoken phrasing ONLY as Malayalam script or Manglish phrasing (mix of Malayalam and English words). Treat any phonetic sequence exclusively under Malayalam semantics. Target Input Phrase: "${transcript}". Find a matched item on our menu directory. Return ONLY a single flat JSON object with no markdown fences, no formatting decorators, no commentary text. Format exactly: {"matched": true, "itemName": "Item Title Here", "price": "100", "speechResponse": "Malayalam script confirmation feedback message"}`;

            // Fixed Endpoint URL Syntax Rule - Appends /models/ before model name
            const geminiTargetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemini}`;

            const gemRes = await fetch(geminiTargetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });
            
            if (!gemRes.ok) throw new Error(`Gemini Endpoint Fault: HTTP ${gemRes.status}`);
            const gemData = await gemRes.json();
            
            let cleanText = gemData.candidates[0].content.parts[0].text;
            cleanText = cleanText.replace(/```json|```/g, '').trim();
            const output = JSON.parse(cleanText);

            VoiceService.addLogNotification("Step 3/3", `Gemini matched item profile successfully.`);
            
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
            VoiceService.addLogNotification("Pipeline Error", err.message, true);
        }
    }
};
