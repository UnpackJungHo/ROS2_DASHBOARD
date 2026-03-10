"use client";

import type { ActionInfo } from "@/lib/types";

interface ActionPanelProps {
  actions: ActionInfo[];
}

export default function ActionPanel({ actions }: ActionPanelProps) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
          Actions
        </h2>
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
          {actions.length}
        </span>
      </div>
      <div className="overflow-auto max-h-[400px]">
        {actions.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No actions found</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800">
              <tr className="text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr
                  key={a.name}
                  className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-2 text-orange-300 font-mono text-xs">
                    {a.name}
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs truncate max-w-[200px]">
                    {a.type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
