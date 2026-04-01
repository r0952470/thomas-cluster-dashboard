require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express = require('express')
const cors = require('cors')
const axios = require('axios')
const { exec } = require('child_process')
const http = require('http')
const net = require('net')
const { WebSocketServer } = require('ws')
const pty = require('node-pty')
const { Client } = require('ssh2')

const app = express()
const PORT = Number(process.env.PORT || 3001)

app.use(cors())
app.use(express.json())

const NODES = [
  {
    name: 'Victus',
    ip: '100.101.9.116',
    role: 'AI Brain',
    canRestart: false,
    guiUrl: null,
  },
  {
    name: 'Proxmox',
    ip: '100.67.65.85',
    role: 'Hypervisor',
    canRestart: false,
    guiUrl: 'https://100.67.65.85:8006/',
  },
  {
    name: 'Lucifershell',
    ip: process.env.LINUX_SSH_HOST || '192.168.0.222',
    role: 'Gateway / OpenClaw Host',
    canRestart: false,
    guiUrl: null,
    services: [
      {
        name: 'OpenClaw',
        type: 'ai-agent',
        port: 18789,
        guiUrl: 'https://lucifershell.tail5e2072.ts.net/',
      },
      { name: 'ollama', type: 'model-server', port: 11434 },
      { name: 'docker', type: 'container-runtime' },
      { name: 'nginx', type: 'reverse-proxy' },
    ],
  },
  {
    name: 'Kali-Linux',
    ip: '100.65.228.59',
    role: 'Security / Pentest',
    canRestart: false,
    guiUrl: null,
  },
  {
    name: 'iPhone-15-Pro',
    ip: '100.84.216.86',
    role: 'Mobile',
    canRestart: false,
    guiUrl: null,
  },
  {
    name: 'Pad-i14-Pro',
    ip: '100.127.210.66',
    role: 'Tablet',
    canRestart: false,
    guiUrl: null,
  },
]

let currentOllamaModel = ''

function findNode(name) {
  return NODES.find((node) => node.name.toLowerCase() === name.toLowerCase())
}

function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

function ping(ip) {
  const flag = process.platform === 'win32' ? '-n' : '-c'
  return new Promise((resolve) => {
    exec(`ping ${flag} 1 ${ip}`, (error) => {
      resolve(!error)
    })
  })
}

async function getOllamaInfo() {
  try {
    const response = await axios.get('http://127.0.0.1:11434/api/tags', {
      timeout: 3000,
    })

    const models = response.data.models || []
    const modelNames = models.map((m) => m.name)

    if (!currentOllamaModel && modelNames.length > 0) {
      // Skip embedding models bij auto-selectie
      const EMBED_PATTERNS = /embed|nomic-embed|bge-|e5-/i
      const chatModel = modelNames.find((n) => !EMBED_PATTERNS.test(n))
      currentOllamaModel = chatModel || modelNames[0]
    }

    return {
      ok: true,
      status: 'Running',
      modelsCount: models.length,
      models,
      modelNames,
    }
  } catch (error) {
    return {
      ok: false,
      status: 'Down',
      modelsCount: 0,
      models: [],
      modelNames: [],
      error: error.message,
    }
  }
}

async function restartOllamaLocal() {
  const killCmd = 'taskkill /IM ollama.exe /F'
  const startCmd = 'start "" ollama serve'

  try {
    await execCommand(killCmd, { shell: 'cmd.exe' })
  } catch {
    // mag falen als het proces nog niet draait
  }

  await new Promise((resolve) => setTimeout(resolve, 1500))
  await execCommand(startCmd, { shell: 'cmd.exe' })
  return true
}

// Helper function voor SSH commands naar OpenClaw
async function executeSSHCommand(command) {
  return new Promise((resolve, reject) => {
    const sshHost = process.env.LINUX_SSH_HOST
    const sshPort = Number(process.env.LINUX_SSH_PORT || '22')
    const sshUser = process.env.LINUX_SSH_USER
    const sshPassword = process.env.LINUX_SSH_PASSWORD

    if (!sshHost || !sshUser || !sshPassword) {
      reject(new Error('SSH config ontbreekt'))
      return
    }

    const conn = new Client()
    let output = ''
    let errorOutput = ''

    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end()
            reject(err)
            return
          }

          stream.on('data', (data) => {
            output += data.toString()
          })

          stream.stderr?.on('data', (data) => {
            errorOutput += data.toString()
          })

          stream.on('close', () => {
            conn.end()
            resolve({
              stdout: output,
              stderr: errorOutput,
              success: true,
            })
          })
        })
      })
      .on('error', (err) => {
        reject(err)
      })
      .connect({
        host: sshHost,
        port: sshPort,
        username: sshUser,
        password: sshPassword,
        readyTimeout: 10000,
      })
  })
}

