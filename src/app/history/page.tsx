import { Suspense } from "react";
import Link from "next/link";
import { fetchRuns } from "@/actions/runs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, 
  Coins, 
  MessageSquare, 
  ExternalLink,
  History as HistoryIcon 
} from "lucide-react";

async function RunsTable() {
  const runs = await fetchRuns({ limit: 100 });

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <HistoryIcon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No runs yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Run a prompt to see it appear here
        </p>
        <Link href="/" className="mt-4">
          <Button>Browse Prompts</Button>
        </Link>
      </div>
    );
  }

  const formatCost = (cost: number | null) => {
    if (!cost) return "-";
    if (cost < 0.01) return `$${(cost * 100).toFixed(3)}¢`;
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prompt</TableHead>
            <TableHead>Provider / Model</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>Latency</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell>
                <div className="font-medium">{run.promptTitle}</div>
                {run.status === "error" && (
                  <Badge variant="destructive" className="mt-1">
                    Error
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">{run.provider}</div>
                <div className="text-xs text-muted-foreground">{run.model}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <MessageSquare className="h-3 w-3" />
                  {run.totalTokens?.toLocaleString() || "-"}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-3 w-3" />
                  {run.latencyMs ? `${(run.latencyMs / 1000).toFixed(2)}s` : "-"}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <Coins className="h-3 w-3" />
                  {formatCost(run.estimatedCost)}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-muted-foreground">
                  {run.createdAt
                    ? new Date(run.createdAt).toLocaleString()
                    : "-"}
                </div>
              </TableCell>
              <TableCell>
                {run.promptId && (
                  <Link href={`/prompt/${run.promptId}`}>
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Run History</h1>
        <p className="text-muted-foreground mt-1">
          View and analyze your past prompt executions
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <RunsTable />
      </Suspense>
    </div>
  );
}
