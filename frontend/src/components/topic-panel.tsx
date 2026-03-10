"use client";

import type { TopicInfo } from "@/lib/types";

interface TopicPanelProps {
  topics: TopicInfo[];
}

export default function TopicPanel({ topics }: TopicPanelProps) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
          Topics
        </h2>
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
          {topics.length}
        </span>
      </div>
      <div className="overflow-auto max-h-[400px]">
        {topics.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No topics found</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800">
              <tr className="text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-center px-4 py-2">Pub</th>
                <th className="text-center px-4 py-2">Sub</th>
                <th className="text-center px-4 py-2">Hz</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr
                  key={t.name}
                  className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-2 text-blue-300 font-mono text-xs">
                    {t.name}
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs truncate max-w-[200px]">
                    {t.type}
                  </td>
                  <td className="px-4 py-2 text-center text-green-400">
                    {t.publishers}
                  </td>
                  <td className="px-4 py-2 text-center text-yellow-400">
                    {t.subscribers}
                  </td>
                  <td className="px-4 py-2 text-center text-gray-300">
                    {t.hz !== null ? `${t.hz.toFixed(1)}` : "-"}
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
