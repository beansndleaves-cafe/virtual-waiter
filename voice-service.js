// voice-service.js - Serverless Voice AI Engine (Malayalam Intent Layer)
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    
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
                    const blob = new Blob(VoiceService.chunks, { type: 'audio/webm' });
                    await VoiceService.process(blob);
                };
                
                VoiceService.recorder.start(250); // Slice data smoothly every 250ms
                VoiceService.active = true;
                
                // Mirror design philosophy accent highlighting colors securely
                btn?.classList.add('bg-red-500/20', 'text-red-500', 'border-red-500/40');
                toast?.classList.remove('hidden');
            } catch (e) { 
                alert("Microphone hardware access denied or missing!"); 
            }
        } else {
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") {
                VoiceService.recorder.stop();
            }
            VoiceService.active = false;
            btn?.classList.remove('bg-red-500/20', 'text-red-500', 'border-red-500/40');
            toast?.classList.add('hidden');
        }
    },

    process: async (blob) => {
        const groq = localStorage.getItem('beans_token_groq');
        const gemini = localStorage.getItem('beans_token_gemini');
        if (!groq || !gemini) return alert("API keys are not ready. Check obfuscation configuration.");

        try {
            const fd = new FormData();
            fd.append('file', blob, 'audio.webm');
            fd.append('model', 'whisper-large-v3');
            
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groq}` },
                body: fd
            });
            
            if (!res.ok) throw new Error(`Groq API returned error status: ${res.status}`);
            const transcriptData = await res.json();
            const transcript = transcriptData.text;
            if (!transcript || transcript.trim() === "") return;

            // Strict instruction protocol forcing Gemini to return pure parseable JSON
            const systemPrompt = `Analyze this spoken Malayalam order: "${transcript}". Find matching menu items. Return a single strict JSON object only, no markdown formatting blocks, no extra words. Format exactly like this: {"matched": true, "itemName": "Item Title Here", "price": "100", "speechResponse": "Malayalam text confirmation"}`;

            const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemini}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });
            
            if (!gemRes.ok) throw new Error(`Gemini API returned error status: ${gemRes.status}`);
            const gemData = await gemRes.json();
            let cleanText = gemData.candidates[0].content.parts[0].text;
            
            // Clean markdown wraps safely if Gemini forces them down the stream
            cleanText = cleanText.replace(/```json|```/g, '').trim();
            const output = JSON.parse(cleanText);

            // Execute native speech feedback instantly 
            if (output.speechResponse) {
                const u = new SpeechSynthesisUtterance(output.speechResponse);
                u.lang = 'ml-IN';
                window.speechSynthesis.speak(u);
            }
            
            // Safe execution across modules using loose matching bounds
            if (output.matched && typeof window.openItemModalFallback === 'function') {
                window.openItemModalFallback(output.itemName, output.price);
            }
        } catch (err) {
            console.error("Serverless Core Voice Processing Error: ", err);
        }
    }
};
