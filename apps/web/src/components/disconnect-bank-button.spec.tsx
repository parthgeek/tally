import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DisconnectBankButton } from './disconnect-bank-button';
import type { ConnectionId } from '@nexus/types/contracts';

// Mock the toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DisconnectBankButton', () => {
  const mockProps = {
    connectionId: 'conn-123' as ConnectionId,
    bankName: 'Chase Bank',
    accountCount: 2,
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    test('renders disconnect button', () => {
      render(React.createElement(DisconnectBankButton, mockProps));

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      expect(disconnectButton).toBeInTheDocument();
      expect(disconnectButton).not.toBeDisabled();
    });

    test('renders disabled when disabled prop is true', () => {
      render(React.createElement(DisconnectBankButton, { ...mockProps, disabled: true }));

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      expect(disconnectButton).toBeDisabled();
    });
  });

  describe('dialog interaction', () => {
    test('opens confirmation dialog when clicked', async () => {
      render(React.createElement(DisconnectBankButton, mockProps));

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText('Disconnect Bank Account')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to disconnect/)).toBeInTheDocument();
        expect(screen.getByText('Chase Bank')).toBeInTheDocument();
      });
    });

    test('shows correct account count in dialog', async () => {
      render(React.createElement(DisconnectBankButton, mockProps));

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText(/Your 2 connected accounts will be deactivated/)).toBeInTheDocument();
      });
    });

    test('shows singular account text for single account', async () => {
      render(React.createElement(DisconnectBankButton, { ...mockProps, accountCount: 1 }));

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText(/Your 1 connected account will be deactivated/)).toBeInTheDocument();
      });
    });

    test('closes dialog when cancel is clicked', async () => {
      render(React.createElement(DisconnectBankButton, mockProps));

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText('Disconnect Bank Account')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Disconnect Bank Account')).not.toBeInTheDocument();
      });
    });
  });

  describe('handleDisconnect', () => {
    test('successfully disconnects and calls onSuccess', async () => {
      const { useToast } = await import('@/components/ui/use-toast');
      const mockToast = vi.fn();
      vi.mocked(useToast).mockReturnValue({ toast: mockToast });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Bank account disconnected successfully',
        }),
      });

      render(React.createElement(DisconnectBankButton, mockProps));

      // Open dialog
      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText('Disconnect Bank Account')).toBeInTheDocument();
      });

      // Click disconnect in dialog
      const confirmButton = screen.getByRole('button', { name: /disconnect bank/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/connections/disconnect', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connectionId: mockProps.connectionId,
          }),
        });
      });

      await waitFor(() => {
        expect(mockProps.onSuccess).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Bank account disconnected',
          description: 'Bank account disconnected successfully',
        });
      });
    });

    test('handles disconnect failure with error message', async () => {
      const { useToast } = await import('@/components/ui/use-toast');
      const mockToast = vi.fn();
      vi.mocked(useToast).mockReturnValue({ toast: mockToast });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
          message: 'Failed to revoke access token',
        }),
      });

      render(React.createElement(DisconnectBankButton, mockProps));

      // Open dialog
      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText('Disconnect Bank Account')).toBeInTheDocument();
      });

      // Click disconnect in dialog
      const confirmButton = screen.getByRole('button', { name: /disconnect bank/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Disconnect failed',
          description: 'Failed to revoke access token',
          variant: 'destructive',
        });
      });

      // Dialog should remain open on failure
      expect(screen.getByText('Disconnect Bank Account')).toBeInTheDocument();
    });

    test('shows loading state during disconnect', async () => {
      // Mock a slow response
      let resolvePromise: (value: any) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValue(slowPromise);

      render(React.createElement(DisconnectBankButton, mockProps));

      // Open dialog
      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText('Disconnect Bank Account')).toBeInTheDocument();
      });

      // Click disconnect in dialog
      const confirmButton = screen.getByRole('button', { name: /disconnect bank/i });
      fireEvent.click(confirmButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Disconnecting...')).toBeInTheDocument();
      });

      // Should disable buttons during loading
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /disconnecting/i })).toBeDisabled();

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true, message: 'Success' }),
      });

      await waitFor(() => {
        expect(screen.queryByText('Disconnecting...')).not.toBeInTheDocument();
      });
    });

    test('handles network errors gracefully', async () => {
      const { useToast } = await import('@/components/ui/use-toast');
      const mockToast = vi.fn();
      vi.mocked(useToast).mockReturnValue({ toast: mockToast });

      mockFetch.mockRejectedValue(new Error('Network error'));

      render(React.createElement(DisconnectBankButton, mockProps));

      // Open dialog
      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText('Disconnect Bank Account')).toBeInTheDocument();
      });

      // Click disconnect in dialog
      const confirmButton = screen.getByRole('button', { name: /disconnect bank/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Disconnect failed',
          description: 'Network error',
          variant: 'destructive',
        });
      });
    });
  });
});