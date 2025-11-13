
import React from 'react';
import { AgentStep } from '../types';
import PaperIcon from './icons/PaperIcon';
import BrainIcon from './icons/BrainIcon';
import ChatIcon from './icons/ChatIcon';
import SparklesIcon from './icons/SparklesIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';

const steps = [
  { id: AgentStep.FINDING, name: 'Find Papers', icon: PaperIcon },
  { id: AgentStep.SUMMARIZING, name: 'Summarize', icon: BrainIcon },
  { id: AgentStep.INTERVIEW, name: 'Interview', icon: ChatIcon },
  { id: AgentStep.HINTS, name: 'Ideate', icon: SparklesIcon },
];

const stepOrder = [AgentStep.UPLOAD, AgentStep.FINDING, AgentStep.SUMMARIZING, AgentStep.INTERVIEW, AgentStep.HINTS];

const WorkflowDiagram: React.FC<{ currentStep: AgentStep }> = ({ currentStep }) => {
  const currentStepIndex = stepOrder.indexOf(currentStep);

  return (
    <nav aria-label="Agent Workflow">
      <ol role="list" className="flex items-center justify-center">
        {steps.map((step, stepIdx) => {
           const stepConfigIndex = stepOrder.indexOf(step.id);
           let status: 'complete' | 'current' | 'upcoming' = 'upcoming';
           if (currentStepIndex > stepConfigIndex) {
               status = 'complete';
           } else if (currentStepIndex === stepConfigIndex) {
               status = 'current';
           }

          return (
          <li key={step.name} className="relative flex items-center">
            <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors duration-300
                ${status === 'complete' ? 'bg-sky-600/50' : ''}
                ${status === 'current' ? 'bg-orange-600/80 ring-2 ring-orange-500' : ''}
                ${status === 'upcoming' ? 'bg-slate-800/70' : ''}
            `}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full
                    ${status === 'complete' ? 'bg-sky-600' : ''}
                    ${status === 'current' ? 'bg-orange-600' : ''}
                    ${status === 'upcoming' ? 'bg-slate-700' : ''}
                `}>
                    <step.icon className={`w-5 h-5 ${status === 'upcoming' ? 'text-slate-400' : 'text-white'}`} />
                </div>
                <span className={`font-semibold hidden sm:inline ${status === 'upcoming' ? 'text-slate-400' : 'text-white'}`}>
                    {`Agent ${stepIdx + 1}: ${step.name}`}
                </span>
            </div>

            {stepIdx !== steps.length - 1 && (
              <div className="px-2" aria-hidden="true">
                <ChevronRightIcon className={`h-6 w-6 ${status === 'complete' ? 'text-sky-500' : 'text-slate-600'}`} />
              </div>
            )}
          </li>
        )})}
      </ol>
    </nav>
  );
};

export default WorkflowDiagram;
