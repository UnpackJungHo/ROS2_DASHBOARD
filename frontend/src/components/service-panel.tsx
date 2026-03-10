"use client";

import type { ServiceInfo } from "@/lib/types";

interface ServicePanelProps {
  services: ServiceInfo[];
}

export default function ServicePanel({ services }: ServicePanelProps) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
          Services
        </h2>
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
          {services.length}
        </span>
      </div>
      <div className="overflow-auto max-h-[400px]">
        {services.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No services found</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800">
              <tr className="text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-center px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.name}
                  className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-2 text-purple-300 font-mono text-xs">
                    {s.name}
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs truncate max-w-[200px]">
                    {s.type}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        s.available ? "bg-green-400" : "bg-red-400"
                      }`}
                    />
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
