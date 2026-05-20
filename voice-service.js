// voice-service.js - Serverless Voice AI Engine (Malayalam Intent Layer)
const VoiceService = {
    active: false,
    recorder: null,
    
    toggle: async () => {
        const btn = document.getElementById('mic-assistant-btn');
        const toast = document.getElementById('voice-status-toast');
        if (!VoiceService.active) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                VoiceService.recorder = new MediaRecorder(stream);
                let chunks = [];
                VoiceService.recorder.ondataavailable = e => chunks.push(e.data);
                VoiceService.recorder.onstop = async () => {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    await VoiceService.process(blob);
                };
                VoiceService.recorder.start();
                VoiceService.active = true;
                btn?.classList.add('bg-red-500/20', 'text-red-500');
                toast?.classList.remove('hidden');
            } catch (e) { alert("Mic access denied!"); }
        } else {
            VoiceService.recorder.stop();
            VoiceService.active = false;
            btn?.classList.remove('bg-red-500/20', 'text-red-500');
            toast?.classList.add('hidden');
        }
    },

    process: async (blob) => {
        const groq = localStorage.getItem('beans_token_groq');
        const gemini = localStorage.getItem('beans_token_gemini');
        if (!groq || !gemini) return alert("Configure API keys in Settings first.");

        try {
            const fd = new FormData();
            fd.append('file', blob, 'audio.webm');
            fd.append('model', 'whisper-large-v3');
            
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groq}` },
                body: fd
            });
            const transcript = (await res.json()).text;

            const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemini}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `Analyze order: "${transcript}". Matches menu items. Return JSON: {"matched": true, "itemName": "Item Name", "price": "100", "speechResponse": "Malayalam confirmation text"}` }] }] })
            });
            const gemData = await gemRes.json();
            const cleanText = gemData.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            const output = JSON.parse(cleanText);

            const u = new SpeechSynthesisUtterance(output.speechResponse);
            u.lang = 'ml-IN';
            window.speechSynthesis.speak(u);
            
            if (output.matched && typeof openItemModal === 'function') {
                openItemModal(output.itemName, "", output.price, "");
            }
        } catch (err) {
            console.error("Voice Processing Error: ", err);
        }
    }
};
