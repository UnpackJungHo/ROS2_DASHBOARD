"use client";

import type { NodeInfo } from "@/lib/types";

interface NodePanelProps {
  nodes: NodeInfo[];
}

export default function NodePanel({ nodes }: NodePanelProps) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
          Nodes
        </h2>
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
          {nodes.length}
        </span>
      </div>
      <div className="overflow-auto max-h-[400px]">
        {nodes.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No nodes found</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {nodes.map((n) => (
              <li
                key={`${n.namespace}/${n.name}`}
                className="px-4 py-2.5 hover:bg-gray-800/50 transition-colors flex items-center gap-2"
              >
                <span className="text-cyan-300 font-mono text-xs">
                  {n.name}
                </span>
                {n.namespace !== "/" && (
                  <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                    {n.namespace}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
