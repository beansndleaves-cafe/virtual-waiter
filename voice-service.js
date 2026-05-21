// voice-service.js - Production-Ready Flawless Malayalam AI Waiter Engine
const VoiceService = {
    active: false,
    recorder: null,
    chunks: [],
    liveRecognizer: null,
    systemLogsCollection: [],
    
    conversationState: { currentOrder: [], history: [], totalBillAmount: 0 },
    
    addLogNotification: (title, text, isError = false) => {
        const timestamp = new Date().toLocaleTimeString();
        VoiceService.systemLogsCollection.push(`[${timestamp}] ${title.toUpperCase()}: ${text}`);
        const stackContainer = document.getElementById('voice-log-stack');
        if (!stackContainer) return;
        const card = document.createElement('div');
        card.className = `p-3 rounded-xl border text-xs font-medium backdrop-blur-md ${isError ? 'bg-red-950/90 border-red-500/40 text-red-200' : 'bg-neutral-900/90 border-yellow-500/20 text-white/90'}`;
        card.innerHTML = `<div class="flex justify-between items-center mb-1"><span class="font-black uppercase text-[10px] ${isError ? 'text-red-400' : 'text-yellow-500'}">${title}</span></div><p class="break-words">${text}</p>`;
        stackContainer.appendChild(card);
        stackContainer.scrollTop = stackContainer.scrollHeight;
    },
    
    toggle: async () => {
        const btn = document.getElementById('mic-assistant-btn');
        if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel();

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
                btn?.classList.add('animate-pulse');
            } catch (e) { alert("Mic Error: " + e.message); }
        } else {
            VoiceService.active = false;
            btn?.classList.remove('animate-pulse');
            if (VoiceService.liveRecognizer) VoiceService.liveRecognizer.stop();
            if (VoiceService.recorder && VoiceService.recorder.state !== "inactive") VoiceService.recorder.stop();
        }
    },

    process: async (blob) => {
        const groqDecoded = atob(BEANS_STATIC_GROQ).trim();
        try {
            const fd = new FormData();
            fd.append('file', blob, 'audio.webm');
            fd.append('model', 'whisper-large-v3');
            fd.append('language', 'ml'); 
            
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqDecoded}` },
                body: fd
            });
            const data = await res.json();
            let transcript = data.text;
            
            if (!transcript || transcript.trim().length < 2) return;
            VoiceService.addLogNotification("LLaMA Brain", `Input: "${transcript}"`);

            let allowedItems = [];
            for (const [key, category] of Object.entries(menuData)) {
                category.items.forEach(i => allowedItems.push(`- ${i.title} (Price: ${i.price})`));
            }

            const systemPrompt = `You are a native Malayalam waiter. 
            RULES:
            1. If they order an item, do not suggest other main course items. Just say "ഓക്കേ, ഓർഡറിൽ ചേർക്കാം".
            2. If they order a drink (Fresh Lime, Soda), use Lalettan dialogue: "നമുക്ക് ഓരോ നാരങ്ങാവെള്ളം കുടിച്ചാലോ?".
            3. If they ask for items not in menu (Pizza, Beef, Sandwiches), say "ക്ഷമിക്കണം, സാധനം കയ്യിലില്ല!".
            4. If they say "ബിൽ", calculate the final amount from the active list: ${JSON.stringify(VoiceService.conversationState.currentOrder)} and ask UPI or Cash.
            5. Return JSON: {"speechResponse": "Natural Malayalam", "updateOrderList": [...], "triggerModalItem": "...", "totalBillAmount": Integer, "showQRCode": false}`;

            const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqDecoded}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: transcript }],
                    temperature: 0.2,
                    response_format: { type: "json_object" }
                })
            });

            const chatData = await chatRes.json();
            const output = JSON.parse(chatData.choices[0].message.content.trim());
            
            // Logic Sync
            if (output.updateOrderList) VoiceService.conversationState.currentOrder = [...VoiceService.conversationState.currentOrder, ...output.updateOrderList];
            
            const u = new SpeechSynthesisUtterance(output.speechResponse);
            u.lang = 'ml-IN';
            window.speechSynthesis.speak(u);
            
            if (output.triggerModalItem && window.openItemModalFallback) window.openItemModalFallback(output.triggerModalItem, output.totalBillAmount);
        } catch (err) { VoiceService.addLogNotification("Error", err.message, true); }
    }
};
