(function (KH) {
    let audioCtx;
    let noiseBuffer;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }

        if (!noiseBuffer && audioCtx) {
            const bufferSize = audioCtx.sampleRate * 0.15;
            noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
        }
    }

    function playTickSound() {
        if (!audioCtx || !noiseBuffer) return;

        const noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);

        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(1.5, audioCtx.currentTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

        noiseSrc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        noiseSrc.start(audioCtx.currentTime);
        noiseSrc.stop(audioCtx.currentTime + 0.1);
    }

    function playStopSound() {
        if (!audioCtx) return;

        [146.83, 174.61, 220.00].forEach((frequency, index) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            const startTime = audioCtx.currentTime + (index * 0.05);

            osc.type = "sine";
            osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.9, startTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 2.5);

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start(startTime);
            osc.stop(startTime + 3.0);
        });
    }

    function playSuspenseSound() {
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 1.5);

        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(1.5, audioCtx.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2.5);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 2.5);
    }

    function playVoteSound() {
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.6);
    }

    KH.audio = {
        init: initAudio,
        tick: playTickSound,
        stop: playStopSound,
        suspense: playSuspenseSound,
        vote: playVoteSound
    };
})(window.KH = window.KH || {});
