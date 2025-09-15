'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { parseDataset } from '@/lib/categorizer-lab/parsers';
import { generateSyntheticData, generateScenario } from '@/lib/categorizer-lab/synthetic';
import { createDatasetSummary } from '@/lib/categorizer-lab/mappers';
import type { LabTransaction, SyntheticOptions } from '@/lib/categorizer-lab/types';

interface DatasetLoaderProps {
  onDatasetLoaded: (transactions: LabTransaction[]) => void;
  disabled?: boolean;
}

export function DatasetLoader({ onDatasetLoaded, disabled }: DatasetLoaderProps) {
  const [uploadMethod, setUploadMethod] = useState<'file' | 'paste' | 'synthetic' | 'scenario'>('synthetic');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastedData, setPastedData] = useState('');
  const [dataFormat, setDataFormat] = useState<'json' | 'csv'>('json');
  
  // Synthetic data options
  const [syntheticOptions, setSyntheticOptions] = useState<SyntheticOptions>({
    count: 50,
    vendorNoisePercent: 10,
    mccMix: 'balanced',
    positiveNegativeRatio: 0.8,
    seed: 'test-seed',
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
      
      const transactions = parseDataset({ format, data: content });
      const summary = createDatasetSummary(transactions);
      
      console.log('Dataset loaded:', summary);
      onDatasetLoaded(transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePastedData = () => {
    if (!pastedData.trim()) {
      setError('Please paste some data');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const transactions = parseDataset({ format: dataFormat, data: pastedData });
      const summary = createDatasetSummary(transactions);
      
      console.log('Dataset loaded:', summary);
      onDatasetLoaded(transactions);
      setPastedData('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyntheticData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const transactions = generateSyntheticData(syntheticOptions);
      
      if (!transactions || transactions.length === 0) {
        throw new Error('No transactions generated - check synthetic data configuration');
      }
      
      const summary = createDatasetSummary(transactions);
      onDatasetLoaded(transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate synthetic data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScenario = (scenario: 'ambiguous' | 'clear' | 'mixed') => {
    setIsLoading(true);
    setError(null);

    try {
      const transactions = generateScenario(scenario);
      const summary = createDatasetSummary(transactions);
      
      console.log('Scenario loaded:', summary);
      onDatasetLoaded(transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <Label htmlFor="upload-method">Data Source</Label>
          <select
            id="upload-method"
            value={uploadMethod}
            onChange={(e) => setUploadMethod(e.target.value as typeof uploadMethod)}
            className="w-full mt-1 rounded-md border border-gray-300 bg-white text-black py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={disabled}
          >
            <option value="synthetic">Generate Synthetic Data</option>
            <option value="scenario">Load Test Scenario</option>
            <option value="file">Upload File</option>
            <option value="paste">Paste Data</option>
          </select>
        </div>

        {uploadMethod === 'file' && (
          <div>
            <Label htmlFor="file-upload">Upload CSV or JSON File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              disabled={disabled || isLoading}
              className="mt-1"
              data-testid="file-input"
            />
            <p className="text-sm text-gray-500 mt-1">
              Supports CSV with headers or JSON format
            </p>
          </div>
        )}

        {uploadMethod === 'paste' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="data-format">Data Format</Label>
              <select
                id="data-format"
                value={dataFormat}
                onChange={(e) => setDataFormat(e.target.value as 'json' | 'csv')}
                className="w-full mt-1 rounded-md border border-gray-300 bg-white text-black py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={disabled}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pasted-data">Transaction Data</Label>
              <textarea
                id="pasted-data"
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
                rows={10}
                className="w-full mt-1 rounded-md border border-gray-300 bg-white text-black py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={dataFormat === 'json' ? 
                  '[\n  {\n    "id": "tx-1",\n    "description": "STARBUCKS STORE #123",\n    "amountCents": "-500",\n    "categoryId": "meals"\n  }\n]' :
                  'id,description,amount_cents,category_id\ntx-1,STARBUCKS STORE #123,-500,meals'
                }
                disabled={disabled}
              />
            </div>
            <Button 
              onClick={handlePastedData}
              disabled={disabled || isLoading || !pastedData.trim()}
            >
              {isLoading ? 'Processing...' : 'Load Data'}
            </Button>
          </div>
        )}

        {uploadMethod === 'synthetic' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="count">Number of Transactions</Label>
                <Input
                  id="count"
                  type="number"
                  min="1"
                  max="1000"
                  value={syntheticOptions.count}
                  onChange={(e) => setSyntheticOptions(prev => ({
                    ...prev,
                    count: parseInt(e.target.value) || 50
                  }))}
                  disabled={disabled}
                />
              </div>
              <div>
                <Label htmlFor="noise">Vendor Noise %</Label>
                <Input
                  id="noise"
                  type="number"
                  min="0"
                  max="100"
                  value={syntheticOptions.vendorNoisePercent}
                  onChange={(e) => setSyntheticOptions(prev => ({
                    ...prev,
                    vendorNoisePercent: parseInt(e.target.value) || 10
                  }))}
                  disabled={disabled}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mcc-mix">MCC Mix</Label>
                <select
                  id="mcc-mix"
                  value={syntheticOptions.mccMix}
                  onChange={(e) => setSyntheticOptions(prev => ({
                    ...prev,
                    mccMix: e.target.value as SyntheticOptions['mccMix']
                  }))}
                  className="w-full mt-1 rounded-md border border-gray-300 bg-white text-black py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={disabled}
                >
                  <option value="balanced">Balanced</option>
                  <option value="restaurant-heavy">Restaurant Heavy</option>
                  <option value="retail-heavy">Retail Heavy</option>
                  <option value="random">Random</option>
                </select>
              </div>
              <div>
                <Label htmlFor="seed">Random Seed</Label>
                <Input
                  id="seed"
                  value={syntheticOptions.seed || ''}
                  onChange={(e) => setSyntheticOptions(prev => ({
                    ...prev,
                    seed: e.target.value || undefined
                  }))}
                  placeholder="test-seed"
                  disabled={disabled}
                />
              </div>
            </div>

            <Button 
              onClick={handleSyntheticData}
              disabled={disabled || isLoading}
              className="w-full"
            >
              {isLoading ? 'Generating...' : 'Generate Synthetic Data'}
            </Button>
          </div>
        )}

        {uploadMethod === 'scenario' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Load predefined test scenarios to evaluate categorization behavior.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <Button 
                variant="outline"
                onClick={() => handleScenario('clear')}
                disabled={disabled || isLoading}
              >
                Clear Cases
                <Badge variant="secondary" className="ml-2">2 txs</Badge>
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleScenario('ambiguous')}
                disabled={disabled || isLoading}
              >
                Ambiguous Cases
                <Badge variant="secondary" className="ml-2">2 txs</Badge>
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleScenario('mixed')}
                disabled={disabled || isLoading}
              >
                Mixed Cases
                <Badge variant="secondary" className="ml-2">4 txs</Badge>
              </Button>
            </div>
          </div>
        )}

        {error && (
          <Alert>
            <div className="text-red-800">{error}</div>
          </Alert>
        )}

        <div className="text-sm text-gray-500">
          <p><strong>Expected Format:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li><code>id</code> - Unique transaction identifier</li>
            <li><code>description</code> - Transaction description (required)</li>
            <li><code>amountCents</code> - Amount in cents as string (required)</li>
            <li><code>merchantName</code> - Merchant name (optional)</li>
            <li><code>mcc</code> - Merchant category code (optional)</li>
            <li><code>date</code> - Date in YYYY-MM-DD format (optional)</li>
            <li><code>categoryId</code> - Ground truth category (optional, for accuracy)</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}