// Helper function voor SSH commands naar Kali
async function executeKaliSSHCommand(command) {
  return new Promise((resolve, reject) => {
    const host = process.env.KALI_SSH_HOST
    const port = Number(process.env.KALI_SSH_PORT || '22')
    const user = process.env.KALI_SSH_USER
    const password = process.env.KALI_SSH_PASSWORD

    if (!host || !user || !password) {
      reject(new Error('Kali SSH config ontbreekt'))
      return
    }

    const conn = new Client()
    let output = ''
    let errorOutput = ''

    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) { conn.end(); reject(err); return }
          stream.on('data', (data) => { output += data.toString() })
          stream.stderr?.on('data', (data) => { errorOutput += data.toString() })
          stream.on('close', () => { conn.end(); resolve({ stdout: output, stderr: errorOutput, success: true }) })
        })
      })
      .on('error', (err) => reject(err))
      .connect({ host, port, username: user, password, readyTimeout: 10000 })
  })
}

// ----------------------
// REST API
// ----------------------

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Backend leeft',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/nodes', async (req, res) => {
  try {
    const results = []

    for (const node of NODES) {
      const online = await ping(node.ip)
      results.push({
        ...node,
        status: online ? 'online' : 'offline',
      })
    }

    res.json(results)
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.post('/api/nodes/:name/ping', async (req, res) => {
  try {
    const node = findNode(req.params.name)

    if (!node) {
      return res.status(404).json({
        ok: false,
        error: 'Node niet gevonden',
      })
    }

    const online = await ping(node.ip)

    res.json({
      ok: true,
      name: node.name,
      ip: node.ip,
      status: online ? 'online' : 'offline',
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.post('/api/nodes/:name/restart', async (req, res) => {
  try {
    const node = findNode(req.params.name)

    if (!node) {
      return res.status(404).json({
        ok: false,
        error: 'Node niet gevonden',
      })
    }

    return res.json({
      ok: true,
      simulated: true,
      message: `Restart voor ${node.name} is voorlopig simulatie. Eerst SSH/WOL veilig inbouwen.`,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.get('/api/ollama/status', async (req, res) => {
  const info = await getOllamaInfo()
  res.status(info.ok ? 200 : 503).json({
    ok: info.ok,
    status: info.status,
    modelsCount: info.modelsCount,
    currentModel: currentOllamaModel || '',
    error: info.error,
  })
})

app.get('/api/ollama/models', async (req, res) => {
  try {
    const info = await getOllamaInfo()

    if (!info.ok) {
      return res.status(503).json({
        ok: false,
        error: info.error || 'Ollama onbereikbaar',
        models: [],
      })
    }

    res.json({
      ok: true,
      models: info.modelNames,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
      models: [],
    })
  }
})

app.get('/api/ollama/current', async (req, res) => {
  try {
    const info = await getOllamaInfo()

    if (!info.ok) {
      return res.status(503).json({
        ok: false,
        error: info.error || 'Ollama onbereikbaar',
        currentModel: currentOllamaModel || '',
      })
    }

    if (!currentOllamaModel && info.modelNames.length > 0) {
      currentOllamaModel = info.modelNames[0]
    }

    res.json({
      ok: true,
      currentModel: currentOllamaModel || '',
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
      currentModel: currentOllamaModel || '',
    })
  }
})

app.post('/api/ollama/current', async (req, res) => {
  try {
    const { model } = req.body || {}

    if (!model || typeof model !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Geen geldig model opgegeven',
      })
    }

    const info = await getOllamaInfo()

    if (!info.ok) {
      return res.status(503).json({
        ok: false,
        error: info.error || 'Ollama onbereikbaar',
      })
    }

    const exists = info.modelNames.includes(model)

    if (!exists) {
      return res.status(404).json({
        ok: false,
        error: 'Model niet gevonden in lokale Ollama lijst',
      })
    }

    currentOllamaModel = model

    res.json({
      ok: true,
      currentModel: currentOllamaModel,
      message: `Default model ingesteld op ${currentOllamaModel}`,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.post('/api/ollama/switch-model', async (req, res) => {
  try {
    const { model } = req.body || {}

    if (!model || typeof model !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Geen geldig model opgegeven',
      })
    }

    console.log(`[OLLAMA] Model switch request: ${currentOllamaModel} -> ${model}`)

    const info = await getOllamaInfo()

    if (!info.ok) {
      return res.status(503).json({
        ok: false,
        error: info.error || 'Ollama onbereikbaar',
      })
    }

    if (!info.modelNames.includes(model)) {
      return res.status(404).json({
        ok: false,
        error: 'Model niet gevonden in Ollama',
      })
    }

    // Voor cloud -> lokaal switch: extra cleanup
    if (currentOllamaModel && currentOllamaModel.includes('gpt') && !model.includes('gpt')) {
      console.log(`[OLLAMA] Cloud -> Lokaal switch, cleanup...`)
      try {
        // Probeer old model af te sluiten
        await axios.post('http://127.0.0.1:11434/api/delete', {
          model: currentOllamaModel,
        })
      } catch {
        // Negeer errors hier
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    currentOllamaModel = model
    console.log(`[OLLAMA] Model switch succesvol naar ${model}`)

    res.json({
      ok: true,
      currentModel: currentOllamaModel,
      message: `Model switched naar ${model}`,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.post('/api/ollama/restart', async (req, res) => {
  try {
    await restartOllamaLocal()
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const info = await getOllamaInfo()

    // Reset model cache
    if (!info.ok) {
      currentOllamaModel = ''
    } else if (info.modelNames.length > 0) {
      currentOllamaModel = info.modelNames[0]
    }

    res.json({
      ok: true,
      message: 'Lokale Ollama restart uitgevoerd',
      currentModel: currentOllamaModel,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: `Kon Ollama niet herstarten: ${error.message}`,
    })
  }
})

// ----------------------
// OpenClaw / Linux Gateway endpoints
// ----------------------

app.get('/api/openclaw/dashboard-url', async (req, res) => {
  try {
    // Haal het token op uit de OpenClaw config
    const result = await executeSSHCommand('cat ~/.openclaw/openclaw.json')
    const config = JSON.parse(result.stdout.trim())
    const token = config?.gateway?.auth?.token || ''
    const base = 'https://lucifershell.tail5e2072.ts.net'
    const url = token ? `${base}/?token=${token}` : base
    res.json({ ok: true, url })
  } catch (error) {
    // Fallback zonder token
    res.json({ ok: true, url: 'https://lucifershell.tail5e2072.ts.net/' })
  }
})

app.get('/api/openclaw/status', async (req, res) => {
  try {
    const host = process.env.OPENCLAW_HOST || process.env.LINUX_SSH_HOST || '127.0.0.1'

    // Eerst proberen via HTTP gateway
    try {
      await axios.get(`http://${host}:18789`, { timeout: 3000 })
      return res.json({
        ok: true,
        status: 'online',
        node: 'Lucifershell',
        service: 'OpenClaw Gateway',
        source: 'http',
      })
    } catch {}

    // Fallback via SSH
    const result = await executeSSHCommand(
      'openclaw gateway status || openclaw status || systemctl --user status openclaw-gateway --no-pager'
    )
    res.json({
      ok: true,
      status: 'online',
      node: 'Lucifershell',
      service: 'OpenClaw Gateway',
      output: result.stdout.trim(),
      source: 'ssh',
    })
  } catch (error) {
    res.status(503).json({
      ok: false,
      status: 'offline',
      error: error.message,
    })
  }
})

app.get('/api/openclaw/system-info', async (req, res) => {
  try {
    const [cpuResult, memResult, diskResult] = await Promise.all([
      executeSSHCommand('nproc'),
      executeSSHCommand('free -h | grep Mem'),
      executeSSHCommand('df -h / | tail -1'),
    ])

    const memLine = memResult.stdout.split('\n')[0] || ''
    const diskLine = diskResult.stdout.trim()

    res.json({
      ok: true,
      cpu_cores: cpuResult.stdout.trim(),
      memory: memLine.split(/\s+/).slice(1, 4).join(' '),
      disk: diskLine,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.get('/api/openclaw/ollama', async (req, res) => {
  try {
    const openclawIP = process.env.LINUX_SSH_HOST || '192.168.0.222'
    let models = []
    let source = 'remote'

    // Probeer eerst direct HTTP (werkt remote via Tailscale als Ollama op 0.0.0.0 bindt)
    try {
      const response = await axios.get(`http://${openclawIP}:11434/api/tags`, {
        timeout: 3000,
      })
      models = response.data.models || []
    } catch {
      // Stille fallback — direct HTTP faalt als Ollama op localhost bindt
    }

    // Fallback: via SSH curl (werkt altijd zolang SSH bereikbaar is)
    if (!models || models.length === 0) {
      source = 'ssh-local'
      const localJson = await executeSSHCommand('curl -s http://127.0.0.1:11434/api/tags')
      try {
        const parsed = JSON.parse(localJson.stdout)
        models = parsed.models || []
      } catch (parseError) {
        console.error('[OPENCLAW] invalid JSON from local Ollama API via SSH:', parseError.message)
        throw new Error('Kon OpenClaw Ollama modellijst niet parsen')
      }
    }

    res.json({
      ok: true,
      status: 'Running',
      modelsCount: models.length,
      models,
      modelNames: models.map((m) => m.name),
      source,
    })
  } catch (error) {
    res.status(503).json({
      ok: false,
      status: 'Down',
      modelsCount: 0,
      models: [],
      modelNames: [],
      error: error.message,
    })
  }
})

app.post('/api/openclaw/services/:service/restart', async (req, res) => {
  try {
    const { service } = req.params
    const allowedServices = ['ollama', 'docker', 'nginx']

    if (!allowedServices.includes(service)) {
      return res.status(400).json({
        ok: false,
        error: `Service ${service} niet allowed. Allowed: ${allowedServices.join(', ')}`,
      })
    }

    console.log(`[OPENCLAW] Restarting service: ${service}`)

    const result = await executeSSHCommand(`sudo systemctl restart ${service}`)

    res.json({
      ok: true,
      message: `Service ${service} herstart op OpenClaw`,
      service,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: `Kon ${req.params.service} niet herstarten: ${error.message}`,
    })
  }
})

app.post('/api/openclaw/execute', async (req, res) => {
  try {
    const { command } = req.body || {}

    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Geen geldig command opgegeven',
      })
    }

    // Whitelist van allowed commands (veiligheid!)
    const allowedPatterns = [
      /^ls/,
      /^pwd/,
      /^whoami/,
      /^uptime/,
      /^free/,
      /^df/,
      /^ps/,
      /^systemctl\s+(--user\s+)?(status|start|stop|restart|enable|disable)/,
      /^docker\s+(ps|stats|start|stop|restart|exec|inspect|logs|images|pull|rm|compose)/,
      /^cat\s/,
      /^find\s/,
      /^grep\s/,
      /^sed\s/,
      /^curl/,
      /^ping/,
      /^ollama/,
      /^openclaw/,
      /^ss\s/,
      /^nano\s/,
      /^echo\s/,
      /^mkdir\s/,
      /^cp\s/,
      /^mv\s/,
      /^chmod\s/,
      /^head\s/,
      /^tail\s/,
      /^wc\s/,
      /^tailscale\s/,
      /^hostname/,
      /^sudo\s+tailscale\s/,
    ]

    const isAllowed = allowedPatterns.some((pattern) => pattern.test(command))

    if (!isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Command niet toegestaan. Allowed: ls, pwd, whoami, uptime, free, df, ps, systemctl (status/start/stop/restart), docker, cat, find, grep, sed, curl, ping, ollama, openclaw, ss, echo, mkdir, cp, mv, chmod, head, tail, wc`,
      })
    }

    console.log(`[OPENCLAW] Executing command: ${command}`)

    const result = await executeSSHCommand(command)

    res.json({
      ok: true,
      command,
      output: result.stdout,
      error: result.stderr || null,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: `Command execution failed: ${error.message}`,
    })
  }
})

app.post('/api/cluster/reset', async (req, res) => {
  try {
    console.log(`[CLUSTER] Full reset initiated`)

    // 1. Kill local ollama
    try {
      await restartOllamaLocal()
    } catch {
      console.log('[CLUSTER] Local Ollama restart had issues, continuing...')
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. Reset model cache
    currentOllamaModel = ''

    // 3. Validate Ollama is back
    const info = await getOllamaInfo()
    if (info.ok && info.modelNames.length > 0) {
      currentOllamaModel = info.modelNames[0]
    }

    res.json({
      ok: true,
      message: 'Cluster reset uitgevoerd',
      ollamaStatus: info.status,
      currentModel: currentOllamaModel,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: `Cluster reset mislukt: ${error.message}`,
    })
  }
})

app.get('/api/cluster/status', async (req, res) => {
  try {
    const nodes = []

    for (const node of NODES) {
      const online = await ping(node.ip)
      nodes.push({
        ...node,
        status: online ? 'online' : 'offline',
      })
    }

    const ollama = await getOllamaInfo()
    const nodesLive = nodes.filter((n) => n.status === 'online').length
    const victus = nodes.find((n) => n.name.toLowerCase().includes('victus'))

    let clusterState = 'OFFLINE'
    if (nodesLive > 0 && ollama.ok) clusterState = 'ACTIVE'
    else if (nodesLive > 0) clusterState = 'DEGRADED'

    res.json({
      ok: true,
      clusterState,
      nodes,
      nodesLive,
      victusStatus: victus?.status || 'unknown',
      ollamaStatus: ollama.status,
      modelsCount: ollama.modelsCount,
      currentModel: currentOllamaModel || '',
      mode: 'AI Mode',
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

// ----------------------
// Docker Management endpoints (Lucifershell)
// ----------------------

app.get('/api/docker/containers', async (req, res) => {
  try {
    const result = await executeSSHCommand(
      'docker ps -a --format \'{"name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","ports":"{{.Ports}}","state":"{{.State}}","id":"{{.ID}}"}\''
    )
    const lines = result.stdout.trim().split('\n').filter(Boolean)
    const containers = lines.map((line) => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
    res.json({ ok: true, containers })
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message })
  }
})

app.post('/api/docker/containers/:name/start', async (req, res) => {
  try {
    const { name } = req.params
    await executeSSHCommand(`docker start ${name}`)
    res.json({ ok: true, message: `Container ${name} gestart` })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

app.post('/api/docker/containers/:name/stop', async (req, res) => {
  try {
    const { name } = req.params
    await executeSSHCommand(`docker stop ${name}`)
    res.json({ ok: true, message: `Container ${name} gestopt` })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

app.post('/api/docker/containers/:name/restart', async (req, res) => {
  try {
    const { name } = req.params
    await executeSSHCommand(`docker restart ${name}`)
    res.json({ ok: true, message: `Container ${name} herstart` })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

app.get('/api/docker/containers/:name/logs', async (req, res) => {
  try {
    const { name } = req.params
    const result = await executeSSHCommand(`docker logs --tail 50 ${name} 2>&1`)
    res.json({ ok: true, logs: result.stdout })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

app.get('/api/docker/images', async (req, res) => {
  try {
    const result = await executeSSHCommand(
      'docker images --format \'{"repository":"{{.Repository}}","tag":"{{.Tag}}","size":"{{.Size}}","id":"{{.ID}}"}\''
    )
    const lines = result.stdout.trim().split('\n').filter(Boolean)
    const images = lines.map((line) => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
    res.json({ ok: true, images })
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message })
  }
})

app.get('/api/docker/stats', async (req, res) => {
  try {
    const result = await executeSSHCommand(
      'docker stats --no-stream --format \'{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","net":"{{.NetIO}}"}\''
    )
    const lines = result.stdout.trim().split('\n').filter(Boolean)
    const stats = lines.map((line) => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
    res.json({ ok: true, stats })
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message })
  }
})

// n8n container management
app.post('/api/docker/n8n/deploy', async (req, res) => {
  try {
    // Check if n8n already exists
    const check = await executeSSHCommand('docker ps -a --filter name=n8n --format "{{.Names}}"')
    if (check.stdout.trim() === 'n8n') {
      await executeSSHCommand('docker start n8n')
      return res.json({ ok: true, message: 'n8n container gestart (bestond al)' })
    }

    await executeSSHCommand(
      'docker run -d --name n8n --restart unless-stopped -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n:latest'
    )
    res.json({ ok: true, message: 'n8n deployed en gestart op poort 5678' })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

// ComfyUI status (runs on Victus locally)
app.get('/api/comfyui/status', async (req, res) => {
  try {
    const response = await axios.get('http://127.0.0.1:8188/system_stats', { timeout: 3000 })
    res.json({ ok: true, status: 'running', stats: response.data })
  } catch {
    res.json({ ok: false, status: 'offline' })
  }
})

app.post('/api/comfyui/start', async (req, res) => {
  try {
    // ComfyUI typically runs from a local directory
    const startCmd = process.platform === 'win32'
      ? 'start "" /D "C:\\ComfyUI" python main.py --listen 0.0.0.0'
      : 'cd ~/ComfyUI && python main.py --listen 0.0.0.0 &'
    await execCommand(startCmd, { shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash' })
    res.json({ ok: true, message: 'ComfyUI wordt gestart...' })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

// ----------------------
// Kali Linux endpoints
// ----------------------

app.get('/api/kali/system-info', async (req, res) => {
  try {
    const [cpuRes, memRes, diskRes, uptimeRes, loadRes, procsRes, netRes] = await Promise.all([
      executeKaliSSHCommand('nproc'),
      executeKaliSSHCommand('free -h | grep Mem'),
      executeKaliSSHCommand('df -h / | tail -1'),
      executeKaliSSHCommand('uptime -p'),
      executeKaliSSHCommand('cat /proc/loadavg'),
      executeKaliSSHCommand('ps aux --no-headers | wc -l'),
      executeKaliSSHCommand("ip -br addr show | grep UP | head -3"),
    ])

    const memParts = memRes.stdout.trim().split(/\s+/)
    const diskParts = diskRes.stdout.trim().split(/\s+/)
    const loadParts = loadRes.stdout.trim().split(/\s+/)

    res.json({
      ok: true,
      cpu_cores: cpuRes.stdout.trim(),
      memory: `${memParts[2] || '-'} / ${memParts[1] || '-'}`,
      disk: `${diskParts[2] || '-'} / ${diskParts[1] || '-'} (${diskParts[4] || '-'})`,
      uptime: uptimeRes.stdout.trim(),
      load: `${loadParts[0] || '-'} ${loadParts[1] || '-'} ${loadParts[2] || '-'}`,
      processes: procsRes.stdout.trim(),
      network: netRes.stdout.trim(),
    })
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message })
  }
})

app.get('/api/kali/top-processes', async (req, res) => {
  try {
    const result = await executeKaliSSHCommand('ps aux --sort=-%cpu | head -8')
    const lines = result.stdout.trim().split('\n')
    const procs = lines.slice(1).map((line) => {
      const parts = line.trim().split(/\s+/)
      return {
        user: parts[0],
        pid: parts[1],
        cpu: parts[2],
        mem: parts[3],
        command: parts.slice(10).join(' '),
      }
    })
    res.json({ ok: true, processes: procs })
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message })
  }
})

app.post('/api/kali/execute', async (req, res) => {
  try {
    const { command } = req.body
    if (!command) return res.status(400).json({ ok: false, error: 'Geen command opgegeven' })
    const result = await executeKaliSSHCommand(command)
    res.json({ ok: true, command, output: result.stdout, error: result.stderr || null })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

// ----------------------
// HTTP server + WebSocket
// ----------------------

const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const type = url.searchParams.get('type')

  console.log(`[WS] Nieuwe terminal connectie: type=${type}`)

  if (type === 'powershell') {
    try {
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash'
      const term = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: process.env.USERPROFILE || process.cwd(),
        env: process.env,
      })

      console.log(`[WS] PowerShell terminal spawned`)

      term.onData((data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(data)
        }
      })

      term.onExit(() => {
        console.log(`[WS] PowerShell terminal gesloten`)
        if (ws.readyState === ws.OPEN) {
          ws.close()
        }
      })

      ws.on('message', (message) => {
        try {
          const payload = JSON.parse(message.toString())

          if (payload.type === 'input') {
            term.write(payload.data)
          }

          if (payload.type === 'resize') {
            const cols = Number(payload.cols) || 120
            const rows = Number(payload.rows) || 30
            term.resize(cols, rows)
          }
        } catch (e) {
          console.error(`[WS] Message parse error:`, e.message)
        }
      })

      ws.on('close', () => {
        try {
          term.kill()
        } catch {}
      })

      ws.on('error', (err) => {
        console.error(`[WS] PowerShell WebSocket error:`, err.message)
      })

      return
    } catch (err) {
      console.error(`[WS] PowerShell spawn error:`, err.message)
      ws.send(`\r\n[ERROR] PowerShell kon niet worden gestart: ${err.message}\r\n`)
      ws.close()
      return
    }
  }

  if (type === 'linux') {
    const sshHost = process.env.LINUX_SSH_HOST
    const sshPort = Number(process.env.LINUX_SSH_PORT || '22')
    const sshUser = process.env.LINUX_SSH_USER
    const sshPassword = process.env.LINUX_SSH_PASSWORD

    if (!sshHost || !sshUser || !sshPassword) {
      console.error(`[WS] SSH config ontbreekt:`, {
        host: !!sshHost,
        user: !!sshUser,
        pass: !!sshPassword,
      })
      ws.send(
        '\r\n[ERROR] SSH config ontbreekt. Zet backend/.env met LINUX_SSH_HOST, LINUX_SSH_USER en LINUX_SSH_PASSWORD.\r\n'
      )
      ws.close()
      return
    }

    console.log(`[WS] SSH connectie initialiseren: ${sshUser}@${sshHost}:${sshPort}`)

    const conn = new Client()
    let shellStream = null
    let connected = false

    conn
      .on('ready', () => {
        console.log(`[WS] SSH verbonden, shell openen...`)
        conn.shell(
          {
            term: 'xterm-256color',
            cols: 120,
            rows: 30,
          },
          (err, stream) => {
            if (err) {
              console.error(`[WS] SSH shell error:`, err.message)
              ws.send(`\r\n[ERROR] SSH shell fout: ${err.message}\r\n`)
              ws.close()
              conn.end()
              return
            }

            shellStream = stream
            connected = true
            console.log(`[WS] SSH shell actief`)

            stream.on('data', (data) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(data.toString('utf8'))
              }
            })

            stream.stderr?.on('data', (data) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(data.toString('utf8'))
              }
            })

            ws.on('message', (message) => {
              if (!shellStream) return
              try {
                const payload = JSON.parse(message.toString())

                if (payload.type === 'input') {
                  shellStream.write(payload.data)
                }

                if (payload.type === 'resize') {
                  const cols = Number(payload.cols) || 120
                  const rows = Number(payload.rows) || 30
                  shellStream.setWindow(rows, cols, 480, 1280)
                }
              } catch (e) {
                console.error(`[WS] SSH message parse error:`, e.message)
              }
            })

            ws.on('close', () => {
              console.log(`[WS] SSH WebSocket gesloten`)
              if (shellStream) {
                try {
                  shellStream.end('exit\n')
                } catch {}
              }
              conn.end()
            })

            stream.on('close', () => {
              console.log(`[WS] SSH shell gesloten`)
              conn.end()
              if (ws.readyState === ws.OPEN) ws.close()
            })

            stream.on('error', (err) => {
              console.error(`[WS] SSH stream error:`, err.message)
              if (ws.readyState === ws.OPEN) {
                ws.send(`\r\n[ERROR] SSH stream error: ${err.message}\r\n`)
              }
            })
          }
        )
      })
      .on('error', (err) => {
        console.error(`[WS] SSH connection error:`, err.message)
        if (ws.readyState === ws.OPEN) {
          ws.send(`\r\n[ERROR] SSH connectie mislukt: ${err.message}\r\n`)
          ws.close()
        }
      })
      .on('close', () => {
        console.log(`[WS] SSH verbinding gesloten`)
      })
      .connect({
        host: sshHost,
        port: sshPort,
        username: sshUser,
        password: sshPassword,
        readyTimeout: 10000,
      })

    ws.on('error', (err) => {
      console.error(`[WS] Linux WebSocket error:`, err.message)
    })

    return
  }

  if (type === 'kali') {
    const kaliHost = process.env.KALI_SSH_HOST
    const kaliPort = Number(process.env.KALI_SSH_PORT || '22')
    const kaliUser = process.env.KALI_SSH_USER
    const kaliPassword = process.env.KALI_SSH_PASSWORD

    if (!kaliHost || !kaliUser || !kaliPassword) {
      ws.send('\r\n[ERROR] Kali SSH config ontbreekt. Zet KALI_SSH_HOST, KALI_SSH_USER en KALI_SSH_PASSWORD in backend/.env.\r\n')
      ws.close()
      return
    }

    console.log(`[WS] Kali SSH connectie initialiseren: ${kaliUser}@${kaliHost}:${kaliPort}`)

    const conn = new Client()
    let shellStream = null

    conn
      .on('ready', () => {
        console.log(`[WS] Kali SSH verbonden, shell openen...`)
        conn.shell(
          { term: 'xterm-256color', cols: 120, rows: 30 },
          (err, stream) => {
            if (err) {
              ws.send(`\r\n[ERROR] Kali SSH shell fout: ${err.message}\r\n`)
              ws.close()
              conn.end()
              return
            }

            shellStream = stream
            console.log(`[WS] Kali SSH shell actief`)

            stream.on('data', (data) => {
              if (ws.readyState === ws.OPEN) ws.send(data.toString('utf8'))
            })

            stream.stderr?.on('data', (data) => {
              if (ws.readyState === ws.OPEN) ws.send(data.toString('utf8'))
            })

            ws.on('message', (message) => {
              if (!shellStream) return
              try {
                const payload = JSON.parse(message.toString())
                if (payload.type === 'input') shellStream.write(payload.data)
                if (payload.type === 'resize') {
                  const cols = Number(payload.cols) || 120
                  const rows = Number(payload.rows) || 30
                  shellStream.setWindow(rows, cols, 480, 1280)
                }
              } catch (e) {
                console.error(`[WS] Kali SSH message parse error:`, e.message)
              }
            })

            ws.on('close', () => {
              console.log(`[WS] Kali SSH WebSocket gesloten`)
              try { shellStream.end('exit\n') } catch {}
              conn.end()
            })

            stream.on('close', () => {
              console.log(`[WS] Kali SSH shell gesloten`)
              conn.end()
              if (ws.readyState === ws.OPEN) ws.close()
            })

            stream.on('error', (err) => {
              console.error(`[WS] Kali SSH stream error:`, err.message)
              if (ws.readyState === ws.OPEN) {
                ws.send(`\r\n[ERROR] Kali SSH stream error: ${err.message}\r\n`)
              }
            })
          }
        )
      })
      .on('error', (err) => {
        console.error(`[WS] Kali SSH connection error:`, err.message)
        if (ws.readyState === ws.OPEN) {
          ws.send(`\r\n[ERROR] Kali SSH connectie mislukt: ${err.message}\r\n`)
          ws.close()
        }
      })
      .on('close', () => {
        console.log(`[WS] Kali SSH verbinding gesloten`)
      })
      .connect({
        host: kaliHost,
        port: kaliPort,
        username: kaliUser,
        password: kaliPassword,
        readyTimeout: 10000,
      })

    ws.on('error', (err) => {
      console.error(`[WS] Kali WebSocket error:`, err.message)
    })

    return
  }

  ws.send('\r\n[ERROR] Ongeldig terminal type.\r\n')
  ws.close()
  console.error(`[WS] Ongeldig terminal type: ${type}`)
})

// ----------------------
// WebSocket VNC proxy → Kali x11vnc
// ----------------------
const vncWss = new WebSocketServer({ noServer: true })

vncWss.on('connection', (ws) => {
  const kaliHost = process.env.KALI_SSH_HOST
  const vncPort = 5900

  console.log(`[VNC] Nieuwe VNC proxy verbinding naar ${kaliHost}:${vncPort}`)

  const vncSocket = new net.Socket()

  vncSocket.connect(vncPort, kaliHost, () => {
    console.log('[VNC] TCP verbonden met Kali VNC server')
  })

  vncSocket.on('data', (data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data)
    }
  })

  ws.on('message', (data) => {
    if (!vncSocket.destroyed) {
      vncSocket.write(Buffer.isBuffer(data) ? data : Buffer.from(data))
    }
  })

  ws.on('close', () => {
    console.log('[VNC] WebSocket gesloten, VNC socket sluiten')
    vncSocket.destroy()
  })

  vncSocket.on('close', () => {
    console.log('[VNC] VNC socket gesloten')
    if (ws.readyState === ws.OPEN) ws.close()
  })

  vncSocket.on('error', (err) => {
    console.error('[VNC] TCP socket error:', err.message)
    if (ws.readyState === ws.OPEN) ws.close()
  })

  ws.on('error', (err) => {
    console.error('[VNC] WebSocket error:', err.message)
    vncSocket.destroy()
  })
})

// Manual upgrade handler for multiple WebSocket servers
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`)

  if (pathname === '/ws/terminal') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  } else if (pathname === '/ws/vnc') {
    vncWss.handleUpgrade(request, socket, head, (ws) => {
      vncWss.emit('connection', ws, request)
    })
  } else {
    socket.destroy()
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Cluster backend + terminal draait op http://0.0.0.0:${PORT}`)
})

server.on('error', (err) => {
  console.error('[SERVER] Fout bij starten van de backend:', err.message)
  if (err.code === 'EADDRINUSE') {
    console.error(`[SERVER] Poort ${PORT} is al in gebruik. Gebruik een andere PORT in .env of stop het proces dat deze poort bezet.`)
  }
})

app.post('/api/ollama/generate', async (req, res) => {
  try {
    const { prompt } = req.body || {}

    if (!prompt) {
      return res.status(400).json({
        ok: false,
        error: 'Geen prompt opgegeven',
      })
    }

    // Bepaal welk model te gebruiken voor generatie
    const EMBED_PATTERNS = /embed|nomic-embed|bge-|e5-/i
    let generateModel = currentOllamaModel

    // Als het huidige model een embedding model is, zoek een chat model
    if (!generateModel || EMBED_PATTERNS.test(generateModel)) {
      try {
        const info = await getOllamaInfo()
        generateModel = info.modelNames.find((n) => !EMBED_PATTERNS.test(n))
      } catch {}
    }

    if (!generateModel) {
      return res.status(400).json({
        ok: false,
        error: 'Geen chat model beschikbaar (alleen embedding models gevonden)',
      })
    }

    const response = await axios.post('http://127.0.0.1:11434/api/generate', {
      model: generateModel,
      prompt,
      stream: false,
    })

    res.json({
      ok: true,
      response: response.data.response,
      model: currentOllamaModel,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})