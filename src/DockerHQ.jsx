import { useEffect, useState, useCallback } from 'react'

export default function DockerHQ({ onBack }) {
  const [containers, setContainers] = useState([])
  const [images, setImages] = useState([])
  const [stats, setStats] = useState([])
  const [logs, setLogs] = useState({ name: null, text: '' })
  const [busy, setBusy] = useState({})
  const [activeTab, setActiveTab] = useState('containers')

  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch('/api/docker/containers')
      const data = await res.json()
      if (data.ok) setContainers(data.containers || [])
    } catch {}
  }, [])

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch('/api/docker/images')
      const data = await res.json()
      if (data.ok) setImages(data.images || [])
    } catch {}
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/docker/stats')
      const data = await res.json()
      if (data.ok) setStats(data.stats || [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchContainers()
    fetchImages()
    fetchStats()
    const interval = setInterval(() => {
      fetchContainers()
      fetchStats()
    }, 8000)
    return () => clearInterval(interval)
  }, [fetchContainers, fetchImages, fetchStats])

  const containerAction = async (name, action) => {
    const key = `${action}-${name}`
    setBusy((p) => ({ ...p, [key]: true }))
    try {
      await fetch(`/api/docker/containers/${encodeURIComponent(name)}/${action}`, { method: 'POST' })
      await new Promise((r) => setTimeout(r, 1500))
      await fetchContainers()
      await fetchStats()
    } catch {}
    setBusy((p) => ({ ...p, [key]: false }))
  }

  const viewLogs = async (name) => {
    try {
      const res = await fetch(`/api/docker/containers/${encodeURIComponent(name)}/logs`)
      const data = await res.json()
      setLogs({ name, text: data.logs || '(no logs)' })
    } catch (e) {
      setLogs({ name, text: `Error: ${e.message}` })
    }
  }

  const running = containers.filter((c) => c.state === 'running').length
  const stopped = containers.filter((c) => c.state !== 'running').length

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <section className="rounded-[2rem] border border-blue-900/60 bg-gradient-to-b from-[#000a1a] to-black p-10 shadow-2xl">
            <p className="mb-6 text-xs uppercase tracking-[0.4em] text-blue-500/70">
              Docker Control Center
            </p>

            <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
              Docker<br />
              <span className="text-blue-500">Command</span>
            </h1>

            <p className="mt-8 max-w-4xl text-xl leading-relaxed text-zinc-400">
              Container management voor Lucifershell. Start, stop en monitor
              al je Docker containers vanuit één plek.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <DockerStatCard title="Running" value={running} color="bg-emerald-500" />
              <DockerStatCard title="Stopped" value={stopped} color="bg-red-500" />
              <DockerStatCard title="Images" value={images.length} color="bg-blue-500" />
            </div>

            <button
              onClick={onBack}
              className="mt-6 w-full rounded-2xl border border-blue-700 bg-blue-950/20 px-8 py-6 text-2xl font-semibold text-white transition hover:scale-[1.01] hover:border-blue-500 hover:bg-blue-950/30 hover:shadow-lg hover:shadow-blue-500/20"
            >
              ← Cluster HQ
            </button>
          </section>

          <section className="rounded-[2rem] border border-blue-900/40 bg-black p-8 shadow-2xl">
            <h2 className="mb-6 text-5xl font-semibold">Host</h2>
            <div className="space-y-3">
              <InfoRow label="Server" value="Lucifershell" />
              <InfoRow label="IP" value="192.168.0.222" />
              <InfoRow label="Runtime" value="Docker Engine" />
              <InfoRow label="Containers" value={`${containers.length} totaal`} />
              <InfoRow label="Running" value={`${running} actief`} />
            </div>

            {stats.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 text-xs uppercase tracking-[0.3em] text-blue-500/60">Live Resource Usage</div>
                <div className="space-y-2">
                  {stats.map((s) => (
                    <div key={s.name} className="flex items-center justify-between rounded-lg border border-blue-900/20 bg-blue-950/5 px-4 py-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <div className="flex gap-4 text-xs text-zinc-400">
                        <span>CPU: <span className="text-blue-400">{s.cpu}</span></span>
                        <span>MEM: <span className="text-cyan-400">{s.mem}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4 xl:grid-cols-7">
          <StatCard title="Host" value="Lucifershell" dot="bg-blue-500" />
          <StatCard title="Engine" value="Docker" dot="bg-blue-500" />
          <StatCard title="Running" value={running} dot="bg-emerald-500" />
          <StatCard title="Stopped" value={stopped} dot="bg-red-400" />
          <StatCard title="Images" value={images.length} dot="bg-blue-400" />
          <StatCard title="Containers" value={containers.length} dot="bg-blue-500" />
          <StatCard title="Mode" value="Infra" dot="bg-blue-400" />
        </section>

        <section className="mt-8 rounded-[2rem] border border-blue-900/40 bg-black p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold">
                {activeTab === 'containers' ? 'Containers' : activeTab === 'images' ? 'Images' : 'Logs'}
              </h3>
            </div>
            <div className="flex rounded-xl border border-blue-900/40 bg-blue-950/20 p-1">
              {['containers', 'images', 'logs'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab === 'containers' ? '📦 Containers' : tab === 'images' ? '💿 Images' : '📋 Logs'}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'containers' && (
            <div className="space-y-3">
              {containers.length === 0 ? (
                <div className="py-8 text-center text-zinc-500">Geen containers gevonden...</div>
              ) : (
                containers.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-2xl border px-5 py-4 ${
                      c.state === 'running'
                        ? 'border-emerald-800/40 bg-emerald-950/10'
                        : 'border-zinc-800 bg-zinc-950/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`h-3 w-3 rounded-full ${c.state === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                        <div>
                          <div className="text-lg font-semibold">{c.name}</div>
                          <div className="text-sm text-zinc-500">{c.image}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                          c.state === 'running' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {c.state}
                        </span>
                        <div className="flex gap-2">
                          {c.state !== 'running' ? (
                            <ActionBtn
                              label="Start"
                              color="emerald"
                              busy={busy[`start-${c.name}`]}
                              onClick={() => containerAction(c.name, 'start')}
                            />
                          ) : (
                            <ActionBtn
                              label="Stop"
                              color="red"
                              busy={busy[`stop-${c.name}`]}
                              onClick={() => containerAction(c.name, 'stop')}
                            />
                          )}
                          <ActionBtn
                            label="Restart"
                            color="blue"
                            busy={busy[`restart-${c.name}`]}
                            onClick={() => containerAction(c.name, 'restart')}
                          />
                          <ActionBtn
                            label="Logs"
                            color="zinc"
                            onClick={() => { viewLogs(c.name); setActiveTab('logs') }}
                          />
                        </div>
                      </div>
                    </div>
                    {c.ports && (
                      <div className="mt-2 text-xs text-zinc-500">Ports: {c.ports || 'none'}</div>
                    )}
                    <div className="mt-1 text-xs text-zinc-600">{c.status}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-2">
              {images.length === 0 ? (
                <div className="py-8 text-center text-zinc-500">Geen images gevonden...</div>
              ) : (
                images.map((img, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-blue-900/20 bg-blue-950/5 px-5 py-3">
                    <div>
                      <div className="font-medium">{img.repository}</div>
                      <div className="text-xs text-zinc-500">{img.tag} · {img.id}</div>
                    </div>
                    <span className="text-sm text-zinc-400">{img.size}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="rounded-xl border border-blue-900/20 bg-black p-4">
              {logs.name ? (
                <>
                  <div className="mb-3 text-sm text-blue-400">Logs: {logs.name}</div>
                  <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap font-mono text-xs text-zinc-300">
                    {logs.text}
                  </pre>
                </>
              ) : (
                <div className="py-8 text-center text-zinc-500">Klik op "Logs" bij een container om logs te bekijken</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function DockerStatCard({ title, value, color }) {
  return (
    <div className="rounded-2xl border border-blue-900/40 bg-blue-950/10 p-5">
      <span className="text-xs uppercase tracking-[0.3em] text-blue-400/70">{title}</span>
      <div className="mt-2 flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full animate-pulse ${color}`} />
        <span className="text-3xl font-semibold">{value}</span>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-blue-900/15 bg-blue-950/5 px-4 py-2">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="font-mono text-sm text-zinc-200">{value}</span>
    </div>
  )
}

function StatCard({ title, value, dot }) {
  return (
    <div className="rounded-3xl border border-blue-900/40 bg-black p-5">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-blue-500/60">{title}</div>
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full animate-pulse ${dot}`} />
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
    </div>
  )
}

function ActionBtn({ label, color, busy, onClick }) {
  const colors = {
    emerald: 'border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/40',
    red: 'border-red-700/50 text-red-400 hover:bg-red-950/40',
    blue: 'border-blue-700/50 text-blue-400 hover:bg-blue-950/40',
    zinc: 'border-zinc-700/50 text-zinc-400 hover:bg-zinc-800/40',
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`rounded-lg border bg-transparent px-3 py-1.5 text-xs font-semibold transition ${colors[color] || colors.zinc} ${busy ? 'animate-pulse opacity-50' : ''}`}
    >
      {busy ? '...' : label}
    </button>
  )
}
