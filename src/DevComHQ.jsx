import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import RFB from '@novnc/novnc/lib/rfb'
import 'xterm/css/xterm.css'

const KALI_IP = '100.65.228.59'

export default function DevComHQ({ onBack }) {
  const [sshState, setSshState] = useState('connecting') // connecting | connected | error
  const [systemInfo, setSystemInfo] = useState(null)
  const [topProcs, setTopProcs] = useState([])
  const [termReady, setTermReady] = useState(false)
  const [activeTab, setActiveTab] = useState('terminal') // terminal | gui

  const fetchSystemInfo = useCallback(async () => {
    try {
      const [infoRes, procsRes] = await Promise.all([
        fetch('/api/kali/system-info'),
        fetch('/api/kali/top-processes'),
      ])
      const info = await infoRes.json()
      const procs = await procsRes.json()
      if (info.ok) setSystemInfo(info)
      if (procs.ok) setTopProcs(procs.processes || [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchSystemInfo()
    const interval = setInterval(fetchSystemInfo, 8000)
    return () => clearInterval(interval)
  }, [fetchSystemInfo])

  const steps = [
    { label: 'SSH verbinding', state: sshState === 'connected' || termReady ? 'done' : sshState === 'error' ? 'error' : 'active' },
    { label: 'Terminal sessie', state: termReady ? 'done' : sshState === 'connected' ? 'active' : sshState === 'error' ? 'error' : 'waiting' },
    { label: 'Shell environment', state: termReady ? 'done' : 'waiting' },
    { label: 'Kali tools ready', state: termReady ? 'done' : 'waiting' },
  ]

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <section className="rounded-[2rem] border border-red-900/60 bg-gradient-to-b from-[#0a0000] to-black p-10 shadow-2xl">
            <p className="mb-6 text-xs uppercase tracking-[0.4em] text-red-500/70">
              DevCom HQ V1
            </p>

            <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
              DevCom<br />
              <span className="text-red-500">Headquarters</span>
            </h1>

            <p className="mt-8 max-w-4xl text-xl leading-relaxed text-zinc-400">
              Mission control voor Kali Linux. Security research, pentesting
              en development — live SSH terminal met real-time system monitoring.
            </p>

            <div className="mt-10 inline-flex min-w-[170px] flex-col rounded-2xl border border-red-800/50 bg-red-950/20 px-5 py-4">
              <span className="text-xs uppercase tracking-[0.3em] text-red-400/70">
                Mode
              </span>
              <span className="mt-2 text-3xl font-semibold text-red-400">
                DEV MODE
              </span>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <DevInfoCard
                title="Kali Linux"
                body="Dedicated security & development node met volledige toolset."
              />
              <DevInfoCard
                title="SSH Terminal"
                body="Directe shell via Tailscale overlay, full-size interactieve terminal."
              />
            </div>

            <button
              onClick={onBack}
              className="mt-6 w-full rounded-2xl border border-red-700 bg-red-950/20 px-8 py-6 text-2xl font-semibold text-white transition hover:scale-[1.01] hover:border-red-500 hover:bg-red-950/30 hover:shadow-lg hover:shadow-red-500/20"
            >
              ← Cluster HQ
            </button>
          </section>

          <section className="rounded-[2rem] border border-red-900/40 bg-black p-8 shadow-2xl">
            <div className="mb-8 flex items-start justify-between">
              <h2 className="text-5xl font-semibold">Kali Node</h2>
              <span className="pt-2 text-xs uppercase tracking-[0.35em] text-red-500/60">
                {KALI_IP}
              </span>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => {
                const stateIcon = step.state === 'done' ? '✅' : step.state === 'active' ? '⏳' : step.state === 'error' ? '❌' : '⬜'
                const borderClass = step.state === 'done'
                  ? 'border-emerald-800/40 bg-emerald-950/10'
                  : step.state === 'active'
                  ? 'border-yellow-700/40 bg-yellow-950/10 animate-pulse'
                  : step.state === 'error'
                  ? 'border-red-700/40 bg-red-950/20'
                  : 'border-red-900/20 bg-red-950/5'

                return (
                  <div
                    key={index}
                    className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left ${borderClass}`}
                  >
                    <div className="text-xl">{stateIcon}</div>
                    <div className="flex-1">
                      <span className="text-lg text-zinc-100">{step.label}</span>
                    </div>
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {step.state === 'done' ? 'klaar' : step.state === 'active' ? 'bezig...' : step.state === 'error' ? 'fout' : 'wacht'}
                    </span>
                  </div>
                )
              })}
            </div>

            {systemInfo && (
              <div className="mt-6 space-y-2">
                <div className="text-xs uppercase tracking-[0.3em] text-red-500/60 mb-2">System Resources</div>
                <SysRow label="CPU Cores" value={systemInfo.cpu_cores} />
                <SysRow label="Memory" value={systemInfo.memory} />
                <SysRow label="Disk" value={systemInfo.disk} />
                <SysRow label="Uptime" value={systemInfo.uptime} />
                <SysRow label="Load avg" value={systemInfo.load} />
                <SysRow label="Processes" value={systemInfo.processes} />
              </div>
            )}

            {topProcs.length > 0 && (
              <div className="mt-6">
                <div className="text-xs uppercase tracking-[0.3em] text-red-500/60 mb-2">Top Processes</div>
                <div className="max-h-40 overflow-auto rounded-xl border border-red-900/20 bg-black p-3 font-mono text-xs">
                  {topProcs.map((proc, i) => (
                    <div key={i} className="flex gap-3 py-1 text-zinc-400">
                      <span className="w-12 text-right text-red-400">{proc.cpu}%</span>
                      <span className="w-12 text-right text-yellow-400">{proc.mem}%</span>
                      <span className="flex-1 truncate text-zinc-300">{proc.command}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4 xl:grid-cols-7">
          <DevStatCard title="Node" value="Kali-Linux" dotColor="bg-red-500" />
          <DevStatCard title="IP" value={KALI_IP} dotColor="bg-red-500" />
          <DevStatCard title="CPU" value={systemInfo?.cpu_cores ? `${systemInfo.cpu_cores} cores` : '-'} dotColor="bg-red-500" />
          <DevStatCard title="Memory" value={systemInfo?.memory || '-'} dotColor="bg-red-500" />
          <DevStatCard title="Load" value={systemInfo?.load || '-'} dotColor="bg-yellow-500" />
          <DevStatCard title="Procs" value={systemInfo?.processes || '-'} dotColor="bg-red-400" />
          <DevStatCard title="Mode" value="Dev Mode" dotColor="bg-red-400" />
        </section>

        <section className="mt-8 rounded-[2rem] border border-red-900/40 bg-black p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold">Kali Linux</h3>
              <p className="mt-1 text-sm text-zinc-400">
                {activeTab === 'terminal'
                  ? 'Volledige interactieve SSH sessie naar Kali-Linux via Tailscale.'
                  : 'Live XFCE desktop via VNC — Kali remote GUI.'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex rounded-xl border border-red-900/40 bg-red-950/20 p-1">
                <button
                  onClick={() => setActiveTab('terminal')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    activeTab === 'terminal'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Terminal
                </button>
                <button
                  onClick={() => setActiveTab('gui')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    activeTab === 'gui'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🖥️ GUI Desktop
                </button>
              </div>
              <div className={`h-3 w-3 rounded-full ${sshState === 'connected' ? 'bg-emerald-500 animate-pulse' : sshState === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
              <span className="text-xs uppercase tracking-[0.3em] text-red-500/60">
                {sshState === 'connected' ? 'SSH Active' : sshState === 'error' ? 'SSH Error' : 'Connecting...'}
              </span>
            </div>
          </div>

          {activeTab === 'terminal' ? (
            <KaliTerminal
              onConnected={() => { setSshState('connected'); setTimeout(() => setTermReady(true), 500) }}
              onError={() => setSshState('error')}
              onDisconnected={() => { setSshState('connecting'); setTermReady(false) }}
            />
          ) : (
            <KaliDesktop />
          )}
        </section>
      </div>
    </div>
  )
}

function KaliTerminal({ onConnected, onError, onDisconnected }) {
  const hostRef = useRef(null)

  useEffect(() => {
    if (!hostRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 18,
      fontFamily: 'Consolas, Menlo, Monaco, monospace',
      theme: {
        background: '#000000',
        foreground: '#ff4444',
        cursor: '#ff4444',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 68, 68, 0.3)',
      },
      scrollback: 5000,
      convertEol: true,
      disableStdin: false,
      scrollOnUserInput: false,
      scrollOnOutput: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(hostRef.current)
    term.focus()
    fitAddon.fit()

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/terminal?type=kali`)

    ws.onopen = () => {
      term.writeln('\x1b[31m[connected]\x1b[0m Kali Linux SSH')
      onConnected?.()
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }

    ws.onmessage = (event) => {
      try {
        const data = event.data
        if (typeof data === 'string' && data.startsWith('{')) {
          const parsed = JSON.parse(data)
          if (parsed.type === 'output') term.write(parsed.data)
          else term.write(data)
        } else {
          term.write(data)
        }
      } catch {
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      term.writeln('\r\n\x1b[31m[disconnected]\x1b[0m')
      onDisconnected?.()
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m[error]\x1b[0m websocket fout')
      onError?.()
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    const handleResize = () => {
      try {
        fitAddon.fit()
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
        }
      } catch {}
    }

    window.addEventListener('resize', handleResize)
    setTimeout(handleResize, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      try { ws.close() } catch {}
      try { term.dispose() } catch {}
    }
  }, [])

  return (
    <div className="rounded-2xl border border-red-900/30 bg-zinc-950 p-4">
      <div
        ref={hostRef}
        className="h-[600px] rounded-xl border border-red-900/20 bg-black p-2"
      />
    </div>
  )
}

function KaliDesktop() {
  const containerRef = useRef(null)
  const rfbRef = useRef(null)
  const [vncState, setVncState] = useState('connecting') // connecting | connected | error

  useEffect(() => {
    if (!containerRef.current) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${window.location.host}/ws/vnc`

    try {
      const rfb = new RFB(containerRef.current, url, {
        scaleViewport: true,
        resizeSession: false,
        qualityLevel: 6,
        compressionLevel: 2,
      })

      rfb.background = '#000000'
      rfb.focusOnClick = true

      rfb.addEventListener('connect', () => {
        console.log('[VNC] Connected')
        setVncState('connected')
      })

      rfb.addEventListener('disconnect', (e) => {
        console.log('[VNC] Disconnected', e.detail)
        setVncState(e.detail.clean ? 'connecting' : 'error')
      })

      rfb.addEventListener('securityfailure', (e) => {
        console.error('[VNC] Security failure:', e.detail)
        setVncState('error')
      })

      rfbRef.current = rfb

      return () => {
        try { rfb.disconnect() } catch {}
        rfbRef.current = null
      }
    } catch (err) {
      console.error('[VNC] Init error:', err)
      setVncState('error')
    }
  }, [])

  return (
    <div className="rounded-2xl border border-red-900/30 bg-zinc-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${
            vncState === 'connected' ? 'bg-emerald-500 animate-pulse'
              : vncState === 'error' ? 'bg-red-500'
              : 'bg-yellow-500 animate-pulse'
          }`} />
          <span className="text-sm text-zinc-400">
            {vncState === 'connected' ? 'VNC Connected — XFCE Desktop'
              : vncState === 'error' ? 'VNC Connection Failed'
              : 'Connecting to VNC...'}
          </span>
        </div>
        {vncState === 'connected' && (
          <button
            onClick={() => {
              if (rfbRef.current) {
                try { rfbRef.current.disconnect() } catch {}
                rfbRef.current = null
              }
              setVncState('connecting')
              // Re-mount by forcing key change
              containerRef.current?.replaceChildren()
              const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
              const url = `${protocol}://${window.location.host}/ws/vnc`
              try {
                const rfb = new RFB(containerRef.current, url, {
                  scaleViewport: true,
                  resizeSession: false,
                  qualityLevel: 6,
                  compressionLevel: 2,
                })
                rfb.background = '#000000'
                rfb.focusOnClick = true
                rfb.addEventListener('connect', () => setVncState('connected'))
                rfb.addEventListener('disconnect', (e) => setVncState(e.detail.clean ? 'connecting' : 'error'))
                rfbRef.current = rfb
              } catch {}
            }}
            className="rounded-lg border border-red-700/50 bg-red-950/20 px-3 py-1 text-xs text-red-400 transition hover:bg-red-950/40"
          >
            Reconnect
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="h-[600px] rounded-xl border border-red-900/20 bg-black overflow-hidden"
      />
    </div>
  )
}

function SysRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-red-900/15 bg-red-950/5 px-4 py-2">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="font-mono text-sm text-zinc-200">{value}</span>
    </div>
  )
}

function DevInfoCard({ title, body }) {
  return (
    <div className="rounded-3xl border border-red-900/40 bg-red-950/10 p-5 shadow-lg shadow-red-950/10">
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-lg leading-relaxed text-zinc-300">{body}</p>
    </div>
  )
}

function DevStatCard({ title, value, dotColor }) {
  return (
    <div className="rounded-3xl border border-red-900/40 bg-black p-5">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-red-500/60">{title}</div>
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full animate-pulse ${dotColor}`} />
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
    </div>
  )
}
