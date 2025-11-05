"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExecutionsClientProps {
  workflow: any;
  executions: any[];
  user: any;
}

export function ExecutionsClient({
  workflow,
  executions: initialExecutions,
  user,
}: ExecutionsClientProps) {
  const router = useRouter();
  const [executions, setExecutions] = useState(initialExecutions);
  const [selectedExecution, setSelectedExecution] = useState<any>(null);
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
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '-';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
      completed: 'default',
      running: 'secondary',
      failed: 'destructive',
      cancelled: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/workflows/${workflow.id}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Editor
          </Button>
          <div>
            <h1 className="text-xl font-bold">{workflow.name}</h1>
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
              Run the workflow to see execution history here
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell>
                      {formatDate(execution.startedAt)}
                    </TableCell>
                    <TableCell>{getStatusBadge(execution.status)}</TableCell>
                    <TableCell>{formatDuration(execution.duration)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {execution.triggeredById || 'System'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedExecution(execution)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedExecution}
        onOpenChange={() => setSelectedExecution(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
            <DialogDescription>
              Started: {selectedExecution && formatDate(selectedExecution.startedAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedExecution && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Status</h3>
                {getStatusBadge(selectedExecution.status)}
              </div>

              <div>
                <h3 className="font-medium mb-2">Duration</h3>
                <p className="text-sm">{formatDuration(selectedExecution.duration)}</p>
              </div>

              {selectedExecution.input && (
                <div>
                  <h3 className="font-medium mb-2">Input</h3>
                  <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs">
                    {JSON.stringify(selectedExecution.input, null, 2)}
                  </pre>
                </div>
              )}

              {selectedExecution.output && (
                <div>
                  <h3 className="font-medium mb-2">Output</h3>
                  <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs">
                    {JSON.stringify(selectedExecution.output, null, 2)}
                  </pre>
                </div>
              )}

              {selectedExecution.error && (
                <div>
                  <h3 className="font-medium mb-2 text-red-600">Error</h3>
                  <pre className="bg-red-50 p-4 rounded-md overflow-auto text-xs text-red-800">
                    {selectedExecution.error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
