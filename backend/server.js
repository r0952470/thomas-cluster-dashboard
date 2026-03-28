require('dotenv').config()

const express = require('express')
const cors = require('cors')
const axios = require('axios')
const { exec } = require('child_process')
const http = require('http')
const { WebSocketServer } = require('ws')
const pty = require('node-pty')
const { Client } = require('ssh2')

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

const NODES = [
  {
    name: 'Victus',
    ip: '127.0.0.1',
    role: 'AI Brain',
    canRestart: false,
  },
  {
    name: 'Proxmox',
    ip: '192.168.0.50',
    role: 'Hypervisor',
    canRestart: false,
  },
  {
    name: 'Ubuntu/OpenClaw',
    ip: process.env.LINUX_SSH_HOST || '192.168.0.161',
    role: 'Gateway',
    canRestart: false,
  },
]

let currentOllamaModel = ''

// In-memory opslag voor OpenClaw agents en skills
const openclawAgents = []
const openclawSkills = []

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
  return new Promise((resolve) => {
    exec(`ping -n 1 ${ip}`, (error) => {
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
      currentOllamaModel = modelNames[0]
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

app.get('/api/openclaw/status', async (req, res) => {
  try {
    const result = await executeSSHCommand('uptime')

    res.json({
      ok: true,
      status: 'online',
      uptime: result.stdout.trim(),
      node: 'Ubuntu/OpenClaw',
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
    const openclawIP = process.env.LINUX_SSH_HOST || '192.168.0.161'
    let models = []
    let usedLocal = false

    try {
      const response = await axios.get(`http://${openclawIP}:11434/api/tags`, {
        timeout: 3000,
      })
      models = response.data.models || []
    } catch (remoteError) {
      console.warn('[OPENCLAW] hard fallback to SSH curl (remote failed):', remoteError.message)
    }

    if (!models || models.length === 0) {
      // fallback: query localhost on Gateway via SSH (same as curl localhost)
      usedLocal = true
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
      source: usedLocal ? 'ssh-local' : 'remote',
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
      /^systemctl\s+status/,
      /^docker\s+(ps|stats)/,
      /^curl/,
      /^ping/,
      /^ollama/,
      /^python3/,
      /^cat\s/,
      /^tail\s/,
      /^kill\s/,
      /^nohup\s/,
      /^mkdir\s/,
      /^tee\s/,
    ]

    const isAllowed = allowedPatterns.some((pattern) => pattern.test(command))

    if (!isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Command niet toegestaan. Allowed: ls, pwd, whoami, uptime, free, df, ps, systemctl status, docker ps, ollama, curl, ping, python3, cat, tail, kill, nohup, mkdir, tee`,
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

// ----------------------
// OpenClaw Agents endpoints
// ----------------------

app.get('/api/openclaw/agents', async (req, res) => {
  try {
    // Haal running status op via SSH
    let runningPids = {}
    try {
      const psResult = await executeSSHCommand('ps aux | grep agent')
      const lines = psResult.stdout.split('\n').filter((l) => l.includes('run.py'))
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        const pid = parts[1]
        const cmdParts = line.match(/\/opt\/openclaw\/agents\/([^/]+)\/run\.py/)
        if (cmdParts && cmdParts[1]) {
          runningPids[cmdParts[1]] = pid
        }
      }
    } catch {
      // SSH niet beschikbaar, status blijft 'stopped'
    }

    const agentsWithStatus = openclawAgents.map((agent) => ({
      ...agent,
      status: runningPids[agent.name] ? 'running' : 'stopped',
      pid: runningPids[agent.name] || null,
    }))

    res.json({ ok: true, agents: agentsWithStatus })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

app.post('/api/openclaw/agents', (req, res) => {
  const { name, description, model, skills } = req.body || {}

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Agent naam is verplicht' })
  }

  // Valideer naam: alleen alfanumeriek, underscores en koppeltekens (veiligheid SSH commandos)
  const safeName = name.trim()
  if (!/^[a-zA-Z0-9_-]+$/.test(safeName)) {
    return res.status(400).json({
      ok: false,
      error: 'Agent naam mag alleen letters, cijfers, underscores en koppeltekens bevatten',
    })
  }

  const agent = {
    id: crypto.randomUUID(),
    name: safeName,
    description: description || '',
    model: model || '',
    skills: Array.isArray(skills) ? skills : [],
    createdAt: new Date().toISOString(),
  }

  openclawAgents.push(agent)
  console.log(`[OPENCLAW] Agent aangemaakt: ${agent.name} (${agent.id})`)
  res.status(201).json({ ok: true, agent })
})

app.post('/api/openclaw/agents/:id/start', async (req, res) => {
  const agent = openclawAgents.find((a) => a.id === req.params.id)
  if (!agent) return res.status(404).json({ ok: false, error: 'Agent niet gevonden' })

  try {
    await executeSSHCommand(`mkdir -p /opt/openclaw/agents/${agent.name}`)
    const startCmd = `nohup python3 /opt/openclaw/agents/${agent.name}/run.py > /opt/openclaw/agents/${agent.name}/agent.log 2>&1 &`
    await executeSSHCommand(startCmd)
    console.log(`[OPENCLAW] Agent gestart: ${agent.name}`)
    res.json({ ok: true, message: `Agent ${agent.name} gestart` })
  } catch (error) {
    res.status(500).json({ ok: false, error: `Kon agent niet starten: ${error.message}` })
  }
})

app.post('/api/openclaw/agents/:id/stop', async (req, res) => {
  const agent = openclawAgents.find((a) => a.id === req.params.id)
  if (!agent) return res.status(404).json({ ok: false, error: 'Agent niet gevonden' })

  try {
    const pidResult = await executeSSHCommand(
      `ps aux | grep "/opt/openclaw/agents/${agent.name}/run.py" | grep -v grep | awk '{print $2}'`
    )
    const pid = pidResult.stdout.trim()

    if (pid) {
      await executeSSHCommand(`kill ${pid}`)
      console.log(`[OPENCLAW] Agent gestopt: ${agent.name} (PID ${pid})`)
      res.json({ ok: true, message: `Agent ${agent.name} gestopt (PID ${pid})` })
    } else {
      res.json({ ok: true, message: `Agent ${agent.name} was niet actief` })
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: `Kon agent niet stoppen: ${error.message}` })
  }
})

app.delete('/api/openclaw/agents/:id', (req, res) => {
  const index = openclawAgents.findIndex((a) => a.id === req.params.id)
  if (index === -1) return res.status(404).json({ ok: false, error: 'Agent niet gevonden' })

  const [removed] = openclawAgents.splice(index, 1)
  console.log(`[OPENCLAW] Agent verwijderd: ${removed.name}`)
  res.json({ ok: true, message: `Agent ${removed.name} verwijderd` })
})

app.get('/api/openclaw/agents/:id/logs', async (req, res) => {
  const agent = openclawAgents.find((a) => a.id === req.params.id)
  if (!agent) return res.status(404).json({ ok: false, error: 'Agent niet gevonden' })

  try {
    const result = await executeSSHCommand(
      `tail -50 /opt/openclaw/agents/${agent.name}/agent.log`
    )
    res.json({ ok: true, logs: result.stdout || '(geen logs beschikbaar)' })
  } catch (error) {
    res.json({ ok: true, logs: `(log bestand niet gevonden: ${error.message})` })
  }
})

app.post('/api/openclaw/agents/:id/skills', (req, res) => {
  const agent = openclawAgents.find((a) => a.id === req.params.id)
  if (!agent) return res.status(404).json({ ok: false, error: 'Agent niet gevonden' })

  const { skillId } = req.body || {}
  if (!skillId) return res.status(400).json({ ok: false, error: 'skillId is verplicht' })

  const skill = openclawSkills.find((s) => s.id === skillId)
  if (!skill) return res.status(404).json({ ok: false, error: 'Skill niet gevonden' })

  if (!agent.skills.includes(skillId)) {
    agent.skills.push(skillId)
  }

  res.json({ ok: true, message: `Skill ${skill.name} toegewezen aan ${agent.name}`, agent })
})

app.delete('/api/openclaw/agents/:id/skills/:skillId', (req, res) => {
  const agent = openclawAgents.find((a) => a.id === req.params.id)
  if (!agent) return res.status(404).json({ ok: false, error: 'Agent niet gevonden' })

  agent.skills = agent.skills.filter((s) => s !== req.params.skillId)
  res.json({ ok: true, message: 'Skill verwijderd van agent', agent })
})

// ----------------------
// OpenClaw Skills endpoints
// ----------------------

app.get('/api/openclaw/skills', (req, res) => {
  res.json({ ok: true, skills: openclawSkills })
})

app.post('/api/openclaw/skills', (req, res) => {
  const { name, description, type, code } = req.body || {}

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Skill naam is verplicht' })
  }

  const allowedTypes = ['prompt', 'script', 'api-call']
  const skillType = allowedTypes.includes(type) ? type : 'prompt'

  const skill = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description || '',
    type: skillType,
    code: code || '',
    createdAt: new Date().toISOString(),
  }

  openclawSkills.push(skill)
  console.log(`[OPENCLAW] Skill aangemaakt: ${skill.name} (${skill.id})`)
  res.status(201).json({ ok: true, skill })
})

app.put('/api/openclaw/skills/:id', (req, res) => {
  const skill = openclawSkills.find((s) => s.id === req.params.id)
  if (!skill) return res.status(404).json({ ok: false, error: 'Skill niet gevonden' })

  const { name, description, type, code } = req.body || {}
  const allowedTypes = ['prompt', 'script', 'api-call']

  if (name && typeof name === 'string') skill.name = name.trim()
  if (description !== undefined) skill.description = description
  if (type && allowedTypes.includes(type)) skill.type = type
  if (code !== undefined) skill.code = code
  skill.updatedAt = new Date().toISOString()

  res.json({ ok: true, skill })
})

app.delete('/api/openclaw/skills/:id', (req, res) => {
  const index = openclawSkills.findIndex((s) => s.id === req.params.id)
  if (index === -1) return res.status(404).json({ ok: false, error: 'Skill niet gevonden' })

  const [removed] = openclawSkills.splice(index, 1)

  // Verwijder ook van alle agents
  for (const agent of openclawAgents) {
    agent.skills = agent.skills.filter((s) => s !== req.params.id)
  }

  console.log(`[OPENCLAW] Skill verwijderd: ${removed.name}`)
  res.json({ ok: true, message: `Skill ${removed.name} verwijderd` })
})

app.post('/api/openclaw/skills/:id/test', async (req, res) => {
  const skill = openclawSkills.find((s) => s.id === req.params.id)
  if (!skill) return res.status(404).json({ ok: false, error: 'Skill niet gevonden' })

  try {
    let output = ''

    if (skill.type === 'script') {
      output = `[SCRIPT SKILL PREVIEW]\nNaam: ${skill.name}\n\nCode:\n${skill.code || '(leeg)'}\n\n(SSH uitvoering is beschikbaar via de terminal)`
    } else if (skill.type === 'prompt') {
      output = `[PROMPT SKILL] Code:\n${skill.code || '(leeg)'}\n\n(Verzend naar Ollama voor echte uitvoer)`
    } else if (skill.type === 'api-call') {
      output = `[API-CALL SKILL] Code:\n${skill.code || '(leeg)'}\n\n(API-call simulatie)`
    } else {
      output = skill.code || '(geen code)'
    }

    res.json({ ok: true, output })
  } catch (error) {
    res.status(500).json({ ok: false, error: `Skill test mislukt: ${error.message}` })
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
// HTTP server + WebSocket
// ----------------------

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws/terminal' })

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

  ws.send('\r\n[ERROR] Ongeldig terminal type.\r\n')
  ws.close()
  console.error(`[WS] Ongeldig terminal type: ${type}`)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Cluster backend + terminal draait op http://0.0.0.0:${PORT}`)
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

    if (!currentOllamaModel) {
      return res.status(400).json({
        ok: false,
        error: 'Geen model geselecteerd',
      })
    }

    const response = await axios.post('http://127.0.0.1:11434/api/generate', {
      model: currentOllamaModel,
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