import { useEffect, useState, useCallback } from 'react'

const N8N_PORT = 5678
const LUCIFERSHELL_IP = '192.168.0.222'

export default function N8nHQ({ onBack }) {
  const [status, setStatus] = useState('checking')
  const [containerState, setContainerState] = useState(null)
  const [busy, setBusy] = useState({})
  const [workflows, setWorkflows] = useState(null)

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/docker/containers')
      const data = await res.json()
      if (!data.ok) { setStatus('offline'); return }

      const n8n = (data.containers || []).find((c) => c.name === 'n8n')
      if (!n8n) {
        setContainerState(null)
        setStatus('not-deployed')
        return
      }

      setContainerState(n8n)
      if (n8n.state === 'running') {
        setStatus('running')
        // Try to get workflow count
        try {
          const wfRes = await fetch(`http://${LUCIFERSHELL_IP}:${N8N_PORT}/api/v1/workflows`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(3000),
          })
          if (wfRes.ok) {
            const wfData = await wfRes.json()
            setWorkflows(wfData.data?.length ?? null)
          }
        } catch {
          setWorkflows(null)
        }
      } else {
        setStatus('stopped')
      }
    } catch {
      setStatus('offline')
    }
  }, [])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [checkStatus])

  const deploy = async () => {
    setBusy((p) => ({ ...p, deploy: true }))
    try {
      await fetch('/api/docker/n8n/deploy', { method: 'POST' })
      await new Promise((r) => setTimeout(r, 3000))
      await checkStatus()
    } catch {}
    setBusy((p) => ({ ...p, deploy: false }))
  }

  const startN8n = async () => {
    setBusy((p) => ({ ...p, start: true }))
    try {
      await fetch('/api/docker/containers/n8n/start', { method: 'POST' })
      await new Promise((r) => setTimeout(r, 2000))
      await checkStatus()
    } catch {}
    setBusy((p) => ({ ...p, start: false }))
  }

  const stopN8n = async () => {
    setBusy((p) => ({ ...p, stop: true }))
    try {
      await fetch('/api/docker/containers/n8n/stop', { method: 'POST' })
      await new Promise((r) => setTimeout(r, 2000))
      await checkStatus()
    } catch {}
    setBusy((p) => ({ ...p, stop: false }))
  }

  const restartN8n = async () => {
    setBusy((p) => ({ ...p, restart: true }))
    try {
      await fetch('/api/docker/containers/n8n/restart', { method: 'POST' })
      await new Promise((r) => setTimeout(r, 3000))
      await checkStatus()
    } catch {}
    setBusy((p) => ({ ...p, restart: false }))
  }

  const statusColor = status === 'running' ? 'text-emerald-400' : status === 'stopped' ? 'text-yellow-400' : status === 'not-deployed' ? 'text-zinc-500' : 'text-red-400'
  const statusDot = status === 'running' ? 'bg-emerald-500 animate-pulse' : status === 'stopped' ? 'bg-yellow-500' : 'bg-zinc-600'

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <section className="rounded-[2rem] border border-orange-900/60 bg-gradient-to-b from-[#0a0500] to-black p-10 shadow-2xl">
            <p className="mb-6 text-xs uppercase tracking-[0.4em] text-orange-500/70">
              Automation HQ
            </p>

            <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
              n8n<br />
              <span className="text-orange-500">Workflows</span>
            </h1>

            <p className="mt-8 max-w-4xl text-xl leading-relaxed text-zinc-400">
              Automation platform voor het hele cluster. Bouw workflows die
              services koppelen, data verwerken en processen automatiseren.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <Card title="Automation" body="Visual workflow builder met 400+ integraties. Koppel APIs, databases en AI models." />
              <Card title="Self-hosted" body="Draait als Docker container op Lucifershell. Volledige controle over je data." />
            </div>

            <button
              onClick={onBack}
              className="mt-6 w-full rounded-2xl border border-orange-700 bg-orange-950/20 px-8 py-6 text-2xl font-semibold text-white transition hover:scale-[1.01] hover:border-orange-500 hover:bg-orange-950/30 hover:shadow-lg hover:shadow-orange-500/20"
            >
              ← Cluster HQ
            </button>
          </section>

          <section className="rounded-[2rem] border border-orange-900/40 bg-black p-8 shadow-2xl">
            <div className="mb-8 flex items-start justify-between">
              <h2 className="text-5xl font-semibold">n8n</h2>
              <div className="flex items-center gap-3 pt-2">
                <div className={`h-3 w-3 rounded-full ${statusDot}`} />
                <span className={`text-xs uppercase tracking-[0.35em] ${statusColor}`}>
                  {status === 'running' ? 'Online' : status === 'stopped' ? 'Stopped' : status === 'not-deployed' ? 'Not Deployed' : 'Checking...'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <InfoRow label="Host" value="Lucifershell" />
              <InfoRow label="Port" value={N8N_PORT} />
              <InfoRow label="Container" value={containerState?.name || 'n8n'} />
              <InfoRow label="Image" value={containerState?.image || 'n8nio/n8n:latest'} />
              <InfoRow label="Status" value={containerState?.status || 'Not deployed'} />
              {workflows !== null && <InfoRow label="Workflows" value={workflows} />}
            </div>

            <div className="mt-6 space-y-3">
              {status === 'not-deployed' && (
                <ActionButton
                  label="🚀 Deploy n8n"
                  busy={busy.deploy}
                  onClick={deploy}
                  color="orange"
                />
              )}

              {status === 'stopped' && (
                <ActionButton
                  label="▶ Start n8n"
                  busy={busy.start}
                  onClick={startN8n}
                  color="emerald"
                />
              )}

              {status === 'running' && (
                <>
                  <ActionButton
                    label="⏹ Stop n8n"
                    busy={busy.stop}
                    onClick={stopN8n}
                    color="red"
                  />
                  <ActionButton
                    label="🔄 Restart n8n"
                    busy={busy.restart}
                    onClick={restartN8n}
                    color="orange"
                  />
                  <button
                    onClick={() => window.open(`http://${LUCIFERSHELL_IP}:${N8N_PORT}`, '_blank', 'noopener,noreferrer')}
                    className="w-full rounded-2xl border border-orange-500 bg-orange-600/20 px-6 py-4 text-lg font-semibold text-orange-300 transition hover:bg-orange-600/30 hover:shadow-lg hover:shadow-orange-500/20"
                  >
                    🌐 Open n8n WebUI
                  </button>
                </>
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4 xl:grid-cols-7">
          <SmallStat title="Platform" value="n8n" dot="bg-orange-500" />
          <SmallStat title="Host" value="Lucifershell" dot="bg-orange-500" />
          <SmallStat title="Port" value={N8N_PORT} dot="bg-orange-400" />
          <SmallStat title="Status" value={status === 'running' ? 'Online' : 'Offline'} dot={status === 'running' ? 'bg-emerald-500' : 'bg-red-400'} />
          <SmallStat title="Container" value={containerState?.state || '-'} dot="bg-orange-400" />
          <SmallStat title="Workflows" value={workflows ?? '-'} dot="bg-orange-500" />
          <SmallStat title="Mode" value="Automation" dot="bg-orange-400" />
        </section>

        <section className="mt-8 rounded-[2rem] border border-orange-900/40 bg-black p-8">
          <h3 className="mb-4 text-2xl font-semibold">Wat is n8n?</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard emoji="🔗" title="400+ Integraties" body="Slack, GitHub, Google, databases, AI APIs en meer." />
            <FeatureCard emoji="🤖" title="AI Workflows" body="Koppel Ollama/OpenClaw modellen aan automatische pipelines." />
            <FeatureCard emoji="🔒" title="Self-hosted" body="Draait lokaal in het cluster. Geen cloud dependency." />
          </div>
        </section>
      </div>
    </div>
  )
}

function Card({ title, body }) {
  return (
    <div className="rounded-3xl border border-orange-900/40 bg-orange-950/10 p-5 shadow-lg shadow-orange-950/10">
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-lg leading-relaxed text-zinc-300">{body}</p>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-orange-900/15 bg-orange-950/5 px-4 py-2">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="font-mono text-sm text-zinc-200">{value}</span>
    </div>
  )
}

function ActionButton({ label, busy, onClick, color }) {
  const colors = {
    emerald: 'border-emerald-700 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/30',
    red: 'border-red-700 bg-red-950/20 text-red-300 hover:bg-red-950/30',
    orange: 'border-orange-700 bg-orange-950/20 text-orange-300 hover:bg-orange-950/30',
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`w-full rounded-2xl border px-6 py-4 text-lg font-semibold transition ${colors[color] || colors.orange} ${busy ? 'animate-pulse opacity-50' : ''}`}
    >
      {busy ? 'Bezig...' : label}
    </button>
  )
}

function SmallStat({ title, value, dot }) {
  return (
    <div className="rounded-3xl border border-orange-900/40 bg-black p-5">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-orange-500/60">{title}</div>
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full animate-pulse ${dot}`} />
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
    </div>
  )
}

function FeatureCard({ emoji, title, body }) {
  return (
    <div className="rounded-2xl border border-orange-900/30 bg-orange-950/10 p-5">
      <div className="mb-2 text-2xl">{emoji}</div>
      <h4 className="text-lg font-semibold">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
    </div>
  )
}
