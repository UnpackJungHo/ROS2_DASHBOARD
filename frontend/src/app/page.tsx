"use client";

import { useState } from "react";
import DomainInput from "@/components/domain-input";
import TopicPanel from "@/components/topic-panel";
import ServicePanel from "@/components/service-panel";
import ActionPanel from "@/components/action-panel";
import NodePanel from "@/components/node-panel";
import NodeGraph from "@/components/node-graph";
import { useRosData } from "@/hooks/use-ros-data";

export default function Home() {
  const [domainId, setDomainId] = useState<number | null>(null);
  const { scan, graph, connected, loading, error, refresh } = useRosData({
    domainId,
    interval: 2000,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <DomainInput
        onSubmit={setDomainId}
        connected={connected}
        currentDomainId={domainId}
      />

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {domainId === null ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-lg">
              Enter a ROS_DOMAIN_ID to start monitoring
            </p>
            <p className="text-gray-600 text-sm mt-2">
              The dashboard will poll for topics, services, actions, and nodes
            </p>
          </div>
        </div>
      ) : (
        <main className="flex-1 p-6 flex flex-col min-h-0">
          {loading && !scan && (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm mt-2">
                Scanning domain {domainId}...
              </p>
            </div>
          )}

          {scan && (
            <div className="flex gap-6 h-full min-h-0">
              {/* Left: panels stacked vertically */}
              <div className="w-[800px] shrink-0 flex flex-col gap-4 overflow-y-auto">
                <TopicPanel topics={scan.topics} />
                <ServicePanel services={scan.services} />
                <NodePanel nodes={scan.nodes} />
                <ActionPanel actions={scan.actions} />
              </div>

              {/* Right: node graph fills remaining space */}
              <div className="flex-1 min-w-0">
                <NodeGraph data={graph} domainId={domainId} onRefresh={refresh} />
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
