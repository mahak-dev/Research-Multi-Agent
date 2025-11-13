import React from 'react';

const WatermarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="100%"
    height="100%"
    viewBox="0 0 800 400"
    preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <pattern id="pattern-1" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="translate(20,20)">
        <path d="M0 20 L40 20 M20 0 L20 40" stroke="currentColor" strokeWidth="0.5" />
      </pattern>
      <pattern id="pattern-2" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
        <circle cx="20" cy="20" r="1" fill="currentColor" />
        <circle cx="60" cy="60" r="1" fill="currentColor" />
      </pattern>
    </defs>
    <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-1)" opacity="0.5" />
    <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-2)" opacity="0.5" />
    <path
      d="M100,100 C150,50 250,50 300,100 S400,150 450,100 S550,50 600,100 M200,300 C250,250 350,250 400,300 S500,350 550,300 S650,250 700,300"
      stroke="currentColor"
      strokeWidth="0.5"
      fill="none"
      opacity="0.3"
    />
  </svg>
);

export default WatermarkIcon;
