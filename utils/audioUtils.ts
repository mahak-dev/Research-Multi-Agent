

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export type AudioPlayerState = 'playing' | 'paused' | 'stopped';

export interface AudioControl {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  close: () => void;
  onEnded: (callback: () => void) => void;
  onStateChange: (callback: (state: AudioPlayerState) => void) => void;
  onProgress: (callback: (currentTime: number, duration: number) => void) => void;
}

export async function createAudioPlayer(base64Audio: string): Promise<AudioControl> {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const decodedData = decode(base64Audio);
    const audioBuffer = await decodeAudioData(decodedData, context, 24000, 1);
    const gainNode = context.createGain();
    gainNode.connect(context.destination);

    let source: AudioBufferSourceNode | null = null;
    let state: AudioPlayerState = 'stopped';
    let startTime = 0;
    let pauseTime = 0;
    let progressInterval: number | null = null;

    let onEndedCallback: () => void = () => {};
    let onStateChangeCallback: (state: AudioPlayerState) => void = () => {};
    let onProgressCallback: (currentTime: number, duration: number) => void = () => {};

    const stopProgressTracker = () => {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    };

    const startProgressTracker = () => {
        stopProgressTracker();
        progressInterval = window.setInterval(() => {
            if (state === 'playing') {
                const currentTime = pauseTime + (context.currentTime - startTime);
                onProgressCallback(Math.min(currentTime, audioBuffer.duration), audioBuffer.duration);
            }
        }, 100);
    };

    const setState = (newState: AudioPlayerState) => {
        state = newState;
        onStateChangeCallback(state);
    }
    
    const createSource = () => {
        if (context.state === 'closed') return null;
        const newSource = context.createBufferSource();
        newSource.buffer = audioBuffer;
        newSource.connect(gainNode);
        newSource.onended = () => {
            // This event also fires on manual stop, so check state to see if it finished naturally
            if (state === 'playing') {
                stopProgressTracker();
                setState('stopped');
                pauseTime = 0;
                onEndedCallback();
            }
        };
        return newSource;
    };

    const play = async () => {
        if (state === 'playing') return;
        if (context.state === 'suspended') {
            await context.resume();
        }

        source = createSource();
        if (!source) return;

        startTime = context.currentTime;
        source.start(0, pauseTime % audioBuffer.duration); // Use modulo to handle seeking past the end
        
        setState('playing');
        startProgressTracker();
    };

    const pause = () => {
        if (state !== 'playing' || !source) return;

        pauseTime += context.currentTime - startTime;
        
        // Detach onended to prevent it from firing on a manual stop
        source.onended = null;
        try { source.stop(); } catch(e) {}
        source.disconnect();
        source = null;

        stopProgressTracker();
        setState('paused');
    };

    const seek = (time: number) => {
        const wasPlaying = state === 'playing';
        if (wasPlaying) {
            pause();
        }
        pauseTime = Math.max(0, Math.min(time, audioBuffer.duration));
        onProgressCallback(pauseTime, audioBuffer.duration);
        if (wasPlaying) {
            play();
        }
    };

    const setVolume = (volume: number) => {
        gainNode.gain.setValueAtTime(volume, context.currentTime);
    };

    const close = () => {
        if (context.state !== 'closed') {
             if (source) {
                source.onended = null;
                try { source.stop(); } catch(e) {}
                source.disconnect();
                source = null;
            }
            stopProgressTracker();
            gainNode.disconnect();
            context.close();
        }
    };

    const onEnded = (callback: () => void) => { onEndedCallback = callback; };
    const onStateChange = (callback: (state: AudioPlayerState) => void) => { onStateChangeCallback = callback; };
    const onProgress = (callback: (currentTime: number, duration: number) => void) => { onProgressCallback = callback; };

    return { play, pause, seek, setVolume, close, onEnded, onStateChange, onProgress };
}
