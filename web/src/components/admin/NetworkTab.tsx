"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Hash, Icon, NodeRing } from "@/components/ui";
import { errorText } from "@/lib/format";
import { getNetwork, toggleNode } from "@/lib/tide";
import type { NetworkInfo } from "@/lib/tide";
import styles from "./Admin.module.css";

export function NetworkTab() {
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setNetwork(await getNetwork());
      setProblem(null);
    } catch (error) {
      setProblem(errorText(error));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function flip(id: number) {
    setBusy(id);
    try {
      await toggleNode(id);
      await load();
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setBusy(null);
    }
  }

  const online = network?.nodes.filter((node) => node.online).length ?? 0;
  const threshold = network?.threshold ?? 3;

  return (
    <div className="stack">
      {problem ? <Alert tone="danger" title="Network not reachable">{problem}</Alert> : null}
      {network ? (
        <>
          {online < threshold ? (
            <Alert tone="warn" title={`Only ${online} of ${network.nodes.length} nodes online`}>Below the threshold of {threshold}, nobody can seal or open papers. That is an outage, not a refusal: no node will be fooled into releasing a share.</Alert>
          ) : (
            <Alert tone="info" title={`${online} of ${network.nodes.length} nodes online, threshold ${threshold}`}>Turn nodes off to show that papers still open with any {threshold}, and that {threshold - 1} are never enough.</Alert>
          )}
          <Card title="ORK network" eyebrow="Simulated Tide nodes">
            <NodeRing
              nodes={network.nodes.map((node) => ({ id: node.id, state: node.online ? "ok" : "offline", detail: node.online ? "Holding its share of every exam key" : "Switched off for the demo" }))}
              threshold={threshold}
              okLabel="Online"
              showList={false}
              centerTitle={`${online} nodes online`}
              centerNote="Each node has its own key pair and checks every policy independently."
            />
            <div className={styles.nodeGrid}>
              {network.nodes.map((node) => (
                <div key={node.id} className={[styles.nodeCard, node.online ? "" : styles.nodeOff].join(" ")}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong className="mono">ORK {node.id}</strong>
                    <span className={node.online ? styles.on : styles.off}>{node.online ? "online" : "offline"}</span>
                  </div>
                  <Hash value={node.publicKey} head={10} tail={4} label={`Node ${node.id} public key`} />
                  <Button size="sm" variant={node.online ? "secondary" : "primary"} icon={<Icon name="power" />} onClick={() => flip(node.id)} busy={busy === node.id}>
                    {node.online ? "Take offline" : "Bring online"}
                  </Button>
                </div>
              ))}
            </div>
            <dl className={styles.facts}>
              <dt>Network signing key (Ed25519)</dt>
              <dd><Hash value={network.networkKey} head={16} tail={8} /></dd>
              <dt>Threshold</dt>
              <dd className="mono">{threshold} of {network.nodes.length}</dd>
            </dl>
          </Card>
        </>
      ) : null}
    </div>
  );
}
