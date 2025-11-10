

import React, { useState, useCallback } from 'react';
import { AgentStep, ResearchPaper, PaperSummary } from './types';
import * as geminiService from './services/geminiService';
import { createAudioPlayer, AudioControl } from './utils/audioUtils';
import StepIndicator from './components/StepIndicator';
import LoadingSpinner from './components/LoadingSpinner';
import SparklesIcon from './components/icons/SparklesIcon';
import PlayIcon from './components/icons/PlayIcon';
import PauseIcon from './components/icons/PauseIcon';
import VolumeUpIcon from './components/icons/VolumeUpIcon';
import VolumeDownIcon from './components/icons/VolumeDownIcon';


const App: React.FC = () => {
    const [step, setStep] = useState<AgentStep>(AgentStep.UPLOAD);
    const [topic, setTopic] = useState<string>('');
    const [relatedPapers, setRelatedPapers] = useState<ResearchPaper[]>([]);
    const [summaries, setSummaries] = useState<PaperSummary[]>([]);
    const [selectedSummary, setSelectedSummary] = useState<PaperSummary | null>(null);
    const [audioPlayer, setAudioPlayer] = useState<AudioControl | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [hints, setHints] = useState<string>('');
    
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // FIX: Wrap resetState in useCallback to memoize the function and provide a stable reference.
    const resetState = useCallback(() => {
        setStep(AgentStep.UPLOAD);
        setTopic('');
        setRelatedPapers([]);
        setSummaries([]);
        setSelectedSummary(null);
        if (audioPlayer) {
            audioPlayer.close();
            setAudioPlayer(null);
        }
        setIsPlaying(false);
        setVolume(1);
        setProgress(0);
        setDuration(0);
        setHints('');
        setLoadingMessage('');
        setError(null);
    }, [audioPlayer]);

    // FIX: Wrap handleError in useCallback to memoize the function. Since it only uses setState functions, it has no dependencies.
    // This provides a stable function reference for other hooks' dependency arrays.
    const handleError = useCallback((err: any) => {
        const message = err.message || 'An unexpected error occurred.';
        console.error(err);
        setError(message);
        setLoadingMessage('');
    }, []);

    const handleTopicSubmit = useCallback(async (submittedTopic: string) => {
        if (!submittedTopic.trim()) return;
        setTopic(submittedTopic);
        setStep(AgentStep.FINDING);
        setLoadingMessage('Agent 1: Searching the web for related research papers...');
        setError(null);
        
        try {
            const papers = await geminiService.findRelatedPapers(submittedTopic);
            if (papers.length === 0) {
                 throw new Error("No relevant papers found. Please try a different topic.");
            }
            setRelatedPapers(papers);
            setStep(AgentStep.SUMMARIZING);
        } catch (err) {
            handleError(err);
        }
    // FIX: Add handleError to the dependency array to avoid a stale closure.
    }, [handleError]);

    // FIX: Add handleError to the dependency array to ensure the latest version of the function is used.
    React.useEffect(() => {
        const summarize = async () => {
            if (step === AgentStep.SUMMARIZING && relatedPapers.length > 0 && summaries.length === 0) {
                setLoadingMessage('Agent 2: Reading and summarizing papers...');
                try {
                    const paperSummaries = await geminiService.summarizeAndRatePapers(relatedPapers);
                    setSummaries(paperSummaries);
                    setLoadingMessage('');
                } catch (err) {
                    handleError(err);
                }
            }
        };
        summarize();
    }, [step, relatedPapers, summaries, handleError]);

    const handleSummarySelect = useCallback(async (summary: PaperSummary) => {
        setSelectedSummary(summary);
        setStep(AgentStep.EXPLAINING);
        setLoadingMessage('Agent 3: Preparing audio explanation...');
        
        if (audioPlayer) {
            audioPlayer.close();
        }
        
        try {
            const audioData = await geminiService.generateAudioExplanation(summary.summary);
            const player = await createAudioPlayer(audioData);
            
            player.onEnded(() => {
                setIsPlaying(false);
                setProgress(0);
            });
            player.onStateChange((state) => {
                setIsPlaying(state === 'playing');
            });
            player.onProgress((currentTime, totalDuration) => {
                setProgress(currentTime);
                if (duration !== totalDuration) {
                    setDuration(totalDuration);
                }
            });
            setAudioPlayer(player);
            setLoadingMessage('');
        } catch (err) {
            handleError(err);
        }
    // FIX: Add handleError to the dependency array to avoid a stale closure.
    }, [audioPlayer, duration, handleError]);

    const togglePlayPause = () => {
        if (!audioPlayer) return;
        if (isPlaying) {
            audioPlayer.pause();
        } else {
            audioPlayer.play();
        }
    };

    const handleVolumeChange = (direction: 'up' | 'down') => {
        if (!audioPlayer) return;
        const newVolume = direction === 'up' 
            ? Math.min(1, volume + 0.1) 
            : Math.max(0, volume - 0.1);
        const roundedVolume = Math.round(newVolume * 10) / 10;
        setVolume(roundedVolume);
        audioPlayer.setVolume(roundedVolume);
    };

    const handleSeek = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (!audioPlayer || duration === 0) return;
        const progressBar = event.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const seekTime = (x / rect.width) * duration;
        audioPlayer.seek(seekTime);
    };
    
    const handleGenerateHints = useCallback(async () => {
        if (!topic || !selectedSummary) return;
        setStep(AgentStep.HINTS);
        setLoadingMessage('Agent 4: Ideating new research directions...');
        try {
            const context = `Original Topic: ${topic}\nSelected Paper: ${selectedSummary.title}\nSummary: ${selectedSummary.summary}`;
            const newHints = await geminiService.generateNewPaperHints(context);
            setHints(newHints);
            setLoadingMessage('');
        } catch (err) {
            handleError(err);
        }
    // FIX: Add handleError to the dependency array to avoid a stale closure.
    }, [topic, selectedSummary, handleError]);
    
    const formatTime = (seconds: number) => {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const renderContent = () => {
        if (error) {
            return (
                <div className="text-center p-8 bg-red-900/50 rounded-lg">
                    <h3 className="text-xl font-bold text-red-300">An Error Occurred</h3>
                    <p className="mt-2 text-red-200">{error}</p>
                </div>
            );
        }

        if (loadingMessage) {
            return <LoadingSpinner message={loadingMessage} />;
        }
        
        switch (step) {
            case AgentStep.UPLOAD:
            case AgentStep.FINDING:
                return (
                    <div className="w-full">
                        <h2 className="text-2xl font-bold text-center mb-4">Start Your Research Journey</h2>
                        <p className="text-center text-gray-400 mb-6">Enter a research topic, and our AI agents will guide you through the literature.</p>
                        <form onSubmit={(e) => { e.preventDefault(); handleTopicSubmit(e.currentTarget.topic.value); }} className="flex gap-2">
                            <input
                                name="topic"
                                type="text"
                                className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                placeholder="e.g., 'Quantum computing applications in medicine'"
                            />
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2 transition-colors">
                                <SparklesIcon className="w-5 h-5" />
                                Start
                            </button>
                        </form>
                    </div>
                );

            case AgentStep.SUMMARIZING:
                return (
                    <div>
                        <h2 className="text-2xl font-bold text-center mb-4">Relevant Papers Found</h2>
                        <p className="text-center text-gray-400 mb-6">Select a paper to get a deep-dive explanation from Agent 3.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {summaries.map((s, i) => (
                                <div key={i} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-indigo-400">{s.title}</h3>
                                        <div className="flex items-center gap-1 my-2">
                                            {[...Array(5)].map((_, starIndex) => (
                                                <svg key={starIndex} className={`w-4 h-4 ${starIndex < s.rating ? 'text-yellow-400' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.366 2.445a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.175 0l-3.366 2.445c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.34 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
                                                </svg>
                                            ))}
                                        </div>
                                        <p className="text-sm text-gray-400">{s.summary}</p>
                                    </div>
                                    <button onClick={() => handleSummarySelect(s)} className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors">Explain This</button>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case AgentStep.EXPLAINING:
                return (
                    <div className="w-full max-w-lg mx-auto">
                        <h2 className="text-2xl font-bold text-center mb-1">AI Explanation</h2>
                        <p className="text-center text-gray-400 mb-6 font-semibold text-indigo-300 truncate" title={selectedSummary?.title}>{selectedSummary?.title}</p>

                        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 text-center">
                            <div className="mb-4">
                                <div 
                                    className="bg-gray-700 rounded-full cursor-pointer h-2.5 group"
                                    onClick={handleSeek}
                                >
                                    <div 
                                        className="bg-indigo-500 h-2.5 rounded-full" 
                                        style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-sm text-gray-400 mt-1 px-1">
                                    <span>{formatTime(progress)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-6">
                                <button
                                    onClick={() => handleVolumeChange('down')}
                                    className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!audioPlayer || volume <= 0}
                                    aria-label="Decrease volume"
                                >
                                    <VolumeDownIcon className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={togglePlayPause}
                                    className="w-16 h-16 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!audioPlayer}
                                    aria-label={isPlaying ? "Pause audio" : "Play audio"}
                                >
                                    {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 pl-1" />}
                                </button>
                                <button
                                    onClick={() => handleVolumeChange('up')}
                                    className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!audioPlayer || volume >= 1}
                                    aria-label="Increase volume"
                                >
                                    <VolumeUpIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        
                        {audioPlayer && (
                             <div className="text-center mt-8">
                                <button onClick={handleGenerateHints} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md text-lg flex items-center gap-2 transition-colors mx-auto">
                                    <SparklesIcon className="w-6 h-6" />
                                    Next: Ideate New Paper
                                </button>
                            </div>
                        )}
                    </div>
                );
            case AgentStep.HINTS:
                 return (
                    <div>
                        <h2 className="text-2xl font-bold text-center mb-4">Agent 4: New Research Ideas</h2>
                        <div className="prose prose-invert prose-lg max-w-none bg-gray-800 p-6 rounded-lg border border-gray-700" dangerouslySetInnerHTML={{ __html: hints.replace(/\n/g, '<br />') }}></div>
                    </div>
                );
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-5xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
                        Research Agent
                    </h1>
                </header>
                
                <div className="mb-8 flex justify-center">
                    <StepIndicator currentStep={step} />
                </div>

                <main className="bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-gray-700 min-h-[300px] flex items-center justify-center">
                    {renderContent()}
                </main>
                
                {step !== AgentStep.UPLOAD && (
                    <div className="mt-8 text-center">
                         <button onClick={resetState} className="text-gray-400 hover:text-white transition-colors">Start Over</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;