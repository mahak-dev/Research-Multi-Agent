
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AgentStep, ResearchPaper, PaperSummary, ChatMessage, IdeationResult, Conference } from './types';
import * as geminiService from './services/geminiService';
import { createAudioPlayer, AudioControl } from './utils/audioUtils';
import WorkflowDiagram from './components/WorkflowDiagram';
import LoadingSpinner from './components/LoadingSpinner';
import SparklesIcon from './components/icons/SparklesIcon';
import PlayIcon from './components/icons/PlayIcon';
import PauseIcon from './components/icons/PauseIcon';
import SendIcon from './components/icons/SendIcon';
import CalendarIcon from './components/icons/CalendarIcon';
import LocationPinIcon from './components/icons/LocationPinIcon';
import { Chat } from '@google/genai';

const App: React.FC = () => {
    const [step, setStep] = useState<AgentStep>(AgentStep.UPLOAD);
    const [topic, setTopic] = useState<string>('');
    const [relatedPapers, setRelatedPapers] = useState<ResearchPaper[]>([]);
    const [summaries, setSummaries] = useState<PaperSummary[]>([]);
    const [selectedSummary, setSelectedSummary] = useState<PaperSummary | null>(null);
    
    // Chat and Audio State
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [userMessage, setUserMessage] = useState('');
    const [isAssistantResponding, setIsAssistantResponding] = useState(false);
    const [audioPlayer, setAudioPlayer] = useState<AudioControl | null>(null);
    const [activeAudioIndex, setActiveAudioIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const [hints, setHints] = useState<IdeationResult | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    
    // Refs for scrolling to sections
    const sectionsRef = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isAssistantResponding]);
    
    useEffect(() => {
        const section = sectionsRef.current[step];
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [step]);


    const cleanupAudio = useCallback(() => {
        if (audioPlayer) {
            audioPlayer.close();
            setAudioPlayer(null);
        }
        setActiveAudioIndex(null);
        setIsPlaying(false);
        setProgress(0);
        setDuration(0);
    }, [audioPlayer]);

    const resetState = useCallback(() => {
        setStep(AgentStep.UPLOAD);
        setTopic('');
        setRelatedPapers([]);
        setSummaries([]);
        setSelectedSummary(null);
        setChatSession(null);
        setChatHistory([]);
        setUserMessage('');
        setIsAssistantResponding(false);
        cleanupAudio();
        setHints(null);
        setLoadingMessage('');
        setError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [cleanupAudio]);

    const handleError = useCallback((err: any) => {
        const message = err.message || 'An unexpected error occurred.';
        console.error(err);
        setError(message);
        setLoadingMessage('');
        setIsAssistantResponding(false);
    }, []);

    const handleTopicSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const submittedTopic = formData.get('topic') as string;
        
        if (!submittedTopic.trim()) return;
        // Keep previous state but start a new search
        setTopic(submittedTopic);
        setRelatedPapers([]);
        setSummaries([]);
        setSelectedSummary(null);
        setChatHistory([]);
        setHints(null);
        cleanupAudio();
        
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
    }, [handleError, cleanupAudio]);

    useEffect(() => {
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
    
    const playAudioForMessage = useCallback(async (index: number, audioData: string) => {
        cleanupAudio();
        try {
            const player = await createAudioPlayer(audioData);
            player.onEnded(() => {
                setIsPlaying(false);
                setActiveAudioIndex(null);
                if (index === 0) setProgress(0); // Only reset progress for main player
            });
            player.onStateChange((state) => setIsPlaying(state === 'playing'));
            if (index === 0) { // Only track progress for the main explanation
                player.onProgress((currentTime, totalDuration) => {
                    setProgress(currentTime);
                    if (duration !== totalDuration) setDuration(totalDuration);
                });
            }
            await player.play();
            setAudioPlayer(player);
            setActiveAudioIndex(index);
        } catch (err) {
            handleError(err);
        }
    }, [cleanupAudio, duration, handleError]);

    const handleStartInterview = useCallback(async (summary: PaperSummary) => {
        setSelectedSummary(summary);
        setStep(AgentStep.INTERVIEW);
        setLoadingMessage('Assistant: Preparing audio explanation...');
        
        try {
            const session = geminiService.startChat(summary);
            setChatSession(session);

            const audioData = await geminiService.generateAudioExplanation(summary.summary);
            const initialMessage: ChatMessage = {
                role: 'model',
                text: summary.summary,
                audioData: audioData
            };
            setChatHistory([initialMessage]);
            setLoadingMessage('');
            await playAudioForMessage(0, audioData);
        } catch (err) {
            handleError(err);
        }
    }, [handleError, playAudioForMessage]);
    
    const handleSendMessage = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userMessage.trim() || isAssistantResponding || !chatSession) return;
        
        cleanupAudio();
        const newUserMessage: ChatMessage = { role: 'user', text: userMessage };
        setChatHistory(prev => [...prev, newUserMessage]);
        setUserMessage('');
        setIsAssistantResponding(true);

        try {
            const responseText = await geminiService.continueChat(chatSession, userMessage);
            const audioData = await geminiService.generateAudioExplanation(responseText);
            const newModelMessage: ChatMessage = { role: 'model', text: responseText, audioData };
            setChatHistory(prev => [...prev, newModelMessage]);
            await playAudioForMessage(chatHistory.length + 1, audioData);
        } catch (err) {
            handleError(err);
        } finally {
            setIsAssistantResponding(false);
        }

    }, [userMessage, isAssistantResponding, chatSession, cleanupAudio, playAudioForMessage, chatHistory.length, handleError]);
    
    const togglePlayPauseForMessage = useCallback((index: number, audioData?: string) => {
        if (activeAudioIndex === index && audioPlayer) {
            if (isPlaying) {
                audioPlayer.pause();
            } else {
                audioPlayer.play();
            }
        } else if (audioData) {
            playAudioForMessage(index, audioData);
        }
    }, [activeAudioIndex, audioPlayer, isPlaying, playAudioForMessage]);

    const handleSeek = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (!audioPlayer || duration === 0 || activeAudioIndex !== 0) return;
        const progressBar = event.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const seekTime = (x / rect.width) * duration;
        audioPlayer.seek(seekTime);
    };
    
    const handleGenerateHints = useCallback(async () => {
        if (!topic || !selectedSummary) return;
        setStep(AgentStep.HINTS);
        setLoadingMessage('Agent 4: Ideating new research directions and finding conferences...');
        try {
            const conversation = chatHistory.map(m => `${m.role === 'model' ? 'Assistant' : 'User'}: ${m.text}`).join('\n');
            const context = `Original Topic: ${topic}\nSelected Paper: ${selectedSummary.title}\nSummary: ${selectedSummary.summary}\n\nConversation History:\n${conversation}`;
            const markdownResponse = await geminiService.generateNewPaperHints(context);
            
            const parts = markdownResponse.split('### Upcoming Conferences');
            const researchIdeas = parts[0].replace('### New Research Ideas', '').trim();
            let conferences: Conference[] = [];
            
            if (parts.length > 1) {
                const conferenceLines = parts[1].trim().split('\n').filter(line => line.startsWith('*'));
                const conferenceRegex = /\*\s*\*\*\[(.+?)\]\((.+?)\)\*\*\s*-\s*(.+?),\s*(.+)/;
                conferences = conferenceLines.map(line => {
                    const match = line.match(conferenceRegex);
                    if (match) {
                        return {
                            name: match[1].trim(),
                            url: match[2].trim(),
                            dates: match[3].trim(),
                            location: match[4].trim(),
                        };
                    }
                    return null;
                }).filter((c): c is Conference => c !== null);
            }

            setHints({ researchIdeas, conferences });
            setLoadingMessage('');
        // Fix: Corrected invalid syntax in catch block.
        } catch (err) {
            handleError(err);
        }
    }, [topic, selectedSummary, chatHistory, handleError]);
    
    const formatTime = (seconds: number) => {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };
    
    return (
        <div className="min-h-screen bg-slate-900 text-sky-100 flex flex-col items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
            <div 
                className="absolute inset-0 bg-cover bg-center opacity-10"
                style={{ backgroundImage: `url('https://storage.googleapis.com/maker-suite-guides/research-agent/background.jpg')` }} 
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/80 to-slate-900" />
            
            <div className="w-full max-w-5xl mx-auto z-10">
                <header className="text-center mb-6">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-orange-400">
                        Research Agent
                    </h1>
                    <p className="text-sky-300 mt-2 max-w-2xl mx-auto">An AI-powered assistant to accelerate your research workflow.</p>
                </header>
                
                <div className="mb-8 p-4 bg-slate-900/50 rounded-xl border border-sky-900/50 sticky top-4 z-20 backdrop-blur-sm">
                    <WorkflowDiagram currentStep={step} />
                </div>

                <main className="space-y-12">
                     <div ref={el => sectionsRef.current[AgentStep.UPLOAD] = el}>
                         <h2 className="text-2xl font-bold mb-4 text-center">Start a New Research Session</h2>
                        <form onSubmit={handleTopicSubmit} className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto">
                            <input
                                name="topic"
                                type="text"
                                defaultValue={topic}
                                key={topic} // Force re-render on reset
                                className="w-full bg-slate-800/60 border border-sky-800 rounded-md px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-slate-400"
                                placeholder="e.g., 'Quantum computing applications in medicine'"
                            />
                            <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-md flex items-center justify-center gap-2 transition-colors">
                                <SparklesIcon className="w-5 h-5" />
                                Start Research
                            </button>
                        </form>
                    </div>

                    {error && (
                        <div className="text-center p-8 bg-red-900/50 rounded-lg">
                            <h3 className="text-xl font-bold text-red-300">An Error Occurred</h3>
                            <p className="mt-2 text-red-200">{error}</p>
                            <button onClick={resetState} className="mt-4 bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-md">Start Over</button>
                        </div>
                    )}
                    
                    {(step === AgentStep.FINDING && loadingMessage) && <LoadingSpinner message={loadingMessage} />}
                    
                    {relatedPapers.length > 0 && (
                        <div ref={el => sectionsRef.current[AgentStep.SUMMARIZING] = el}>
                            <h2 className="text-3xl font-bold text-center mb-4 text-sky-300">Agent 2: Summarize & Rate</h2>
                            <p className="text-center text-sky-400 mb-8">Select a paper to begin an interactive interview with your AI research assistant.</p>
                            {(step === AgentStep.SUMMARIZING && loadingMessage) && <LoadingSpinner message={loadingMessage} />}
                            {summaries.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {summaries.map((s, i) => (
                                        <div key={i} className={`bg-slate-800/80 backdrop-blur-sm p-5 rounded-lg border flex flex-col justify-between shadow-lg transition-all duration-300 ${selectedSummary?.title === s.title ? 'border-orange-500' : 'border-sky-900 hover:border-orange-600'}`}>
                                            <div>
                                                <h3 className="font-bold text-sky-400">{s.title}</h3>
                                                <div className="flex items-center gap-1 my-2">
                                                    {[...Array(5)].map((_, starIndex) => (
                                                        <svg key={starIndex} className={`w-5 h-5 ${starIndex < s.rating ? 'text-yellow-400' : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.366 2.445a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.175 0l-3.366 2.445c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.34 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
                                                        </svg>
                                                    ))}
                                                </div>
                                                <p className="text-sm text-sky-200 line-clamp-4">{s.summary}</p>
                                            </div>
                                            <button onClick={() => handleStartInterview(s)} className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition-colors">Interview Assistant</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {selectedSummary && (
                        <div ref={el => sectionsRef.current[AgentStep.INTERVIEW] = el} className="w-full max-w-3xl mx-auto flex flex-col bg-slate-800/50 rounded-xl shadow-2xl border border-sky-900/50">
                            {(step === AgentStep.INTERVIEW && loadingMessage) ? <LoadingSpinner message={loadingMessage} /> : (
                                <>
                                    <div className="flex-shrink-0 flex items-center p-4 border-b border-sky-800/50">
                                        <img src="https://storage.googleapis.com/maker-suite-guides/research-agent/assistant.png" alt="Research Assistant" className="w-14 h-14 rounded-full border-2 border-orange-500" />
                                        <div className="ml-4">
                                            <h2 className="text-xl font-bold text-sky-200">Agent 3: Interview Assistant</h2>
                                            <p className="text-sky-400 text-sm truncate" title={selectedSummary?.title}>Topic: {selectedSummary?.title}</p>
                                        </div>
                                    </div>
                                    <div ref={chatContainerRef} className="flex-grow p-4 space-y-6 overflow-y-auto h-[60vh]">
                                        {chatHistory.map((msg, index) => (
                                            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                                {msg.role === 'model' && <img src="https://storage.googleapis.com/maker-suite-guides/research-agent/assistant.png" alt="Assistant" className="w-8 h-8 rounded-full flex-shrink-0" />}
                                                <div className={`p-4 rounded-xl max-w-md ${msg.role === 'user' ? 'bg-sky-700/80 text-white' : 'bg-slate-700/50'}`}>
                                                    <p className="text-sky-100">{msg.text}</p>
                                                    {msg.role === 'model' && index === 0 && (
                                                        <div className="mt-4">
                                                            <div className="flex items-center gap-3">
                                                                <button onClick={() => togglePlayPauseForMessage(index, msg.audioData)} className="p-2 rounded-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50" disabled={!msg.audioData}>
                                                                    {isPlaying && activeAudioIndex === index ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 pl-0.5" />}
                                                                </button>
                                                                <div className="w-full bg-slate-600 rounded-full h-2 cursor-pointer" onClick={handleSeek}>
                                                                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }}></div>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between text-xs text-sky-300 mt-1">
                                                                <span>{formatTime(progress)}</span>
                                                                <span>{formatTime(duration)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {msg.role === 'model' && index > 0 && (
                                                        <button onClick={() => togglePlayPauseForMessage(index, msg.audioData)} className="mt-3 flex items-center gap-2 text-orange-400 hover:text-orange-300 disabled:opacity-50" disabled={!msg.audioData}>
                                                            {isPlaying && activeAudioIndex === index ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                                                            <span className="text-sm font-semibold">{isPlaying && activeAudioIndex === index ? 'Pause' : 'Play Audio'}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {isAssistantResponding && (
                                            <div className="flex items-start gap-3">
                                                <img src="https://storage.googleapis.com/maker-suite-guides/research-agent/assistant.png" alt="Assistant" className="w-8 h-8 rounded-full" />
                                                <div className="p-4 rounded-xl max-w-md bg-slate-700/50 animate-pulse">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="h-2 w-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                        <span className="h-2 w-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                        <span className="h-2 w-2 bg-orange-400 rounded-full animate-bounce"></span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 p-4 border-t border-sky-800/50">
                                        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                                            <input type="text" value={userMessage} onChange={(e) => setUserMessage(e.target.value)} className="w-full bg-slate-700/60 border border-sky-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-slate-400" placeholder="Ask a follow-up question..." disabled={isAssistantResponding} />
                                            <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled={isAssistantResponding || !userMessage.trim()}><SendIcon className="w-6 h-6" /></button>
                                        </form>
                                        <div className="text-center mt-4">
                                            <button onClick={handleGenerateHints} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2 transition-colors mx-auto text-sm">
                                                <SparklesIcon className="w-5 h-5" />
                                                Next: Ideate New Paper
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    {(step === AgentStep.HINTS && loadingMessage) && <LoadingSpinner message={loadingMessage} />}

                    {hints && (
                        <div ref={el => sectionsRef.current[AgentStep.HINTS] = el}>
                            <h2 className="text-3xl font-bold text-center mb-8 text-sky-300">Agent 4: New Research Directions</h2>
                            <div className="space-y-10">
                                <div>
                                    <h3 className="text-2xl font-semibold text-sky-300 mb-4 border-b-2 border-orange-500/50 pb-2">New Research Ideas</h3>
                                    <div className="prose prose-invert prose-lg max-w-none bg-slate-800/80 backdrop-blur-sm p-6 rounded-lg" dangerouslySetInnerHTML={{ __html: hints.researchIdeas.replace(/\n/g, '<br />') }}></div>
                                </div>
                                
                                {hints.conferences.length > 0 && (
                                    <div>
                                        <h3 className="text-2xl font-semibold text-sky-300 mb-4 border-b-2 border-orange-500/50 pb-2">Upcoming Conferences</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {hints.conferences.map((conf, index) => (
                                                <div key={index} className="bg-slate-800/80 backdrop-blur-sm p-5 rounded-lg border border-sky-900 flex flex-col shadow-lg">
                                                    <h4 className="font-bold text-sky-400 text-lg mb-3">
                                                        <a href={conf.url} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors">{conf.name}</a>
                                                    </h4>
                                                    <div className="space-y-2 text-sky-200 mt-auto">
                                                        <p className="flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-orange-400 flex-shrink-0" /><span>{conf.dates}</span></p>
                                                        <p className="flex items-center gap-2"><LocationPinIcon className="w-5 h-5 text-orange-400 flex-shrink-0" /><span>{conf.location}</span></p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="mt-12 text-center">
                                <button onClick={resetState} className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-md flex items-center justify-center gap-2 transition-colors">
                                    Start a New Session
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
