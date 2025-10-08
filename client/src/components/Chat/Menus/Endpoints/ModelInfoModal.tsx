import { useState } from 'react';
import { OGDialog, DialogTemplate } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface ModelInfoModalProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  modelName: string | null;
  endpointName: string | null;
  specDescription?: string;
}

const ModelInfoModal = ({
  open,
  onOpenChange,
  modelName,
  endpointName,
  specDescription,
}: ModelInfoModalProps) => {
  const localize = useLocalize();
  const [acknowledgments, setAcknowledgments] = useState({
    dataProcessing: false,
    trainingData: false,
    incorrectInfo: false,
    costImpact: false,
    modelCard: false,
  });

  const handleCheckboxChange = (key: keyof typeof acknowledgments) => {
    setAcknowledgments((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allAcknowledged = Object.values(acknowledgments).every((v) => v);

  const handleAccept = () => {
    if (allAcknowledged) {
      // Reset acknowledgments for next time
      setAcknowledgments({
        dataProcessing: false,
        trainingData: false,
        incorrectInfo: false,
        costImpact: false,
        modelCard: false,
      });
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    // Reset acknowledgments
    setAcknowledgments({
      dataProcessing: false,
      trainingData: false,
      incorrectInfo: false,
      costImpact: false,
      modelCard: false,
    });
    onOpenChange(false);
  };

  const handleViewModelCard = () => {
    // Placeholder for viewing model card
    window.open('https://www.anthropic.com/claude', '_blank');
  };

  const getDisplayName = () => {
    return modelName || endpointName || 'Unknown Model';
  };

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
              {/* Intended Use */}
              <div>
                <h3 className="mb-2 font-semibold text-text-primary">Intended Use:</h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  This model is designed for complex research document analysis requiring long context (200K tokens), 
                  multi-step reasoning tasks requiring sophisticated logic chains, technical documentation synthesis 
                  across multiple sources, and advanced code generation and review. If your task doesn't require these 
                  specific capabilities, consider EU-hosted alternatives like GPT-4o or Mistral Large that may better 
                  meet your needs with stronger privacy protection.
                </p>
              </div>

              {/* You must understand */}
              <div>
                <h3 className="mb-3 font-semibold text-text-primary">You must understand the following:</h3>
                
                <div className="space-y-4">
                  {/* Geographic Processing */}
                  <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
                    <h4 className="mb-1 font-semibold text-yellow-800 dark:text-yellow-200">
                      Geographic Processing:
                    </h4>
                    <p className="mb-3 text-sm text-yellow-700 dark:text-yellow-300">
                      Your prompts and responses will be processed in United States datacenters (Oregon, Virginia). 
                      This constitutes international data transfer outside the European Union with different data 
                      protection standards.
                    </p>
                    <label className="flex cursor-pointer items-start gap-3 rounded border border-yellow-200 bg-yellow-100/50 p-2 dark:border-yellow-700 dark:bg-yellow-900/30">
                      <input
                        type="checkbox"
                        checked={acknowledgments.dataProcessing}
                        onChange={() => handleCheckboxChange('dataProcessing')}
                        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500 dark:border-yellow-600"
                      />
                      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        I understand my data will be processed in United States datacenters
                      </span>
                    </label>
                  </div>

                  {/* Training Data Transparency */}
                  <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
                    <h4 className="mb-1 font-semibold text-orange-800 dark:text-orange-200">
                      Training Data Transparency:
                    </h4>
                    <p className="mb-3 text-sm text-orange-700 dark:text-orange-300">
                      Anthropic does not disclose what data trained this model. We cannot independently verify bias 
                      mitigation approaches, content appropriateness, or potential copyright implications.
                    </p>
                    <label className="flex cursor-pointer items-start gap-3 rounded border border-orange-200 bg-orange-100/50 p-2 dark:border-orange-700 dark:bg-orange-900/30">
                      <input
                        type="checkbox"
                        checked={acknowledgments.trainingData}
                        onChange={() => handleCheckboxChange('trainingData')}
                        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-orange-400 text-orange-600 focus:ring-orange-500 dark:border-orange-600"
                      />
                      <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        I understand the provider has not disclosed training data sources and we cannot verify bias 
                        mitigation or content appropriateness
                      </span>
                    </label>
                  </div>

                  {/* Key Limitation */}
                  <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                    <h4 className="mb-1 font-semibold text-red-800 dark:text-red-200">
                      Key Limitation:
                    </h4>
                    <p className="mb-3 text-sm text-red-700 dark:text-red-300">
                      This model may generate confident but incorrect information, particularly for factual queries 
                      about recent events or specialized domains. Always verify critical information independently. 
                      Do not rely solely on outputs for high-stakes decisions.
                    </p>
                    <label className="flex cursor-pointer items-start gap-3 rounded border border-red-200 bg-red-100/50 p-2 dark:border-red-700 dark:bg-red-900/30">
                      <input
                        type="checkbox"
                        checked={acknowledgments.incorrectInfo}
                        onChange={() => handleCheckboxChange('incorrectInfo')}
                        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-red-400 text-red-600 focus:ring-red-500 dark:border-red-600"
                      />
                      <span className="text-sm font-medium text-red-800 dark:text-red-200">
                        I understand this model may generate incorrect information with high confidence and I will 
                        verify critical facts independently
                      </span>
                    </label>
                  </div>

                  {/* Cost Impact */}
                  <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                    <h4 className="mb-1 font-semibold text-blue-800 dark:text-blue-200">
                      Cost Impact:
                    </h4>
                    <p className="mb-3 text-sm text-blue-700 dark:text-blue-300">
                      High usage intensity approximately €0.40 per conversation (5x baseline models). Ensure your 
                      application justifies this cost premium over EU-hosted alternatives.
                    </p>
                    <label className="flex cursor-pointer items-start gap-3 rounded border border-blue-200 bg-blue-100/50 p-2 dark:border-blue-700 dark:bg-blue-900/30">
                      <input
                        type="checkbox"
                        checked={acknowledgments.costImpact}
                        onChange={() => handleCheckboxChange('costImpact')}
                        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-blue-400 text-blue-600 focus:ring-blue-500 dark:border-blue-600"
                      />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        I understand the cost implications and have considered whether EU-hosted alternatives (GPT-4o, 
                        Mistral Large) would meet my needs
                      </span>
                    </label>
                  </div>

                  {/* Model Card Acknowledgment */}
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40">
                    <label className="flex cursor-pointer items-start gap-3 rounded border border-gray-200 bg-gray-100/50 p-2 dark:border-gray-600 dark:bg-gray-700/30">
                      <input
                        type="checkbox"
                        checked={acknowledgments.modelCard}
                        onChange={() => handleCheckboxChange('modelCard')}
                        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-400 text-gray-600 focus:ring-gray-500 dark:border-gray-500"
                      />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        I have access to the complete model card and understand I should review it for detailed risk 
                        information, privacy practices, and compliance status
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>
        }
        buttons={
          <div className="flex w-full gap-2">
            <button
              onClick={handleViewModelCard}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border-medium bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-tertiary"
            >
              View Complete Model Card
            </button>
            <button
              onClick={handleCancel}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border-medium bg-surface-secondary px-6 py-2 text-sm font-medium text-text-primary hover:bg-surface-tertiary"
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={!allAcknowledged}
              className={`inline-flex h-10 items-center justify-center rounded-lg px-6 py-2 text-sm font-medium text-white transition-colors ${
                allAcknowledged
                  ? 'bg-green-500 hover:bg-green-600 focus:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700'
                  : 'cursor-not-allowed bg-gray-400 dark:bg-gray-600'
              }`}
            >
              Accept & Continue
            </button>
          </div>
        }
      />
    </OGDialog>
  );
};

export default ModelInfoModal;

