"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

interface ProgressPanelProps {
  isRunning: boolean;
  progress?:
    | {
        processed: number;
        total: number;
        current?: string;
      }
    | undefined;
  errors?: string[];
  onCancel?: () => void;
}

export function ProgressPanel({ isRunning, progress, errors = [], onCancel }: ProgressPanelProps) {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Track elapsed time
  useEffect(() => {
    if (isRunning && !startTime) {
      setStartTime(Date.now());
    } else if (!isRunning) {
      setStartTime(null);
      setElapsedSeconds(0);
    }
  }, [isRunning, startTime]);

  useEffect(() => {
    if (!isRunning || !startTime) return;

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const progressPercent = progress ? (progress.processed / progress.total) * 100 : 0;
  const throughput = elapsedSeconds > 0 && progress ? progress.processed / elapsedSeconds : 0;
  const eta = throughput > 0 && progress ? (progress.total - progress.processed) / throughput : 0;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (!isRunning && !progress && errors.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <p>Load a dataset and configure settings to start categorization.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isRunning ? "Categorization in Progress" : "Progress Summary"}
          </h3>
          {isRunning && onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        {progress && (
          <div className="space-y-3">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>
                  {progress.processed} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {progressPercent.toFixed(1)}% complete
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-blue-600">{elapsedSeconds}</div>
                <div className="text-sm text-gray-500">Elapsed (s)</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-600">
                  {throughput > 0 ? throughput.toFixed(1) : "0"}
                </div>
                <div className="text-sm text-gray-500">Throughput (/s)</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-purple-600">
                  {eta > 0 && isRunning ? formatTime(Math.ceil(eta)) : "—"}
                </div>
                <div className="text-sm text-gray-500">ETA</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-red-600">{errors.length}</div>
                <div className="text-sm text-gray-500">Errors</div>
              </div>
            </div>

            {/* Current Transaction */}
            {progress.current && isRunning && (
              <div>
                <Badge variant="outline" className="text-xs">
                  Current: {progress.current}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Status */}
        <div className="flex items-center space-x-2">
          {isRunning ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Processing transactions...</span>
            </>
          ) : progress ? (
            <>
              <div className="h-4 w-4 rounded-full bg-green-600"></div>
              <span className="text-sm text-gray-600">
                Completed in {formatTime(elapsedSeconds)}
              </span>
            </>
          ) : null}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-red-800">Errors ({errors.length})</h4>
              <Button variant="outline" size="sm">
                Download Error Log
              </Button>
            </div>

            <div className="max-h-32 overflow-y-auto">
              {errors.slice(0, 5).map((error, index) => (
                <Alert key={index} className="mb-2">
                  <div className="text-sm text-red-800">{error}</div>
                </Alert>
              ))}
              {errors.length > 5 && (
                <div className="text-sm text-gray-500 text-center">
                  ... and {errors.length - 5} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Notes */}
        {!isRunning && progress && (
          <div className="text-sm text-gray-500 border-t pt-3">
            <p>
              <strong>Performance Summary:</strong>
            </p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>
                Processed {progress.total} transactions in {formatTime(elapsedSeconds)}
              </li>
              <li>Average throughput: {throughput.toFixed(2)} transactions/second</li>
              {errors.length > 0 && (
                <li className="text-red-600">
                  {errors.length} transactions failed (
                  {((errors.length / progress.total) * 100).toFixed(1)}% error rate)
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
