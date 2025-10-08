import debounce from 'lodash/debounce';
import React, { createContext, useContext, useState, useMemo } from 'react';
import { EModelEndpoint, isAgentsEndpoint, isAssistantsEndpoint } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import type { Endpoint, SelectedValues } from '~/common';
import {
  useAgentDefaultPermissionLevel,
  useSelectorEffects,
  useKeyDialog,
  useEndpoints,
} from '~/hooks';
import { useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import { useGetEndpointsQuery, useListAgentsQuery } from '~/data-provider';
import { useModelSelectorChatContext } from './ModelSelectorChatContext';
import useSelectMention from '~/hooks/Input/useSelectMention';
import { filterItems } from './utils';

type ModelSelectorContextType = {
  // State
  searchValue: string;
  selectedValues: SelectedValues;
  endpointSearchValues: Record<string, string>;
  searchResults: (t.TModelSpec | Endpoint)[] | null;
  // LibreChat
  modelSpecs: t.TModelSpec[];
  mappedEndpoints: Endpoint[];
  agentsMap: t.TAgentsMap | undefined;
  assistantsMap: t.TAssistantsMap | undefined;
  endpointsConfig: t.TEndpointsConfig;

  // Functions
  endpointRequiresUserKey: (endpoint: string) => boolean;
  setSelectedValues: React.Dispatch<React.SetStateAction<SelectedValues>>;
  setSearchValue: (value: string) => void;
  setEndpointSearchValue: (endpoint: string, value: string) => void;
  handleSelectSpec: (spec: t.TModelSpec) => void;
  handleSelectEndpoint: (endpoint: Endpoint) => void;
  handleSelectModel: (endpoint: Endpoint, model: string) => void;
  // Model Info Modal
  modelInfoModalOpen: boolean;
  setModelInfoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedModelInfo: {
    modelName: string | null;
    endpointName: string | null;
    specDescription?: string;
  };
} & ReturnType<typeof useKeyDialog>;

const ModelSelectorContext = createContext<ModelSelectorContextType | undefined>(undefined);

export function useModelSelectorContext() {
  const context = useContext(ModelSelectorContext);
  if (context === undefined) {
    throw new Error('useModelSelectorContext must be used within a ModelSelectorProvider');
  }
  return context;
}

interface ModelSelectorProviderProps {
  children: React.ReactNode;
  startupConfig: t.TStartupConfig | undefined;
}

export function ModelSelectorProvider({ children, startupConfig }: ModelSelectorProviderProps) {
  const agentsMap = useAgentsMapContext();
  const assistantsMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { endpoint, model, spec, agent_id, assistant_id, newConversation } =
    useModelSelectorChatContext();
  const modelSpecs = useMemo(() => {
    const specs = startupConfig?.modelSpecs?.list ?? [];
    if (!agentsMap) {
      return specs;
    }

    /**
     * Filter modelSpecs to only include agents the user has access to.
     * Use agentsMap which already contains permission-filtered agents (consistent with other components).
     */
    return specs.filter((spec) => {
      if (spec.preset?.endpoint === EModelEndpoint.agents && spec.preset?.agent_id) {
        return spec.preset.agent_id in agentsMap;
      }
      /** Keep non-agent modelSpecs */
      return true;
    });
  }, [startupConfig, agentsMap]);

  const permissionLevel = useAgentDefaultPermissionLevel();
  const { data: agents = null } = useListAgentsQuery(
    { requiredPermission: permissionLevel },
    {
      select: (data) => data?.data,
    },
  );

  const { mappedEndpoints, endpointRequiresUserKey } = useEndpoints({
    agents,
    assistantsMap,
    startupConfig,
    endpointsConfig,
  });

  const { onSelectEndpoint, onSelectSpec } = useSelectMention({
    // presets,
    modelSpecs,
    assistantsMap,
    endpointsConfig,
    newConversation,
    returnHandlers: true,
  });

  // State
  const [selectedValues, setSelectedValues] = useState<SelectedValues>({
    endpoint: endpoint || '',
    model: model || '',
    modelSpec: spec || '',
  });
  useSelectorEffects({
    agentsMap,
    conversation: endpoint
      ? ({
          endpoint: endpoint ?? null,
          model: model ?? null,
          spec: spec ?? null,
          agent_id: agent_id ?? null,
          assistant_id: assistant_id ?? null,
        } as any)
      : null,
    assistantsMap,
    setSelectedValues,
  });

  const [searchValue, setSearchValueState] = useState('');
  const [endpointSearchValues, setEndpointSearchValues] = useState<Record<string, string>>({});

  // Model Info Modal state
  const [modelInfoModalOpen, setModelInfoModalOpen] = useState(false);
  const [previousSelection, setPreviousSelection] = useState<SelectedValues>({
    endpoint: endpoint || '',
    model: model || '',
    modelSpec: spec || '',
  });
  const [selectedModelInfo, setSelectedModelInfo] = useState<{
    modelName: string | null;
    endpointName: string | null;
    specDescription?: string;
  }>({
    modelName: null,
    endpointName: null,
  });

  const keyProps = useKeyDialog();

  /** Memoized search results */
  const searchResults = useMemo(() => {
    if (!searchValue) {
      return null;
    }
    const allItems = [...modelSpecs, ...mappedEndpoints];
    return filterItems(allItems, searchValue, agentsMap, assistantsMap || {});
  }, [searchValue, modelSpecs, mappedEndpoints, agentsMap, assistantsMap]);

  const setDebouncedSearchValue = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValueState(value);
      }, 200),
    [],
  );
  const setEndpointSearchValue = (endpoint: string, value: string) => {
    setEndpointSearchValues((prev) => ({
      ...prev,
      [endpoint]: value,
    }));
  };

  const handleSelectSpec = (spec: t.TModelSpec) => {
    let model = spec.preset.model ?? null;
    onSelectSpec?.(spec);
    if (isAgentsEndpoint(spec.preset.endpoint)) {
      model = spec.preset.agent_id ?? '';
    } else if (isAssistantsEndpoint(spec.preset.endpoint)) {
      model = spec.preset.assistant_id ?? '';
    }
    
    const newSelection = {
      endpoint: spec.preset.endpoint,
      model,
      modelSpec: spec.name,
    };
    
    // Check if selection changed
    const hasChanged = 
      previousSelection.endpoint !== newSelection.endpoint ||
      previousSelection.model !== newSelection.model ||
      previousSelection.modelSpec !== newSelection.modelSpec;
    
    if (hasChanged) {
      setSelectedModelInfo({
        modelName: spec.label || spec.name,
        endpointName: spec.preset.endpoint,
        specDescription: spec.description,
      });
      setModelInfoModalOpen(true);
      setPreviousSelection(newSelection);
    }
    
    setSelectedValues(newSelection);
  };

  const handleSelectEndpoint = (endpoint: Endpoint) => {
    if (!endpoint.hasModels) {
      if (endpoint.value) {
        onSelectEndpoint?.(endpoint.value);
      }
      
      const newSelection = {
        endpoint: endpoint.value,
        model: '',
        modelSpec: '',
      };
      
      // Check if selection changed
      const hasChanged = 
        previousSelection.endpoint !== newSelection.endpoint ||
        previousSelection.model !== newSelection.model ||
        previousSelection.modelSpec !== newSelection.modelSpec;
      
      if (hasChanged) {
        setSelectedModelInfo({
          modelName: endpoint.label,
          endpointName: endpoint.value,
        });
        setModelInfoModalOpen(true);
        setPreviousSelection(newSelection);
      }
      
      setSelectedValues(newSelection);
    }
  };

  const handleSelectModel = (endpoint: Endpoint, model: string) => {
    if (isAgentsEndpoint(endpoint.value)) {
      onSelectEndpoint?.(endpoint.value, {
        agent_id: model,
        model: agentsMap?.[model]?.model ?? '',
      });
    } else if (isAssistantsEndpoint(endpoint.value)) {
      onSelectEndpoint?.(endpoint.value, {
        assistant_id: model,
        model: assistantsMap?.[endpoint.value]?.[model]?.model ?? '',
      });
    } else if (endpoint.value) {
      onSelectEndpoint?.(endpoint.value, { model });
    }
    
    const newSelection = {
      endpoint: endpoint.value,
      model,
      modelSpec: '',
    };
    
    // Check if selection changed
    const hasChanged = 
      previousSelection.endpoint !== newSelection.endpoint ||
      previousSelection.model !== newSelection.model ||
      previousSelection.modelSpec !== newSelection.modelSpec;
    
    if (hasChanged) {
      // Get display name based on endpoint type
      let modelDisplayName = model;
      if (isAgentsEndpoint(endpoint.value) && endpoint.agentNames?.[model]) {
        modelDisplayName = endpoint.agentNames[model];
      } else if (isAssistantsEndpoint(endpoint.value) && endpoint.assistantNames?.[model]) {
        modelDisplayName = endpoint.assistantNames[model];
      }
      
      setSelectedModelInfo({
        modelName: modelDisplayName,
        endpointName: endpoint.label,
      });
      setModelInfoModalOpen(true);
      setPreviousSelection(newSelection);
    }
    
    setSelectedValues(newSelection);
  };

  const value = {
    // State
    searchValue,
    searchResults,
    selectedValues,
    endpointSearchValues,
    // LibreChat
    agentsMap,
    modelSpecs,
    assistantsMap,
    mappedEndpoints,
    endpointsConfig,

    // Functions
    handleSelectSpec,
    handleSelectModel,
    setSelectedValues,
    handleSelectEndpoint,
    setEndpointSearchValue,
    endpointRequiresUserKey,
    setSearchValue: setDebouncedSearchValue,
    // Model Info Modal
    modelInfoModalOpen,
    setModelInfoModalOpen,
    selectedModelInfo,
    // Dialog
    ...keyProps,
  };

  return <ModelSelectorContext.Provider value={value}>{children}</ModelSelectorContext.Provider>;
}
