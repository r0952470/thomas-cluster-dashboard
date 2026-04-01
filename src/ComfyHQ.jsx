import { useEffect, useState, useCallback } from 'react'

const COMFYUI_PORT = 8188

export default function ComfyHQ({ onBack }) {
  const [status, setStatus] = useState('checking')
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState({})

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/comfyui/status')
      const data = await res.json()
      if (data.ok && data.status === 'running') {
        setStatus('running')
        setStats(data.stats || null)
      } else {
        setStatus('offline')
        setStats(null)
      }
    } catch {
      setStatus('offline')
      setStats(null)
    }
  }, [])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 8000)
    return () => clearInterval(interval)
  }, [checkStatus])

  const startComfy = async () => {
    setBusy((p) => ({ ...p, start: true }))
    try {
      await fetch('/api/comfyui/start', { method: 'POST' })
      // ComfyUI needs time to load models
      await new Promise((r) => setTimeout(r, 8000))
      await checkStatus()
    } catch {}
    setBusy((p) => ({ ...p, start: false }))
  }

  const vram = stats?.devices?.[0]
  const vramUsed = vram ? (vram.vram_total - vram.vram_free) : null
  const vramTotal = vram?.vram_total ?? null
  const gpuName = vram?.name ?? 'Unknown GPU'

  const formatBytes = (b) => {
    if (!b) return '-'
    const gb = b / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
  }

  const statusDot = status === 'running' ? 'bg-purple-500 animate-pulse' : 'bg-zinc-600'
  const statusText = status === 'running' ? 'Online' : status === 'checking' ? 'Checking...' : 'Offline'

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <section className="rounded-[2rem] border border-purple-900/60 bg-gradient-to-b from-[#0a0015] to-black p-10 shadow-2xl">
            <p className="mb-6 text-xs uppercase tracking-[0.4em] text-purple-500/70">
              Content Creation HQ
            </p>

            <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
              ComfyUI<br />
              <span className="text-purple-500">Studio</span>
            </h1>

            <p className="mt-8 max-w-4xl text-xl leading-relaxed text-zinc-400">
              AI image generation met Stable Diffusion. Node-based workflow
              editor voor content creation, direct op Victus GPU.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <Card title="GPU Accelerated" body="Draait op Victus RTX GPU. Snelle inference met lokale modellen." />
              <Card title="Node Editor" body="Visueel workflows bouwen. Combineer modellen, LoRAs, en controlnets." />
            </div>

            <button
              onClick={onBack}
              className="mt-6 w-full rounded-2xl border border-purple-700 bg-purple-950/20 px-8 py-6 text-2xl font-semibold text-white transition hover:scale-[1.01] hover:border-purple-500 hover:bg-purple-950/30 hover:shadow-lg hover:shadow-purple-500/20"
            >
              ← Cluster HQ
            </button>
          </section>

          <section className="rounded-[2rem] border border-purple-900/40 bg-black p-8 shadow-2xl">
            <div className="mb-8 flex items-start justify-between">
              <h2 className="text-5xl font-semibold">ComfyUI</h2>
              <div className="flex items-center gap-3 pt-2">
                <div className={`h-3 w-3 rounded-full ${statusDot}`} />
                <span className="text-xs uppercase tracking-[0.35em] text-purple-500/60">
                  {statusText}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <InfoRow label="Host" value="Victus (lokaal)" />
              <InfoRow label="Port" value={COMFYUI_PORT} />
              <InfoRow label="GPU" value={gpuName} />
              {vramTotal && <InfoRow label="VRAM" value={`${formatBytes(vramUsed)} / ${formatBytes(vramTotal)}`} />}
              {vramTotal && (
                <div className="px-4">
                  <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-500"
                      style={{ width: `${((vramUsed || 0) / vramTotal) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <InfoRow label="Status" value={statusText} />
            </div>

            <div className="mt-6 space-y-3">
              {status === 'offline' && (
                <ActionButton
                  label="🚀 Start ComfyUI"
                  busy={busy.start}
                  onClick={startComfy}
                  color="purple"
                />
              )}

              {status === 'running' && (
                <button
                  onClick={() => window.open(`http://localhost:${COMFYUI_PORT}`, '_blank', 'noopener,noreferrer')}
                  className="w-full rounded-2xl border border-purple-500 bg-purple-600/20 px-6 py-4 text-lg font-semibold text-purple-300 transition hover:bg-purple-600/30 hover:shadow-lg hover:shadow-purple-500/20"
                >
                  🎨 Open ComfyUI Studio
                </button>
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4 xl:grid-cols-7">
          <SmallStat title="Platform" value="ComfyUI" dot="bg-purple-500" />
          <SmallStat title="Host" value="Victus" dot="bg-purple-500" />
          <SmallStat title="Port" value={COMFYUI_PORT} dot="bg-purple-400" />
          <SmallStat title="GPU" value={vram ? gpuName.split(' ').pop() : '-'} dot="bg-pink-500" />
          <SmallStat title="VRAM" value={vramTotal ? formatBytes(vramTotal) : '-'} dot="bg-purple-400" />
          <SmallStat title="Status" value={statusText} dot={status === 'running' ? 'bg-emerald-500' : 'bg-red-400'} />
          <SmallStat title="Mode" value="Creative" dot="bg-purple-400" />
        </section>

        <section className="mt-8 rounded-[2rem] border border-purple-900/40 bg-black p-8">
          <h3 className="mb-4 text-2xl font-semibold">Capabilities</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <FeatureCard emoji="🎨" title="Text-to-Image" body="Genereer afbeeldingen van text prompts met SD, SDXL of Flux." />
            <FeatureCard emoji="🖼️" title="Image-to-Image" body="Transform bestaande images. Style transfer, inpainting, outpainting." />
            <FeatureCard emoji="🎬" title="Video Gen" body="AnimateDiff en SVD voor AI-gegenereerde video content." />
            <FeatureCard emoji="🔧" title="Custom Nodes" body="Uitbreidbaar met community nodes. ControlNet, IP-Adapter, etc." />
          </div>
        </section>
      </div>
    </div>
  )
}

function Card({ title, body }) {
  return (
    <div className="rounded-3xl border border-purple-900/40 bg-purple-950/10 p-5 shadow-lg shadow-purple-950/10">
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-lg leading-relaxed text-zinc-300">{body}</p>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-purple-900/15 bg-purple-950/5 px-4 py-2">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="font-mono text-sm text-zinc-200">{value}</span>
    </div>
  )
}

function ActionButton({ label, busy, onClick, color }) {
  const colors = {
    purple: 'border-purple-700 bg-purple-950/20 text-purple-300 hover:bg-purple-950/30',
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`w-full rounded-2xl border px-6 py-4 text-lg font-semibold transition ${colors[color] || colors.purple} ${busy ? 'animate-pulse opacity-50' : ''}`}
    >
      {busy ? 'Bezig...' : label}
    </button>
  )
}

function SmallStat({ title, value, dot }) {
  return (
    <div className="rounded-3xl border border-purple-900/40 bg-black p-5">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-purple-500/60">{title}</div>
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full animate-pulse ${dot}`} />
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
    </div>
  )
}

function FeatureCard({ emoji, title, body }) {
  return (
    <div className="rounded-2xl border border-purple-900/30 bg-purple-950/10 p-5">
      <div className="mb-2 text-2xl">{emoji}</div>
      <h4 className="text-lg font-semibold">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
    </div>
  )
}
