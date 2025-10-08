import { useState, useMemo } from 'react';
import { OGDialog, DialogTemplate } from '@librechat/client';
import type { TModelSpec } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

interface ModelInfoModalProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  modelSpec?: TModelSpec | null;
  modelName?: string | null;
  endpointName?: string | null;
}

const ModelInfoModal = ({
  open,
  onOpenChange,
  modelSpec,
  modelName,
  endpointName,
}: ModelInfoModalProps) => {
  const localize = useLocalize();

  // Extract modal info from modelSpec
  const modalInfo = modelSpec?.modalInfo;
  const hasModalInfo = !!modalInfo;
  const requireAcknowledgment = modalInfo?.requireAcknowledgment !== false; // Default to true
  
  // Build acknowledgment state from warnings + costInfo
  const acknowledgmentKeys = useMemo(() => {
    const keys: string[] = [];
    modalInfo?.warnings?.forEach((_, index) => keys.push(`warning-${index}`));
    if (modalInfo?.costInfo) {
      keys.push('costInfo');
    }
    return keys;
  }, [modalInfo]);

  const initialAcknowledgments = useMemo(() => {
    const acks: Record<string, boolean> = {};
    acknowledgmentKeys.forEach(key => acks[key] = false);
    return acks;
  }, [acknowledgmentKeys]);

  const [acknowledgments, setAcknowledgments] = useState(initialAcknowledgments);

  const handleCheckboxChange = (key: string) => {
    setAcknowledgments((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allAcknowledged = useMemo(() => {
    if (!requireAcknowledgment) return true;
    return acknowledgmentKeys.every(key => acknowledgments[key]);
  }, [requireAcknowledgment, acknowledgmentKeys, acknowledgments]);

  const handleAccept = () => {
    if (requireAcknowledgment && !allAcknowledged) return;
    
    // Reset acknowledgments for next time
    setAcknowledgments(initialAcknowledgments);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset acknowledgments
    setAcknowledgments(initialAcknowledgments);
    onOpenChange(false);
  };

  const handleViewModelCard = () => {
    if (modalInfo?.modelCardUrl) {
      window.open(modalInfo.modelCardUrl, '_blank');
    }
  };

  const getDisplayName = () => {
    return modelSpec?.label || modelName || endpointName || 'Unknown Model';
  };

  const getSeverityColors = (severity: 'info' | 'warning' | 'critical') => {
    switch (severity) {
      case 'info':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          text: 'text-blue-700 dark:text-blue-300',
          title: 'text-blue-800 dark:text-blue-200',
          border: 'border-blue-200 dark:border-blue-700',
          checkbox: 'border-blue-400 text-blue-600 focus:ring-blue-500 dark:border-blue-600',
          labelBg: 'bg-blue-100/50 dark:bg-blue-900/30',
        };
      case 'warning':
        return {
          bg: 'bg-orange-50 dark:bg-orange-900/20',
          text: 'text-orange-700 dark:text-orange-300',
          title: 'text-orange-800 dark:text-orange-200',
          border: 'border-orange-200 dark:border-orange-700',
          checkbox: 'border-orange-400 text-orange-600 focus:ring-orange-500 dark:border-orange-600',
          labelBg: 'bg-orange-100/50 dark:bg-orange-900/30',
        };
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          text: 'text-red-700 dark:text-red-300',
          title: 'text-red-800 dark:text-red-200',
          border: 'border-red-200 dark:border-red-700',
          checkbox: 'border-red-400 text-red-600 focus:ring-red-500 dark:border-red-600',
          labelBg: 'bg-red-100/50 dark:bg-red-900/30',
        };
    }
  };

  // If no modal info, don't show the modal or show simple message
  if (!hasModalInfo) {
    return null;
  }

  return (
    <OGDialog open={open} onOpenChange={handleCancel}>
      <DialogTemplate
        title={`Before using ${getDisplayName()}`}
        className="w-11/12 max-w-4xl sm:w-11/12 md:w-5/6 lg:w-4/5"
        showCloseButton={false}
        showCancelButton={false}
        main={
          <section
            tabIndex={0}
            className="max-h-[70vh] overflow-y-auto px-6 py-4"
            aria-label="Model Information and Acknowledgments"
          >
            <div className="space-y-5">
              {/* Intended Use - if provided */}
              {modalInfo.intendedUse && (
                <div>
                  <h3 className="mb-2 font-semibold text-text-primary">Intended Use:</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {modalInfo.intendedUse}
                  </p>
                </div>
              )}

              {/* Warnings Section - if provided */}
              {modalInfo.warnings && modalInfo.warnings.length > 0 && (
                <div>
                  <h3 className="mb-3 font-semibold text-text-primary">
                    {requireAcknowledgment ? 'You must understand the following:' : 'Important Information:'}
                  </h3>
                  
                  <div className="space-y-4">
                    {modalInfo.warnings.map((warning, index) => {
                      const colors = getSeverityColors(warning.severity);
                      const checkboxKey = `warning-${index}`;
                      
                      return (
                        <div key={index} className={`rounded-lg p-3 ${colors.bg}`}>
                          <h4 className={`mb-1 font-semibold ${colors.title}`}>
                            {warning.title}:
                          </h4>
                          <p className={`mb-3 text-sm ${colors.text}`}>
                            {warning.description}
                          </p>
                          {requireAcknowledgment && (
                            <label className={`flex cursor-pointer items-start gap-3 rounded border p-2 ${colors.border} ${colors.labelBg}`}>
                              <input
                                type="checkbox"
                                checked={acknowledgments[checkboxKey] || false}
                                onChange={() => handleCheckboxChange(checkboxKey)}
                                className={`mt-0.5 h-4 w-4 cursor-pointer rounded ${colors.checkbox}`}
                              />
                              <span className={`text-sm font-medium ${colors.title}`}>
                                {warning.acknowledgment}
                              </span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cost Info Section - if provided */}
              {modalInfo.costInfo && (
                <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                  <h4 className="mb-1 font-semibold text-blue-800 dark:text-blue-200">
                    Cost Information:
                  </h4>
                  <p className="mb-3 text-sm text-blue-700 dark:text-blue-300">
                    {modalInfo.costInfo.description}
                  </p>
                  {requireAcknowledgment && (
                    <label className="flex cursor-pointer items-start gap-3 rounded border border-blue-200 bg-blue-100/50 p-2 dark:border-blue-700 dark:bg-blue-900/30">
                      <input
                        type="checkbox"
                        checked={acknowledgments.costInfo || false}
                        onChange={() => handleCheckboxChange('costInfo')}
                        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-blue-400 text-blue-600 focus:ring-blue-500 dark:border-blue-600"
                      />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {modalInfo.costInfo.acknowledgment}
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>
          </section>
        }
        buttons={
          <div className="flex w-full gap-2">
            {modalInfo.modelCardUrl && (
              <button
                onClick={handleViewModelCard}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border-medium bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-tertiary"
              >
                View Complete Model Card
              </button>
            )}
            <button
              onClick={handleCancel}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border-medium bg-surface-secondary px-6 py-2 text-sm font-medium text-text-primary hover:bg-surface-tertiary"
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={requireAcknowledgment && !allAcknowledged}
              className={`inline-flex h-10 items-center justify-center rounded-lg px-6 py-2 text-sm font-medium text-white transition-colors ${
                !requireAcknowledgment || allAcknowledged
                  ? 'bg-green-500 hover:bg-green-600 focus:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700'
                  : 'cursor-not-allowed bg-gray-400 dark:bg-gray-600'
              }`}
            >
              {requireAcknowledgment ? 'Accept & Continue' : 'Continue'}
            </button>
          </div>
        }
      />
    </OGDialog>
  );
};

export default ModelInfoModal;

