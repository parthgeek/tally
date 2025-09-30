'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ConnectBankButton } from '@/components/connect-bank-button';
import { DisconnectBankButton } from '@/components/disconnect-bank-button';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';
import type { ConnectionId } from '@nexus/types/contracts';

interface Account {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

interface Connection {
  id: string;
  provider: string;
  status: string;
  created_at: string;
  accounts: Account[];
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current org from cookie
      const cookies = document.cookie.split(';');
      const orgCookie = cookies.find(cookie => cookie.trim().startsWith('orgId='));
      const currentOrgId = orgCookie ? orgCookie.split('=')[1] : null;

      if (!currentOrgId) return;

      const { data, error } = await supabase
        .from('connections')
        .select(`
          id,
          provider,
          status,
          created_at,
          accounts (
            id,
            name,
            type,
            is_active
          )
        `)
        .eq('org_id', currentOrgId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching connections:', error);
        return;
      }

      setConnections(data || []);
    } catch (error) {
      console.error('Error in fetchConnections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromView = (connectionId: string) => {
    setConnections(prevConnections => 
      prevConnections.filter(conn => conn.id !== connectionId)
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Bank Connections</h1>
            <p className="text-muted-foreground">Loading your connections...</p>
          </div>
        </div>
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Bank Connections</h1>
          <p className="text-muted-foreground">
            Manage your connected bank accounts and payment processors
          </p>
        </div>
        <ConnectBankButton onSuccess={() => fetchConnections()} />
      </div>

      <div className="space-y-6">
        {connections.map((connection) => (
          <div key={connection.id} className="border rounded-lg p-6 relative">
            {connection.status === 'disconnected' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveFromView(connection.id)}
                className="absolute top-1 right-1 h-6 w-6 opacity-70 hover:opacity-100"
                aria-label="Remove from view"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold capitalize">
                  {connection.provider}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Connected {new Date(connection.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  connection.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : connection.status === 'disconnected'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {connection.status}
                </span>
                {connection.status === 'active' && (
                  <DisconnectBankButton
                    connectionId={connection.id as ConnectionId}
                    bankName={connection.provider}
                    accountCount={connection.accounts.length}
                    onSuccess={() => fetchConnections()}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Accounts ({connection.accounts.length}):</h4>
              {connection.accounts.map((account) => (
                <div key={account.id} className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded">
                  <span>{account.name}</span>
                  <span className="text-sm text-muted-foreground capitalize">
                    {account.type.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {connections.length === 0 && (
          <div className="text-center py-12">
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <div className="flex flex-col items-center justify-center space-y-4 py-12">
                <div className="rounded-full bg-accent p-3">
                  <svg className="h-8 w-8 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">No bank connections yet</h3>
                  <p className="text-muted-foreground max-w-md">
                    Connect your bank accounts to automatically import and categorize your transactions.
                  </p>
                </div>
                <ConnectBankButton onSuccess={() => fetchConnections()} />
                <p className="text-xs text-muted-foreground">
                  Secure connection powered by Plaid • Bank-level encryption
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}