'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { InfoIcon, AlertTriangleIcon, ZapIcon } from 'lucide-react';

interface Signal {
  type: string;
  evidence: string;
  confidence: number;
  strength: string;
  category?: string;
}

interface GuardrailViolation {
  type: string;
  reason: string;
  suggestedAction?: string;
}

export interface RationaleData {
  rationale: string[];
  signals?: Signal[];
  guardrailsApplied?: boolean;
  guardrailViolations?: string[];
  pass1Context?: {
    topSignals: string[];
    mccMapping?: string;
    vendorMatch?: string;
    confidence: number;
  } | undefined;
  engine: 'pass1' | 'llm';
  confidence?: number;
}

interface RationalePopoverProps {
  data: RationaleData;
  children: React.ReactNode;
}

export function RationalePopover({ data, children }: RationalePopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-auto text-blue-600 hover:text-blue-800 hover:bg-blue-50"
        >
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start" side="right">
        <div className="max-h-96 overflow-y-auto">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <InfoIcon className="w-4 h-4" />
                Categorization Details
              </h4>
              <div className="flex items-center gap-2">
                <Badge variant={data.engine === 'llm' ? 'default' : 'secondary'} className="text-xs">
                  {data.engine === 'llm' ? 'LLM' : 'Pass-1'}
                </Badge>
                {data.confidence && (
                  <Badge variant="outline" className="text-xs">
                    {(data.confidence * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Guardrail Violations */}
            {data.guardrailsApplied && data.guardrailViolations && data.guardrailViolations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangleIcon className="w-4 h-4" />
                  <span className="font-medium text-sm">Guardrails Applied</span>
                </div>
                <div className="space-y-1">
                  {data.guardrailViolations.map((violation, index) => (
                    <div key={index} className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
                      {violation}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signals Table (for Pass-1) */}
            {data.signals && data.signals.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ZapIcon className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">Detected Signals</span>
                </div>
                <div className="space-y-1">
                  {data.signals
                    .sort((a, b) => b.confidence - a.confidence)
                    .slice(0, 5) // Show top 5 signals
                    .map((signal, index) => (
                      <div key={index} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: getSignalColor(signal.type),
                              color: getSignalColor(signal.type)
                            }}
                          >
                            {signal.type}
                          </Badge>
                          <span className="truncate max-w-32" title={signal.evidence}>
                            {signal.evidence}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-12 bg-gray-200 rounded-full h-1">
                            <div
                              className="h-1 rounded-full bg-blue-500"
                              style={{ width: `${signal.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono min-w-10 text-right">
                            {(signal.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Pass-1 Context (for LLM) */}
            {data.pass1Context && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ZapIcon className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-sm">Pass-1 Context</span>
                  <Badge variant="outline" className="text-xs">
                    {(data.pass1Context.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
                <div className="space-y-1">
                  {data.pass1Context.mccMapping && (
                    <div className="text-xs bg-green-50 border border-green-200 rounded p-2">
                      <strong>MCC:</strong> {data.pass1Context.mccMapping}
                    </div>
                  )}
                  {data.pass1Context.vendorMatch && (
                    <div className="text-xs bg-green-50 border border-green-200 rounded p-2">
                      <strong>Vendor:</strong> {data.pass1Context.vendorMatch}
                    </div>
                  )}
                  {data.pass1Context.topSignals.length > 0 && (
                    <div className="text-xs bg-green-50 border border-green-200 rounded p-2">
                      <strong>Signals:</strong>
                      <ul className="mt-1 space-y-1 ml-2">
                        {data.pass1Context.topSignals.map((signal, index) => (
                          <li key={index} className="text-xs">• {signal}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rationale */}
            {data.rationale && data.rationale.length > 0 && (
              <div className="space-y-2">
                <span className="font-medium text-sm">Reasoning</span>
                <div className="space-y-1">
                  {data.rationale.map((reason, index) => (
                    <div key={index} className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                      {reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {(!data.rationale || data.rationale.length === 0) &&
             (!data.signals || data.signals.length === 0) &&
             !data.pass1Context && (
              <div className="text-center text-gray-500 py-4">
                <InfoIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No detailed rationale available</p>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Get color for different signal types
 */
function getSignalColor(signalType: string): string {
  const colors = {
    mcc: '#3b82f6', // blue
    vendor: '#10b981', // emerald
    keyword: '#f59e0b', // amber
    amount: '#8b5cf6', // violet
    pattern: '#ef4444', // red
    default: '#6b7280' // gray
  };

  return colors[signalType as keyof typeof colors] || colors.default;
}