"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface ScenarioExecutionsClientProps {
  scenario: any;
  executions: any[];
  user: any;
}

export function ScenarioExecutionsClient({
  scenario,
  executions: initialExecutions,
  user,
}: ScenarioExecutionsClientProps) {
  const router = useRouter();
  const [executions, setExecutions] = useState(initialExecutions);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '-';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      running: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
      pending: 'bg-blue-100 text-blue-800',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/scenarios/${scenario.id}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Editor
          </Button>
          <div>
            <h1 className="text-xl font-bold">{scenario.name}</h1>
            <p className="text-sm text-gray-500">Execution History</p>
          </div>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          size="sm"
          variant="outline"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg font-medium">No executions yet</p>
            <p className="text-sm">
              Run the scenario to see execution history here
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Triggered By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow key={execution.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell>
                      {formatDate(execution.startedAt)}
                    </TableCell>
                    <TableCell>{getStatusBadge(execution.status)}</TableCell>
                    <TableCell>{formatDuration(execution.duration)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {execution.triggeredById || 'System'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/dashboard/scenarios/${scenario.id}/executions/${execution.id}`
                          )
                        }
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Flow
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
