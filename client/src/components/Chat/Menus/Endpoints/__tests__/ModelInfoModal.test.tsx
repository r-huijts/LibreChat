import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tantml/react-query';
import { RecoilRoot } from 'recoil';
import ModelInfoModal from '../ModelInfoModal';
import { useAuthContext } from '~/hooks/AuthContext';
import {
  useAcceptModelConsentMutation,
  useRevokeModelConsentMutation,
} from '~/data-provider';

jest.mock('~/hooks/AuthContext');
jest.mock('~/data-provider', () => ({
  useAcceptModelConsentMutation: jest.fn(),
  useRevokeModelConsentMutation: jest.fn(),
}));
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>{children}</RecoilRoot>
    </QueryClientProvider>
  );
};

describe('ModelInfoModal', () => {
  const mockAcceptMutate = jest.fn();
  const mockRevokeMutate = jest.fn();
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthContext as jest.Mock).mockReturnValue({
      user: {
        id: 'user123',
        modelConsents: [],
      },
    });
    (useAcceptModelConsentMutation as jest.Mock).mockReturnValue({
      mutate: mockAcceptMutate,
    });
    (useRevokeModelConsentMutation as jest.Mock).mockReturnValue({
      mutate: mockRevokeMutate,
    });
  });

  const mockModelSpec = {
    name: 'test-model',
    label: 'Test Model',
    modalInfo: {
      intendedUse: 'Testing purposes',
      warnings: [
        {
          title: 'Warning 1',
          description: 'This is a warning',
          severity: 'warning' as const,
          acknowledgment: 'I understand the warning',
        },
      ],
      requireAcknowledgment: true,
    },
  };

  it('should render modal with model information', () => {
    render(
      <ModelInfoModal
        open={true}
        onOpenChange={mockOnOpenChange}
        modelSpec={mockModelSpec}
        modelName="test-model"
        endpointName="test-endpoint"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText(/Before using Test Model/i)).toBeInTheDocument();
    expect(screen.getByText('Testing purposes')).toBeInTheDocument();
    expect(screen.getByText('Warning 1:')).toBeInTheDocument();
  });

  it('should enable accept button when all acknowledgments are checked', async () => {
    render(
      <ModelInfoModal
        open={true}
        onOpenChange={mockOnOpenChange}
        modelSpec={mockModelSpec}
        modelName="test-model"
        endpointName="test-endpoint"
      />,
      { wrapper: createWrapper() },
    );

    const acceptButton = screen.getByText('Accept & Continue');
    expect(acceptButton).toBeDisabled();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(acceptButton).not.toBeDisabled();
    });
  });

  it('should call acceptMutation when accept is clicked', async () => {
    render(
      <ModelInfoModal
        open={true}
        onOpenChange={mockOnOpenChange}
        modelSpec={mockModelSpec}
        modelName="test-model"
        endpointName="test-endpoint"
      />,
      { wrapper: createWrapper() },
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const acceptButton = screen.getByText('Accept & Continue');
    fireEvent.click(acceptButton);

    expect(mockAcceptMutate).toHaveBeenCalledWith({
      modelName: 'test-model',
      modelLabel: 'Test Model',
    });
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show retract button when user has already accepted', () => {
    (useAuthContext as jest.Mock).mockReturnValue({
      user: {
        id: 'user123',
        modelConsents: [
          {
            modelName: 'test-model',
            acceptedAt: new Date().toISOString(),
            revokedAt: null,
          },
        ],
      },
    });

    render(
      <ModelInfoModal
        open={true}
        onOpenChange={mockOnOpenChange}
        modelSpec={mockModelSpec}
        modelName="test-model"
        endpointName="test-endpoint"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Retract Consent')).toBeInTheDocument();
    expect(screen.queryByText('Accept & Continue')).not.toBeInTheDocument();
  });

  it('should call revokeMutation when retract is clicked', () => {
    (useAuthContext as jest.Mock).mockReturnValue({
      user: {
        id: 'user123',
        modelConsents: [
          {
            modelName: 'test-model',
            acceptedAt: new Date().toISOString(),
            revokedAt: null,
          },
        ],
      },
    });

    render(
      <ModelInfoModal
        open={true}
        onOpenChange={mockOnOpenChange}
        modelSpec={mockModelSpec}
        modelName="test-model"
        endpointName="test-endpoint"
      />,
      { wrapper: createWrapper() },
    );

    const retractButton = screen.getByText('Retract Consent');
    fireEvent.click(retractButton);

    expect(mockRevokeMutate).toHaveBeenCalledWith('test-model');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});

