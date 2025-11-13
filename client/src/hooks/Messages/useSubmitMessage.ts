import { v4 } from 'uuid';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Constants, replaceSpecialVars } from 'librechat-data-provider';
import { useChatContext, useChatFormContext, useAddedChatContext } from '~/Providers';
import { useAuthContext } from '~/hooks/AuthContext';
import { useGetStartupConfig } from '~/data-provider';
import store from '~/store';

const appendIndex = (index: number, value?: string) => {
  if (!value) {
    return value;
  }
  return `${value}${Constants.COMMON_DIVIDER}${index}`;
};

export default function useSubmitMessage() {
  const { user } = useAuthContext();
  const methods = useChatFormContext();
  const { ask, index, getMessages, setMessages, latestMessage, conversation } = useChatContext();
  const { addedIndex, ask: askAdditional, conversation: addedConvo } = useAddedChatContext();
  const { data: startupConfig } = useGetStartupConfig();
  const modelSpecs = startupConfig?.modelSpecs?.list ?? [];

  const autoSendPrompts = useRecoilValue(store.autoSendPrompts);
  const activeConvos = useRecoilValue(store.allConversationsSelector);
  const setActivePrompt = useSetRecoilState(store.activePromptByIndex(index));

  // Helper to check model consent
  const checkModelConsent = useCallback((convo: any) => {
    if (!convo) return true;
    
    const currentSpec = modelSpecs.find(spec => 
      spec.preset.endpoint === convo.endpoint && 
      spec.preset.model === convo.model
    );
    
    if (currentSpec?.modalInfo && currentSpec?.name) {
      // Check user's modelConsents from user object
      const hasConsent = user?.modelConsents?.some(
        (consent) => consent.modelName === currentSpec.name && !consent.revokedAt,
      );
      if (!hasConsent) {
        // Pass the specific model spec that needs consent
        window.dispatchEvent(new CustomEvent('review-model-terms', {
          detail: { modelSpec: currentSpec }
        }));
        console.warn(`Cannot send message: consent required for ${currentSpec.label || currentSpec.name}`);
        return false;
      }
    }
    
    return true;
  }, [modelSpecs, user?.modelConsents]);

  const submitMessage = useCallback(
    (data?: { text: string }) => {
      if (!data) {
        return console.warn('No data provided to submitMessage');
      }
      
      // PRE-FLIGHT CONSENT CHECK
      // Check root conversation consent
      if (!checkModelConsent(conversation)) {
        return; // Block submission
      }
      
      // Check added conversation consent if it exists
      const hasAddedConvo = addedIndex && activeConvos[addedIndex] && addedConvo;
      if (hasAddedConvo && !checkModelConsent(addedConvo)) {
        return; // Block submission
      }
      
      const rootMessages = getMessages();
      const isLatestInRootMessages = rootMessages?.some(
        (message) => message.messageId === latestMessage?.messageId,
      );
      if (!isLatestInRootMessages && latestMessage) {
        setMessages([...(rootMessages || []), latestMessage]);
      }

      const hasAdded = addedIndex && activeConvos[addedIndex] && addedConvo;
      const isNewMultiConvo =
        hasAdded &&
        activeConvos.every((convoId) => convoId === Constants.NEW_CONVO) &&
        !rootMessages?.length;
      const overrideConvoId = isNewMultiConvo ? v4() : undefined;
      const overrideUserMessageId = hasAdded ? v4() : undefined;
      const rootIndex = addedIndex - 1;
      const clientTimestamp = new Date().toISOString();

      ask({
        text: data.text,
        overrideConvoId: appendIndex(rootIndex, overrideConvoId),
        overrideUserMessageId: appendIndex(rootIndex, overrideUserMessageId),
        clientTimestamp,
      });

      if (hasAdded) {
        askAdditional(
          {
            text: data.text,
            overrideConvoId: appendIndex(addedIndex, overrideConvoId),
            overrideUserMessageId: appendIndex(addedIndex, overrideUserMessageId),
            clientTimestamp,
          },
          { overrideMessages: rootMessages },
        );
      }
      methods.reset();
    },
    [
      ask,
      methods,
      addedIndex,
      addedConvo,
      setMessages,
      getMessages,
      activeConvos,
      askAdditional,
      latestMessage,
      conversation,
      checkModelConsent,
    ],
  );

  const submitPrompt = useCallback(
    (text: string) => {
      const parsedText = replaceSpecialVars({ text, user });
      if (autoSendPrompts) {
        submitMessage({ text: parsedText });
        return;
      }

      const currentText = methods.getValues('text');
      const newText = currentText.trim().length > 1 ? `\n${parsedText}` : parsedText;
      setActivePrompt(newText);
    },
    [autoSendPrompts, submitMessage, setActivePrompt, methods, user],
  );

  return { submitMessage, submitPrompt };
}
