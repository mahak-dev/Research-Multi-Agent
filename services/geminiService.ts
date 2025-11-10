

import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ResearchPaper, PaperSummary } from '../types';

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const findRelatedPapers = async (topic: string): Promise<ResearchPaper[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find the top 5 most cited and relevant academic research papers on the topic of: "${topic}"`,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (!groundingChunks) {
        throw new Error("Could not find related papers. The model did not return any search results.");
    }
    
    return groundingChunks
        .filter((chunk: any) => chunk.web && chunk.web.uri && chunk.web.title)
        .map((chunk: any) => ({
            title: chunk.web.title,
            uri: chunk.web.uri,
        }));
};

export const summarizeAndRatePapers = async (papers: ResearchPaper[]): Promise<PaperSummary[]> => {
    const ai = getAiClient();
    const paperContext = papers.map(p => `Title: ${p.title}, URL: ${p.uri}`).join('\n');
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: `Based on the following list of research papers, provide a concise one-paragraph summary for each and a relevance rating from 1 to 5 (5 being most relevant) based on their titles. Format the output as a JSON array.\n\n${paperContext}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        rating: { type: Type.INTEGER },
                    },
                    required: ["title", "summary", "rating"],
                },
            },
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};

export const generateAudioExplanation = async (text: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `In a clear, academic tone, please explain the following: ${text}` }] }],
        config: {
            // FIX: Use Modality.AUDIO enum for responseModalities.
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Audio generation failed.");
    }
    return base64Audio;
};


export const generateNewPaperHints = async (context: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: `You are a brilliant research scientist and advisor. Based on the following research context, identify potential research gaps, suggest 3-5 novel research questions, and provide actionable hints for writing a new, innovative research paper. Format your response in markdown. \n\nContext:\n${context}`,
    });
    return response.text;
};