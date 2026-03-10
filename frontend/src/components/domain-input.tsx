"use client";

import { useState, type FormEvent } from "react";

interface DomainInputProps {
  onSubmit: (domainId: number) => void;
  connected: boolean;
  currentDomainId: number | null;
}

export default function DomainInput({
  onSubmit,
  connected,
  currentDomainId,
}: DomainInputProps) {
  const [value, setValue] = useState(currentDomainId?.toString() ?? "0");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const id = parseInt(value, 10);
    if (!isNaN(id) && id >= 0 && id <= 232) {
      onSubmit(id);
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-700">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-white tracking-tight">
          ROS2 Dashboard
        </h1>
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
          Jazzy
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <label className="text-sm text-gray-300">DOMAIN_ID</label>
        <input
          type="number"
          min={0}
          max={232}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-center text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
        >
          Connect
        </button>

        <div className="flex items-center gap-2 ml-4">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              connected ? "bg-green-400" : "bg-red-400"
            }`}
          />
          <span className="text-xs text-gray-400">
            {connected ? "Connected" : "Disconnected"}
          </span>
          {currentDomainId !== null && (
            <span className="text-xs text-gray-500 ml-1">
              (ID: {currentDomainId})
            </span>
          )}
        </div>
      </form>
    </header>
  );
}
