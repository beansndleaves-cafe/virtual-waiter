// voice-service.js - Serverless Voice AI Engine with Live Diagnostics
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    
    updateStatus: (title, subtitle) => {
        const titleEl = document.getElementById('voice-toast-title');
        const subEl = document.getElementById('voice-toast-sub');
        if (titleEl) titleEl.innerText = title;
        if (subEl) subEl.innerText = subtitle;
    },
    
    toggle: async () => {
        const btn = document.getElementById('mic-assistant-btn');
        const toast = document.getElementById('voice-status-toast');
        
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
                
                // Initialize Live Real-time Speech Preview
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (SpeechRecognition) {
                    VoiceService.liveRecognizer = new SpeechRecognition();
                    VoiceService.liveRecognizer.continuous = true;
                    VoiceService.liveRecognizer.interimResults = true;
                    VoiceService.liveRecognizer.lang = 'ml-IN'; // Default to Malayalam listening
                    
                    VoiceService.liveRecognizer.onresult = (event) => {
                        let interimTranscript = '';
                        for (let i = event.resultIndex; i < event.results.length; ++i) {
                            interimTranscript += event.results[i][0].transcript;
                        }
                        VoiceService.updateStatus("Listening Live...", interimTranscript || "Siri-style capturing...");
                    };
                    VoiceService.liveRecognizer.start();
                }
                
                VoiceService.recorder.start(250);
                VoiceService.active = true;
                
                btn?.classList.add('bg-red-500/20', 'text-red-500', 'border-red-500/40');
                toast?.classList.remove('hidden');
                VoiceService.updateStatus("Listening...", "Speak now / എന്താണ് വേണ്ടതെന്ന് പറയൂ...");
            } catch (e) { 
                alert("Microphone hardware connection error: " + e.message); 
            }
        } else {
            VoiceService.active = false;
            btn?.classList.remove('bg-red-500/20', 'text-red-500', 'border-red-500/40');
            
            if (VoiceService.liveRecognizer) {
                VoiceService.liveRecognizer.stop();
            }
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") {
                VoiceService.recorder.stop();
                VoiceService.updateStatus("Processing...", "Sending voice data to Groq Cloud...");
            } else {
                toast?.classList.add('hidden');
            }
        }
    },

    process: async (blob) => {
        const toast = document.getElementById('voice-status-toast');
        const groq = localStorage.getItem('beans_token_groq');
        const gemini = localStorage.getItem('beans_token_gemini');
        
        if (!groq || !gemini) {
            VoiceService.updateStatus("Error", "Missing API tokens in configuration layers.");
            setTimeout(() => toast?.classList.add('hidden'), 4000);
            return;
        }

        try {
            VoiceService.updateStatus("Step 1/3: Groq STT", "Uploading audio payload...");
            const fd = new FormData();
            fd.append('file', blob, 'audio.webm');
            fd.append('model', 'whisper-large-v3');
            
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groq}` },
                body: fd
            });
            
            if (!res.ok) throw new Error(`Groq HTTP Error ${res.status}`);
            const transcriptData = await res.json();
            const transcript = transcriptData.text;
            
            if (!transcript || transcript.trim() === "") {
                VoiceService.updateStatus("Empty Audio", "No speech detected. Try again.");
                setTimeout(() => toast?.classList.add('hidden'), 2000);
                return;
            }

            VoiceService.updateStatus("Step 2/3: Gemini AI", `Matching transcript: "${transcript}"`);

            const systemPrompt = `Analyze this spoken Malayalam order: "${transcript}". Find matching menu items. Return a single strict JSON object only, no markdown formatting blocks, no extra words. Format exactly like this: {"matched": true, "itemName": "Item Title Here", "price": "100", "speechResponse": "Malayalam text confirmation"}`;

            const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemini}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });
            
            if (!gemRes.ok) throw new Error(`Gemini HTTP Error ${gemRes.status}`);
            const gemData = await gemRes.json();
            let cleanText = gemData.candidates[0].content.parts[0].text;
            
            cleanText = cleanText.replace(/```json|```/g, '').trim();
            const output = JSON.parse(cleanText);

            VoiceService.updateStatus("Step 3/3: Completed", "Spitting response structures...");
            
            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                window.speechSynthesis.speak(u);
            }
            
            if (output.matched && typeof window.openItemModalFallback === 'function') {
                window.openItemModalFallback(output.itemName, output.price);
            }
            
            // Hide dashboard smoothly after success
            setTimeout(() => toast?.classList.add('hidden'), 1500);
        } catch (err) {
            console.error(err);
            VoiceService.updateStatus("Pipeline Failed", err.message);
            // Leave the message open longer on screen so you can read the error text on your tablet
            setTimeout(() => toast?.classList.add('hidden'), 6000);
        }
    }
};
