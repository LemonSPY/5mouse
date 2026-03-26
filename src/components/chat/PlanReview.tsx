"use client";

interface PlanReviewProps {
  onApprove: () => void;
  onReject: () => void;
}

export function PlanReview({ onApprove, onReject }: PlanReviewProps) {
  return (
    <div className="flex items-center gap-3 p-4 mx-auto max-w-4xl">
      <div className="flex-1 text-sm text-zinc-400">
        Review the plan above. Approve to start building, or reject to start over.
      </div>
      <button
        onClick={onReject}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        Reject
      </button>
      <button
        onClick={onApprove}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition-colors"
      >
        Approve & Build
      </button>
    </div>
  );
}
