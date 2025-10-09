import React, { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';

interface ModelAcceptanceStatusProps {
  modelName: string;
  modelLabel: string;
  onReview: () => void; // New prop to open modal
}

export function ModelAcceptanceStatus({ modelName, modelLabel, onReview }: ModelAcceptanceStatusProps) {
  const [acceptance, setAcceptance] = useState(() => 
    localStorage.getItem(`model-acceptance-${modelName}`)
  );
  
  useEffect(() => {
    const handleStorageChange = () => {
      setAcceptance(localStorage.getItem(`model-acceptance-${modelName}`));
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [modelName]);

  // Update acceptance state when modelName changes
  useEffect(() => {
    setAcceptance(localStorage.getItem(`model-acceptance-${modelName}`));
  }, [modelName]);
  
  const hasAcceptance = !!acceptance;
  
  let acceptedAt = null;
  if (hasAcceptance) {
    try {
      acceptedAt = JSON.parse(acceptance).acceptedAt;
    } catch (error) {
      // corrupted data
    }
  }
  
  // Always render, but style changes based on acceptance
  const baseClasses = "flex items-center justify-center rounded-lg border-2 p-2 transition-all";
  const acceptedClasses = "border-green-500 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-600 dark:border-green-600 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50";
  const pendingClasses = "border-red-500 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-600 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50";
  
  const title = hasAcceptance 
    ? `🔓 Model unlocked for ${modelLabel} (accepted on ${new Date(acceptedAt).toLocaleDateString()})\n\nClick to review or retract consent`
    : `🔒 Model locked for ${modelLabel}\n\nClick to review and accept terms to unlock this model`;
  
  return (
    <button
      onClick={onReview}
      className={`${baseClasses} ${hasAcceptance ? acceptedClasses : pendingClasses}`}
      title={title}
      aria-label={hasAcceptance ? `Model unlocked for ${modelLabel} - Click to review` : `Model locked for ${modelLabel} - Click to unlock`}
    >
      {hasAcceptance ? (
        <Unlock className="h-5 w-5" />
      ) : (
        <Lock className="h-5 w-5" />
      )}
    </button>
  );
}

export default ModelAcceptanceStatus;
