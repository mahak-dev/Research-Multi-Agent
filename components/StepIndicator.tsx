
import React from 'react';
import { AgentStep } from '../types';
import PaperIcon from './icons/PaperIcon';
import BrainIcon from './icons/BrainIcon';
import MediaIcon from './icons/MediaIcon';
import SparklesIcon from './icons/SparklesIcon';

interface StepIndicatorProps {
  currentStep: AgentStep;
}

const steps = [
  { id: AgentStep.UPLOAD, name: 'Topic', icon: PaperIcon },
  { id: AgentStep.FINDING, name: 'Find Papers', icon: PaperIcon },
  { id: AgentStep.SUMMARIZING, name: 'Summarize', icon: BrainIcon },
  { id: AgentStep.EXPLAINING, name: 'Explain', icon: MediaIcon },
  { id: AgentStep.HINTS, name: 'Ideate', icon: SparklesIcon },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
            {stepIdx < currentStepIndex ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-indigo-600" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center bg-indigo-600 rounded-full">
                  <step.icon className="w-5 h-5 text-white" />
                </div>
              </>
            ) : stepIdx === currentStepIndex ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-700" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center bg-indigo-600 rounded-full ring-4 ring-indigo-500/50">
                  <step.icon className="w-5 h-5 text-white" />
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-700" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center bg-gray-800 rounded-full border-2 border-gray-700">
                  <step.icon className="w-5 h-5 text-gray-500" />
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default StepIndicator;
