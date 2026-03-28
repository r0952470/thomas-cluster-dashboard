import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import './xterm-custom.css'

const flowSteps = [
  'Overlay netwerk controleren',
  'Infra-node controleren',
  'Victus AI-node vinden',
  'Ollama server valideren',
  'OpenClaw koppelen aan Victus',
  'Dashboards en panelen activeren',
]

export default function App() {
  const [nodes, setNodes] = useState([])
  const [clusterState, setClusterState] = useState('IDLE')
  const [activeStep, setActiveStep] = useState(null)
  const [logs, setLogs] = useState([
    '[BOOT] Thomas Cluster UI geladen',
    '[WAIT] Backend status ophalen...',
  ])
  const [nodesLive, setNodesLive] = useState(0)
  const [victusStatus, setVictusStatus] = useState('unknown')
  const [ollamaStatus, setOllamaStatus] = useState('Down')
  const [modelsCount, setModelsCount] = useState(0)
  const [mode, setMode] = useState('AI Mode')
  const [loading, setLoading] = useState(false)
  const [commandBusy, setCommandBusy] = useState({})
  const [ollamaModels, setOllamaModels] = useState([])
  const [currentModel, setCurrentModel] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState([])
  const [openclawStatus, setOpenclawStatus] = useState('unknown')
  const [openclawInfo, setOpenclawInfo] = useState({
    cpu_cores: '-',
    memory: '-',
    disk: '-',
  })
  const [openclawCommand, setOpenclawCommand] = useState('')
  const [openclawOutput, setOpenclawOutput] = useState('')
  const [openclawOllama, setOpenclawOllama] = useState({
    status: 'offline',
    modelsCount: 0,
    models: [],
    modelNames: [],
  })

  const [agents, setAgents] = useState([])
  const [skills, setSkills] = useState([])
  const [agentForm, setAgentForm] = useState({ name: '', description: '', model: '', skills: [] })
  const [skillForm, setSkillForm] = useState({ name: '', description: '', type: 'prompt', code: '' })
  const [editingSkill, setEditingSkill] = useState(null)
  const [agentLogs, setAgentLogs] = useState({})

  const addLog = (line) => {
    setLogs((prev) => [line, ...prev].slice(0, 40))
  }

  const setBusy = (key, value) => {
    setCommandBusy((prev) => ({ ...prev, [key]: value }))
  }

  const [expandedSections, setExpandedSections] = useState({
    openclaw: true,
    ollama: true,
    cluster: true,
    ai: false,
    terminals: false,
    agents: false,
    skills: false,
  })

  const toggleSection = (name) => {
    setExpandedSections((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const AccordionSection = ({ name, title, children, defaultOpen = false }) => {
    const isOpen = expandedSections[name] ?? defaultOpen

    return (
      <section className="mt-4 rounded-2xl border border-zinc-800 bg-black">
        <button
          type="button"
          onClick={() => toggleSection(name)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <span className="text-lg font-semibold">{title}</span>
          <span className="text-zinc-400">{isOpen ? '▾' : '▸'}</span>
        </button>

        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
            isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-4">{children}</div>
        </div>
      </section>
    )
  }

  const fetchClusterStatus = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
        addLog('[WAIT] Cluster status ophalen...')
      }

      const response = await fetch('http://0.0.0.0:3001/api/cluster/status')
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)

      const victusNode = data.nodes?.find((n) => n.name.toLowerCase().includes('victus'))

      setClusterState(data.clusterState || 'UNKNOWN')
      setNodesLive(data.nodesLive ?? 0)
      setNodes(Array.isArray(data.nodes) ? data.nodes : [])
      setVictusStatus(victusNode?.status || 'unknown')
      setOllamaStatus(data.ollamaStatus || 'Down')
      setModelsCount(data.modelsCount ?? 0)
      setMode(data.mode || 'AI Mode')

      if (!silent) addLog('[OK] Cluster status vernieuwd')
    } catch (error) {
      setClusterState('OFFLINE')
      setNodesLive(0)
      setNodes([])
      setVictusStatus('unknown')
      setOllamaStatus('Down')
      setModelsCount(0)
      if (!silent) addLog(`[ERROR] Backend onbereikbaar: ${error.message}`)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const fetchOllamaDashboard = async (silent = false) => {
    try {
      if (!silent) addLog('[WAIT] Ollama dashboard data ophalen...')

      const [modelsRes, currentRes] = await Promise.all([
        fetch('http://0.0.0.0:3001/api/ollama/models'),
        fetch('http://0.0.0.0:3001/api/ollama/current'),
      ])

      const modelsData = await modelsRes.json()
      const currentData = await currentRes.json()

      if (!modelsRes.ok) throw new Error(modelsData.error || 'Kon modellen niet ophalen')
      if (!currentRes.ok) throw new Error(currentData.error || 'Kon huidige model niet ophalen')

      const names = Array.isArray(modelsData.models) ? modelsData.models : []
      setOllamaModels(names)
      setCurrentModel(currentData.currentModel || '')
      setSelectedModel((prev) => prev || currentData.currentModel || names[0] || '')

      if (!silent) addLog('[OK] Ollama dashboard vernieuwd')
    } catch (error) {
      if (!silent) addLog(`[ERROR] Ollama dashboard: ${error.message}`)
    }
  }

  const fetchOpenclawDashboard = async (silent = false) => {
    try {
      if (!silent) addLog('[WAIT] OpenClaw info ophalen...')

      const [statusRes, infoRes, ollamaRes] = await Promise.all([
        fetch('http://0.0.0.0:3001/api/openclaw/status'),
        fetch('http://0.0.0.0:3001/api/openclaw/system-info'),
        fetch('http://0.0.0.0:3001/api/openclaw/ollama'),
      ])

      const statusData = await statusRes.json()
      const infoData = await infoRes.json()
      const ollamaData = await ollamaRes.json()

      if (statusRes.ok && statusData.ok) {
        setOpenclawStatus('online')
      } else {
        setOpenclawStatus('offline')
      }

      if (infoRes.ok && infoData.ok) {
        setOpenclawInfo(infoData)
      }

      if (ollamaRes.ok && ollamaData.ok) {
        setOpenclawOllama(ollamaData)
      } else {
        setOpenclawOllama({
          status: 'offline',
          modelsCount: 0,
          models: [],
          modelNames: [],
        })
      }

      if (!silent) addLog('[OK] OpenClaw info vernieuwd')
    } catch (error) {
      setOpenclawStatus('offline')
      setOpenclawOllama({
        status: 'offline',
        modelsCount: 0,
        models: [],
        modelNames: [],
      })
      if (!silent) addLog(`[ERROR] OpenClaw info: ${error.message}`)
    }
  }

  const refreshAll = async () => {
    await Promise.all([
      fetchClusterStatus(),
      fetchOllamaDashboard(true),
      fetchOpenclawDashboard(true),
      fetchAgents(true),
      fetchSkills(true),
    ])
  }

  const startCluster = async () => {
    setClusterState('BOOTING')
    addLog('[START] Cluster boot gestart')

    for (let i = 0; i < flowSteps.length; i++) {
      setActiveStep(i)
      addLog(`[STEP ${i + 1}] ${flowSteps[i]}`)
      await delay(300)
    }

    setActiveStep(null)
    await refreshAll()
  }

  const reconnectAll = async () => {
    setClusterState('RECONNECTING')
    addLog('[RELINK] Reconnect gestart')
    setActiveStep(2)
    await delay(700)
    setActiveStep(null)
    await refreshAll()
  }

  const pingNode = async (nodeName) => {
    const key = `ping-${nodeName}`
    try {
      setBusy(key, true)
      addLog(`[WAIT] Ping naar ${nodeName}...`)

      const response = await fetch(
        `http://0.0.0.0:3001/api/nodes/${encodeURIComponent(nodeName)}/ping`,
        { method: 'POST' }
      )
      const data = await response.json()

      if (!response.ok || !data.ok) throw new Error(data.error || 'Ping mislukt')

      addLog(`[OK] ${nodeName} is ${data.status}`)
      await fetchClusterStatus(true)
    } catch (error) {
      addLog(`[ERROR] Ping ${nodeName}: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const restartNode = async (nodeName) => {
    const key = `restart-${nodeName}`
    try {
      setBusy(key, true)
      addLog(`[WAIT] Restart aanvraag voor ${nodeName}...`)

      const response = await fetch(
        `http://0.0.0.0:3001/api/nodes/${encodeURIComponent(nodeName)}/restart`,
        { method: 'POST' }
      )
      const data = await response.json()

      if (!response.ok || !data.ok) throw new Error(data.error || 'Restart mislukt')

      addLog(`[OK] ${data.message}`)
    } catch (error) {
      addLog(`[ERROR] Restart ${nodeName}: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const checkOllama = async () => {
    const key = 'check-ollama'
    try {
      setBusy(key, true)
      addLog('[WAIT] Ollama status controleren...')

      const response = await fetch('http://0.0.0.0:3001/api/ollama/status')
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Ollama check mislukt')

      addLog(`[OK] Ollama ${data.status} - ${data.modelsCount} modellen`)
      await refreshAll()
    } catch (error) {
      addLog(`[ERROR] Ollama check: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const restartOllama = async () => {
    const key = 'restart-ollama'
    try {
      setBusy(key, true)
      addLog('[WAIT] Ollama restart gestart...')

      const response = await fetch('http://0.0.0.0:3001/api/ollama/restart', {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok || !data.ok) throw new Error(data.error || 'Ollama restart mislukt')

      addLog(`[OK] ${data.message}`)
      await delay(2500)
      await refreshAll()
    } catch (error) {
      addLog(`[ERROR] Ollama restart: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const refreshModels = async () => {
    const key = 'refresh-models'
    try {
      setBusy(key, true)
      addLog('[WAIT] Ollama modellenlijst vernieuwen...')
      await fetchOllamaDashboard(true)
      await fetchClusterStatus(true)
      addLog('[OK] Modellenlijst vernieuwd')
    } catch (error) {
      addLog(`[ERROR] Modellen refresh: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const setDefaultModel = async () => {
    const key = 'set-model'
    try {
      if (!selectedModel) {
        addLog('[ERROR] Geen model geselecteerd')
        return
      }

      setBusy(key, true)
      addLog(`[WAIT] Default model instellen naar ${selectedModel}...`)

      const response = await fetch('http://0.0.0.0:3001/api/ollama/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) throw new Error(data.error || 'Model instellen mislukt')

      setCurrentModel(data.currentModel || selectedModel)
      addLog(`[OK] Default model ingesteld op ${data.currentModel || selectedModel}`)
    } catch (error) {
      addLog(`[ERROR] Model switch: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const restartOpenclawService = async (service) => {
    const key = `restart-openclaw-${service}`
    try {
      setBusy(key, true)
      addLog(`[WAIT] ${service} herstarten op OpenClaw...`)

      const response = await fetch(
        `http://0.0.0.0:3001/api/openclaw/services/${service}/restart`,
        { method: 'POST' }
      )

      const data = await response.json()

      if (!response.ok || !data.ok) throw new Error(data.error || 'Service restart mislukt')

      addLog(`[OK] Service ${service} herstartopening gekomen`)
      await delay(2000)
      await fetchOpenclawDashboard(true)
    } catch (error) {
      addLog(`[ERROR] OpenClaw service restart: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const clusterReset = async () => {
    const key = 'cluster-reset'
    try {
      setBusy(key, true)
      addLog('[WAIT] Cluster reset gestart...')

      const response = await fetch('http://0.0.0.0:3001/api/cluster/reset', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok || !data.ok) throw new Error(data.error || 'Cluster reset mislukt')

      addLog(`[OK] Cluster reset compleet`)
      await delay(2000)
      await refreshAll()
    } catch (error) {
      addLog(`[ERROR] Cluster reset: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const executeOpenclawCommand = async () => {
    if (!openclawCommand.trim()) return

    const key = 'openclaw-command'
    try {
      setBusy(key, true)
      setOpenclawOutput(`▶ ${openclawCommand}\n⏳ Executing...\n`)

      const response = await fetch('http://0.0.0.0:3001/api/openclaw/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: openclawCommand }),
      })

      const data = await response.json()

      if (!response.ok) {
        setOpenclawOutput(`▶ ${openclawCommand}\n❌ Error: ${data.error}\n`)
        return
      }

      const output = data.output || '(no output)'
      setOpenclawOutput(`▶ ${openclawCommand}\n${output}${data.error ? `\nSTDERR: ${data.error}` : ''}`)
    } catch (error) {
      setOpenclawOutput(`▶ ${openclawCommand}\n❌ Connection error: ${error.message}\n`)
    } finally {
      setBusy(key, false)
    }
  }

  const fetchAgents = async (silent = false) => {
    try {
      if (!silent) addLog('[WAIT] Agents ophalen...')
      const res = await fetch('http://0.0.0.0:3001/api/openclaw/agents')
      const data = await res.json()
      if (data.ok) setAgents(data.agents || [])
      if (!silent) addLog('[OK] Agents vernieuwd')
    } catch (error) {
      if (!silent) addLog(`[ERROR] Agents ophalen: ${error.message}`)
    }
  }

  const fetchSkills = async (silent = false) => {
    try {
      if (!silent) addLog('[WAIT] Skills ophalen...')
      const res = await fetch('http://0.0.0.0:3001/api/openclaw/skills')
      const data = await res.json()
      if (data.ok) setSkills(data.skills || [])
      if (!silent) addLog('[OK] Skills vernieuwd')
    } catch (error) {
      if (!silent) addLog(`[ERROR] Skills ophalen: ${error.message}`)
    }
  }

  const createAgent = async () => {
    if (!agentForm.name.trim()) return
    const key = 'create-agent'
    try {
      setBusy(key, true)
      addLog(`[WAIT] Agent aanmaken: ${agentForm.name}...`)
      const res = await fetch('http://0.0.0.0:3001/api/openclaw/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentForm),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Aanmaken mislukt')
      addLog(`[OK] Agent aangemaakt: ${agentForm.name}`)
      setAgentForm({ name: '', description: '', model: '', skills: [] })
      await fetchAgents(true)
    } catch (error) {
      addLog(`[ERROR] Agent aanmaken: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const startAgent = async (id) => {
    const key = `start-agent-${id}`
    try {
      setBusy(key, true)
      const res = await fetch(`http://0.0.0.0:3001/api/openclaw/agents/${id}/start`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Start mislukt')
      addLog(`[OK] ${data.message}`)
      await fetchAgents(true)
    } catch (error) {
      addLog(`[ERROR] Agent starten: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const stopAgent = async (id) => {
    const key = `stop-agent-${id}`
    try {
      setBusy(key, true)
      const res = await fetch(`http://0.0.0.0:3001/api/openclaw/agents/${id}/stop`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Stop mislukt')
      addLog(`[OK] ${data.message}`)
      await fetchAgents(true)
    } catch (error) {
      addLog(`[ERROR] Agent stoppen: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const deleteAgent = async (id) => {
    const key = `delete-agent-${id}`
    try {
      setBusy(key, true)
      const res = await fetch(`http://0.0.0.0:3001/api/openclaw/agents/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Verwijderen mislukt')
      addLog(`[OK] ${data.message}`)
      await fetchAgents(true)
    } catch (error) {
      addLog(`[ERROR] Agent verwijderen: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const viewAgentLogs = async (id) => {
    const key = `logs-agent-${id}`
    try {
      setBusy(key, true)
      const res = await fetch(`http://0.0.0.0:3001/api/openclaw/agents/${id}/logs`)
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Logs ophalen mislukt')
      setAgentLogs((prev) => ({ ...prev, [id]: data.logs }))
    } catch (error) {
      setAgentLogs((prev) => ({ ...prev, [id]: `[ERROR] ${error.message}` }))
    } finally {
      setBusy(key, false)
    }
  }

  const createSkill = async () => {
    if (!skillForm.name.trim()) return
    const key = 'create-skill'
    try {
      setBusy(key, true)
      addLog(`[WAIT] Skill aanmaken: ${skillForm.name}...`)
      const res = await fetch('http://0.0.0.0:3001/api/openclaw/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skillForm),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Aanmaken mislukt')
      addLog(`[OK] Skill aangemaakt: ${skillForm.name}`)
      setSkillForm({ name: '', description: '', type: 'prompt', code: '' })
      await fetchSkills(true)
    } catch (error) {
      addLog(`[ERROR] Skill aanmaken: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const updateSkill = async (id) => {
    const key = `update-skill-${id}`
    try {
      setBusy(key, true)
      addLog(`[WAIT] Skill bijwerken...`)
      const res = await fetch(`http://0.0.0.0:3001/api/openclaw/skills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSkill),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Update mislukt')
      addLog(`[OK] Skill bijgewerkt`)
      setEditingSkill(null)
      await fetchSkills(true)
    } catch (error) {
      addLog(`[ERROR] Skill bijwerken: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const deleteSkill = async (id) => {
    const key = `delete-skill-${id}`
    try {
      setBusy(key, true)
      const res = await fetch(`http://0.0.0.0:3001/api/openclaw/skills/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Verwijderen mislukt')
      addLog(`[OK] ${data.message}`)
      await fetchSkills(true)
      await fetchAgents(true)
    } catch (error) {
      addLog(`[ERROR] Skill verwijderen: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const testSkill = async (id) => {
    const key = `test-skill-${id}`
    try {
      setBusy(key, true)
      addLog(`[WAIT] Skill testen...`)
      const res = await fetch(`http://0.0.0.0:3001/api/openclaw/skills/${id}/test`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Test mislukt')
      addLog(`[OK] Skill test output: ${data.output?.substring(0, 80)}${data.output?.length > 80 ? '...' : ''}`)
      return data.output
    } catch (error) {
      addLog(`[ERROR] Skill test: ${error.message}`)
      return null
    } finally {
      setBusy(key, false)
    }
  }

  const assignSkill = async (agentId, skillId) => {
    if (!skillId) return
    const key = `assign-skill-${agentId}`
    try {
      setBusy(key, true)
      const res = await fetch(`http://0.0.0.0:3001/api/openclaw/agents/${agentId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Toewijzen mislukt')
      addLog(`[OK] ${data.message}`)
      await fetchAgents(true)
    } catch (error) {
      addLog(`[ERROR] Skill toewijzen: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  const removeSkill = async (agentId, skillId) => {
    const key = `remove-skill-${agentId}-${skillId}`
    try {
      setBusy(key, true)
      const res = await fetch(`http://0.0.0.0:3001/api/openclaw/agents/${agentId}/skills/${skillId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Verwijderen mislukt')
      addLog(`[OK] Skill verwijderd van agent`)
      await fetchAgents(true)
    } catch (error) {
      addLog(`[ERROR] Skill verwijderen van agent: ${error.message}`)
    } finally {
      setBusy(key, false)
    }
  }

  useEffect(() => {
    refreshAll()

    const interval = setInterval(() => {
      fetchClusterStatus(true)
      fetchOllamaDashboard(true)
      fetchOpenclawDashboard(true)
      fetchAgents(true)
      fetchSkills(true)
    }, 10000)

    return () => clearInterval(interval)
  }, [])
  const sendPrompt = async () => {
  if (!aiInput) return

  const userMessage = { role: 'user', content: aiInput }
  setAiMessages((prev) => [...prev, userMessage])

  try {
    const response = await fetch('http://0.0.0.0:3001/api/ollama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: aiInput }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Fout')
    }

    const aiMessage = { role: 'model', content: data.response }

    setAiMessages((prev) => [...prev, aiMessage])
    setAiInput('')
  } catch (error) {
    setAiMessages((prev) => [
      ...prev,
      { role: 'error', content: error.message },
    ])
  }
}

  const stateColor = useMemo(() => {
    if (clusterState === 'ACTIVE') return 'text-emerald-400'
    if (clusterState === 'BOOTING' || clusterState === 'RECONNECTING') return 'text-yellow-400'
    if (clusterState === 'DEGRADED') return 'text-orange-400'
    if (clusterState === 'OFFLINE') return 'text-red-400'
    return 'text-zinc-200'
  }, [clusterState])

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <section className="rounded-[2rem] border border-zinc-800 bg-gradient-to-b from-[#050816] to-black p-10 shadow-2xl">
            <p className="mb-6 text-xs uppercase tracking-[0.4em] text-zinc-500">
              Thomas Cluster V3
            </p>

            <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
              Master Cluster Command Center
            </h1>

            <p className="mt-8 max-w-4xl text-xl leading-relaxed text-zinc-400">
              Eén moederdashboard om het hele cluster te wekken, valideren en controleren.
              Victus blijft altijd de primaire AI-node, ook wanneer hij fysiek niet thuis staat.
            </p>

            <div className="mt-10 inline-flex min-w-[170px] flex-col rounded-2xl border border-zinc-700 bg-zinc-900/70 px-5 py-4">
              <span className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                Cluster State
              </span>
              <span className={`mt-2 text-3xl font-semibold ${stateColor}`}>
                {loading ? 'LOADING...' : clusterState}
              </span>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-4">
              <InfoCard
                title="AI Mode"
                body="Victus als primaire AI-node, Ollama gekoppeld, infra basis actief."
                accent
              />
              <InfoCard
                title="Dev Mode"
                body="Cluster klaar voor experimenten, services uitbreidbaar, AI optioneel."
              />
              <InfoCard
                title="Travel Mode"
                body="Victus blijft primary, ook op verplaatsing, via overlay en reconnect logic."
              />

              <div className="flex flex-col gap-4">
                <BigButton onClick={startCluster} variant="green">
                  Start Cluster
                </BigButton>

                <BigButton onClick={reconnectAll}>
                  Reconnect All
                </BigButton>

                <BigButton onClick={refreshAll} variant="cyan">
                  Refresh Status
                </BigButton>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-zinc-800 bg-black p-8 shadow-2xl">
            <div className="mb-8 flex items-start justify-between">
              <h2 className="text-5xl font-semibold">Start Flow</h2>
              <span className="pt-2 text-xs uppercase tracking-[0.35em] text-zinc-500">
                Orchestration
              </span>
            </div>

            <div className="space-y-4">
              {flowSteps.map((step, index) => {
                const isActive = activeStep === index

                return (
                  <button
                    key={step}
                    onClick={() => setActiveStep(index)}
                    className={`flex w-full items-center gap-5 rounded-3xl border px-6 py-6 text-left transition ${
                      isActive
                        ? 'border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-950/20'
                        : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-semibold ${
                        isActive ? 'bg-cyan-500 text-black' : 'bg-zinc-800 text-zinc-200'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="text-2xl text-zinc-100">{step}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard
            title="Nodes"
            value={`${nodesLive}/3 live`}
            dotColor={nodesLive > 0 ? 'bg-emerald-500' : 'bg-red-500'}
          />
          <StatCard
            title="Primary AI"
            value={`Victus ${victusStatus}`}
            dotColor={victusStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}
          />
          <StatCard
            title="Ollama"
            value={ollamaStatus}
            dotColor={ollamaStatus === 'Running' ? 'bg-emerald-500' : 'bg-red-500'}
          />
          <StatCard
            title="Models"
            value={String(modelsCount)}
            dotColor={modelsCount > 0 ? 'bg-cyan-500' : 'bg-zinc-500'}
          />
          <StatCard
            title="OpenClaw"
            value={openclawStatus}
            dotColor={openclawStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}
          />
          <StatCard title="Mode" value={mode} dotColor="bg-yellow-500" />
          <StatCard title="Cluster" value={clusterState} dotColor="bg-violet-500" />
        </section>

        <section className="mt-8 rounded-[2rem] border border-zinc-800 bg-black p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-2xl font-semibold">Cluster Nodes</h3>

            <div className="flex flex-wrap gap-3">
              <ActionButton
                label="Check Ollama"
                onClick={checkOllama}
                busy={commandBusy['check-ollama']}
              />
              <ActionButton
                label="Restart Ollama"
                onClick={restartOllama}
                busy={commandBusy['restart-ollama']}
                variant="danger"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {nodes.map((node) => (
              <div
                key={node.name}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold">{node.name}</div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        node.status === 'online'
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-red-500'
                      }`}
                    />
                    <span className="text-sm text-zinc-300">{node.status}</span>
                  </div>
                </div>

                <div className="text-sm text-zinc-400">{node.role}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {node.ip}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <ActionButton
                    label="Ping"
                    onClick={() => pingNode(node.name)}
                    busy={commandBusy[`ping-${node.name}`]}
                  />
                  <ActionButton
                    label="Restart"
                    onClick={() => restartNode(node.name)}
                    busy={commandBusy[`restart-${node.name}`]}
                    variant="danger"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>



<section className="mt-8 rounded-[2rem] border border-zinc-800 bg-black p-6">
  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold">Ollama Dashboard v1</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Beheer lokale modellen zonder config-bestanden open te trekken.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionButton
                label="Refresh Models"
                onClick={refreshModels}
                busy={commandBusy['refresh-models']}
              />
              <ActionButton
                label="Restart Ollama"
                onClick={restartOllama}
                busy={commandBusy['restart-ollama']}
                variant="danger"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <PanelCard title="Ollama Status" value={ollamaStatus} />
            <PanelCard title="Local Models" value={String(ollamaModels.length)} />
            <PanelCard title="Current Model" value={currentModel || 'geen'} />
            <PanelCard title="Selected Model" value={selectedModel || 'geen'} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <h4 className="mb-4 text-lg font-semibold">Beschikbare modellen</h4>

              <div className="max-h-72 overflow-auto rounded-xl border border-zinc-800 bg-black p-3">
                {ollamaModels.length === 0 ? (
                  <div className="text-sm text-zinc-500">Geen modellen gevonden.</div>
                ) : (
                  <div className="space-y-2">
                    {ollamaModels.map((model) => (
                      <button
                        key={model}
                        onClick={() => setSelectedModel(model)}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          selectedModel === model
                            ? 'border-cyan-500 bg-cyan-950/20'
                            : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900'
                        }`}
                      >
                        <span className="font-medium">{model}</span>
                        {currentModel === model && (
                          <span className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                            active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <h4 className="mb-4 text-lg font-semibold">Model Control</h4>

              <label className="mb-2 block text-sm text-zinc-400">Default model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white outline-none transition focus:border-cyan-500"
              >
                <option value="">Selecteer model</option>
                {ollamaModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>

              <div className="mt-4 grid gap-3">
                <ActionButton
                  label="Set Default Model"
                  onClick={setDefaultModel}
                  busy={commandBusy['set-model']}
                />
                <ActionButton
                  label="Check Ollama"
                  onClick={checkOllama}
                  busy={commandBusy['check-ollama']}
                />
              </div>

              <div className="mt-6 rounded-xl border border-zinc-800 bg-black p-4 text-sm text-zinc-400">
                <div className="mb-2">
                  <span className="text-zinc-500">Huidig actief:</span>{' '}
                  <span className="text-white">{currentModel || 'geen'}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Geselecteerd:</span>{' '}
                  <span className="text-white">{selectedModel || 'geen'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <AccordionSection name="openclaw" title="OpenClaw Gateway v1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold">OpenClaw Gateway v1</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Monitor en beheer Ubuntu/OpenClaw gateway node.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionButton
                label="Refresh Status"
                onClick={() => {
                  setBusy('refresh-openclaw', true)
                  fetchOpenclawDashboard(false).then(() => setBusy('refresh-openclaw', false))
                }}
                busy={commandBusy['refresh-openclaw']}
              />
              <ActionButton
                label="Cluster Reset"
                onClick={clusterReset}
                busy={commandBusy['cluster-reset']}
                variant="danger"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <PanelCard
              title="OpenClaw Status"
              value={openclawStatus === 'online' ? '🟢 Online' : '🔴 Offline'}
            />
            <PanelCard title="CPU Cores" value={openclawInfo.cpu_cores} />
            <PanelCard title="Memory" value={openclawInfo.memory} />
            <PanelCard title="Disk" value={openclawInfo.disk || '-'} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <h4 className="mb-4 text-lg font-semibold">Services</h4>

              <div className="space-y-2">
                {['ollama', 'docker', 'nginx'].map((service) => (
                  <div
                    key={service}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse"></div>
                      <span className="font-medium capitalize">{service}</span>
                    </div>
                    <ActionButton
                      label="Restart"
                      onClick={() => restartOpenclawService(service)}
                      busy={commandBusy[`restart-openclaw-${service}`]}
                      variant="danger"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <h4 className="mb-4 text-lg font-semibold">Quick Commands</h4>

              <div className="space-y-3">
                <input
                  value={openclawCommand}
                  onChange={(e) => setOpenclawCommand(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && executeOpenclawCommand()}
                  placeholder="Typ command (ls, pwd, uptime, etc)"
                  className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-500"
                />

                <ActionButton
                  label={commandBusy['openclaw-command'] ? 'Executing...' : 'Execute'}
                  onClick={executeOpenclawCommand}
                  busy={commandBusy['openclaw-command']}
                />

                {openclawOutput && (
                  <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-zinc-800 bg-black p-3 font-mono text-xs text-cyan-400">
                    {openclawOutput}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h4 className="mb-4 text-lg font-semibold">Ollama Models</h4>
            <div className="rounded-xl border border-zinc-800 bg-black p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Status:</span>
                <span className={`text-sm font-medium ${openclawOllama.status === 'Running' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {openclawOllama.status === 'Running' ? '🟢 Running' : '🔴 Offline'}
                </span>
              </div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Models:</span>
                <span className="text-sm font-medium text-white">{openclawOllama.modelsCount}</span>
              </div>
              {openclawOllama.models.length > 0 ? (
                <div className="max-h-40 space-y-1 overflow-auto">
                  {openclawOllama.models.map((model) => (
                    <div key={model.name} className="rounded px-3 py-2 bg-zinc-900 text-xs text-cyan-300 font-mono">
                      {model.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-500">Geen modellen beschikbaar</div>
              )}
            </div>
          </div>
        </AccordionSection>

        <AccordionSection name="agents" title="OpenClaw Agents">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold">OpenClaw Agents</h3>
              <p className="mt-1 text-sm text-zinc-400">Beheer en monitor AI agents op de OpenClaw node.</p>
            </div>
            <ActionButton
              label="Vernieuwen"
              onClick={() => fetchAgents(false)}
              busy={commandBusy['fetch-agents']}
            />
          </div>

          {/* Agent aanmaken formulier */}
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h4 className="mb-4 text-lg font-semibold">Nieuwe Agent</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              <input
                value={agentForm.name}
                onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Naam"
                className="rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-500"
              />
              <input
                value={agentForm.description}
                onChange={(e) => setAgentForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Beschrijving"
                className="rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-500"
              />
              <select
                value={agentForm.model}
                onChange={(e) => setAgentForm((f) => ({ ...f, model: e.target.value }))}
                className="rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="">Selecteer model</option>
                {[...new Set([...openclawOllama.modelNames, ...ollamaModels])].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ActionButton
                label={commandBusy['create-agent'] ? 'Aanmaken...' : 'Agent Aanmaken'}
                onClick={createAgent}
                busy={commandBusy['create-agent']}
              />
            </div>
          </div>

          {/* Agent lijst */}
          {agents.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-500">
              Geen agents aangemaakt.
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${agent.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                        <span className="font-semibold text-white">{agent.name}</span>
                        <span className={`text-xs uppercase tracking-wide ${agent.status === 'running' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {agent.status}
                        </span>
                      </div>
                      {agent.description && (
                        <p className="mt-1 text-sm text-zinc-400">{agent.description}</p>
                      )}
                      {agent.model && (
                        <p className="mt-1 text-xs text-zinc-500">Model: {agent.model}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        label="Start"
                        onClick={() => startAgent(agent.id)}
                        busy={commandBusy[`start-agent-${agent.id}`]}
                      />
                      <ActionButton
                        label="Stop"
                        onClick={() => stopAgent(agent.id)}
                        busy={commandBusy[`stop-agent-${agent.id}`]}
                        variant="danger"
                      />
                      <ActionButton
                        label={commandBusy[`logs-agent-${agent.id}`] ? 'Laden...' : 'Logs'}
                        onClick={() => viewAgentLogs(agent.id)}
                        busy={commandBusy[`logs-agent-${agent.id}`]}
                      />
                      <ActionButton
                        label="Verwijder"
                        onClick={() => deleteAgent(agent.id)}
                        busy={commandBusy[`delete-agent-${agent.id}`]}
                        variant="danger"
                      />
                    </div>
                  </div>

                  {/* Skill toewijzing */}
                  <div className="mb-3">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {agent.skills.length === 0 ? (
                        <span className="text-xs text-zinc-600">Geen skills toegewezen</span>
                      ) : (
                        agent.skills.map((sid) => {
                          const sk = skills.find((s) => s.id === sid)
                          return sk ? (
                            <span key={sid} className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-black px-2 py-1 text-xs text-white">
                              {sk.name}
                              <button
                                onClick={() => removeSkill(agent.id, sid)}
                                className="ml-1 text-red-400 hover:text-red-300"
                              >
                                ×
                              </button>
                            </span>
                          ) : null
                        })
                      )}
                    </div>
                    <div className="flex gap-2">
                      <AgentSkillSelect
                        agentId={agent.id}
                        agentSkills={agent.skills}
                        allSkills={skills}
                        onAssign={assignSkill}
                      />
                    </div>
                  </div>

                  {/* Logs weergave */}
                  {agentLogs[agent.id] && (
                    <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-zinc-800 bg-black p-3 font-mono text-xs text-cyan-400">
                      {agentLogs[agent.id]}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </AccordionSection>

        <AccordionSection name="skills" title="OpenClaw Skills">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold">OpenClaw Skills</h3>
              <p className="mt-1 text-sm text-zinc-400">Ontwikkel en beheer skills voor OpenClaw agents.</p>
            </div>
            <ActionButton
              label="Vernieuwen"
              onClick={() => fetchSkills(false)}
              busy={commandBusy['fetch-skills']}
            />
          </div>

          {/* Skill aanmaken / bewerken formulier */}
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h4 className="mb-4 text-lg font-semibold">
              {editingSkill ? 'Skill Bewerken' : 'Nieuwe Skill'}
            </h4>
            <div className="grid gap-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <input
                  value={editingSkill ? editingSkill.name : skillForm.name}
                  onChange={(e) =>
                    editingSkill
                      ? setEditingSkill((s) => ({ ...s, name: e.target.value }))
                      : setSkillForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Naam"
                  className="rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-500"
                />
                <input
                  value={editingSkill ? editingSkill.description : skillForm.description}
                  onChange={(e) =>
                    editingSkill
                      ? setEditingSkill((s) => ({ ...s, description: e.target.value }))
                      : setSkillForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Beschrijving"
                  className="rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-500"
                />
              </div>
              <select
                value={editingSkill ? editingSkill.type : skillForm.type}
                onChange={(e) =>
                  editingSkill
                    ? setEditingSkill((s) => ({ ...s, type: e.target.value }))
                    : setSkillForm((f) => ({ ...f, type: e.target.value }))
                }
                className="rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="prompt">prompt</option>
                <option value="script">script</option>
                <option value="api-call">api-call</option>
              </select>
              <textarea
                value={editingSkill ? editingSkill.code : skillForm.code}
                onChange={(e) =>
                  editingSkill
                    ? setEditingSkill((s) => ({ ...s, code: e.target.value }))
                    : setSkillForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="Code / prompt / URL..."
                rows={4}
                className="rounded-xl border border-zinc-700 bg-black px-4 py-2 font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-500"
              />
              <div className="flex gap-3">
                {editingSkill ? (
                  <>
                    <ActionButton
                      label={commandBusy[`update-skill-${editingSkill.id}`] ? 'Opslaan...' : 'Opslaan'}
                      onClick={() => updateSkill(editingSkill.id)}
                      busy={commandBusy[`update-skill-${editingSkill.id}`]}
                    />
                    <ActionButton
                      label="Annuleren"
                      onClick={() => setEditingSkill(null)}
                    />
                  </>
                ) : (
                  <ActionButton
                    label={commandBusy['create-skill'] ? 'Aanmaken...' : 'Skill Aanmaken'}
                    onClick={createSkill}
                    busy={commandBusy['create-skill']}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Skill lijst */}
          {skills.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-500">
              Geen skills aangemaakt.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  busy={commandBusy}
                  onEdit={() => setEditingSkill({ ...skill })}
                  onDelete={() => deleteSkill(skill.id)}
                  onTest={testSkill}
                />
              ))}
            </div>
          )}
        </AccordionSection>

        <AccordionSection name="ai" title="AI Console">
        <h3 className="text-2xl font-semibold mb-4">AI Console</h3>

      <div className="rounded-xl border border-zinc-800 bg-black p-4 h-[300px] overflow-auto mb-4">
        {aiMessages.map((msg, i) => (
      <div key={i} className="mb-3">
      <div className="text-xs text-zinc-500">{msg.role}</div>
      <div className="text-white whitespace-pre-wrap">{msg.content}</div>
      </div>
    ))}
  </div>

  <div className="flex gap-3">
    <input
      value={aiInput}
      onChange={(e) => setAiInput(e.target.value)}
      placeholder="Typ je prompt..."
      className="flex-1 rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white"
    />

    <button
      onClick={sendPrompt}
      className="rounded-xl border border-cyan-500 px-4 py-3"
    >
      Send
    </button>
  </div>
</AccordionSection>
        <AccordionSection name="terminal" title="Dual Terminal v1">
        <section className="mt-8 rounded-[2rem] border border-zinc-800 bg-black p-1">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold">Dual Terminal v1</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Links PowerShell, rechts Linux via SSH.
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <TerminalPane title="PowerShell" wsType="powershell" />
            <TerminalPane title="Linux SSH" wsType="linux" />
          </div>
        </section>
        </AccordionSection>

        <AccordionSection name="logs" title="Live System Logs">
        <section className="mt-8 rounded-[2rem] border border-zinc-800 bg-zinc-950/80 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-semibold">Live System Logs</h3>
            <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Monitor
            </span>
          </div>

          <div className="max-h-72 space-y-2 overflow-auto rounded-2xl border border-zinc-800 bg-black p-4 font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index} className="text-zinc-300">
                {colorizeLog(log)}
              </div>
            ))}
          </div>
        </section>
        </AccordionSection>
      </div>
    </div>
  )
}

function AgentSkillSelect({ agentId, agentSkills, allSkills, onAssign }) {
  const [selected, setSelected] = useState('')

  const available = allSkills.filter((s) => !agentSkills.includes(s.id))

  const handleChange = (e) => {
    const skillId = e.target.value
    if (skillId) {
      onAssign(agentId, skillId)
      setSelected('')
    }
  }

  return (
    <select
      value={selected}
      onChange={handleChange}
      className="flex-1 rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
    >
      <option value="">Skill toevoegen...</option>
      {available.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  )
}

function SkillCard({ skill, busy, onEdit, onDelete, onTest }) {
  const [testOutput, setTestOutput] = useState(null)
  const [testing, setTesting] = useState(false)

  const typeBadge = {
    prompt: 'border-cyan-700 bg-cyan-950/30 text-cyan-400',
    script: 'border-violet-700 bg-violet-950/30 text-violet-400',
    'api-call': 'border-amber-700 bg-amber-950/30 text-amber-400',
  }[skill.type] || 'border-zinc-700 bg-zinc-900 text-zinc-400'

  const handleTest = async () => {
    setTesting(true)
    const output = await onTest(skill.id)
    setTestOutput(output)
    setTesting(false)
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{skill.name}</span>
            <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${typeBadge}`}>
              {skill.type}
            </span>
          </div>
          {skill.description && (
            <p className="mt-1 text-sm text-zinc-400">{skill.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <ActionButton label="Bewerk" onClick={onEdit} />
          <ActionButton
            label={testing ? 'Testen...' : 'Test'}
            onClick={handleTest}
            busy={testing}
          />
          <ActionButton
            label="Verwijder"
            onClick={onDelete}
            busy={busy[`delete-skill-${skill.id}`]}
            variant="danger"
          />
        </div>
      </div>
      {skill.code && (
        <pre className="max-h-24 overflow-auto rounded-xl border border-zinc-800 bg-black p-3 font-mono text-xs text-zinc-400">
          {skill.code}
        </pre>
      )}
      {testOutput && (
        <div className="mt-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Test output</div>
          <pre className="max-h-40 overflow-auto rounded-xl border border-zinc-800 bg-black p-3 font-mono text-xs text-emerald-400">
            {testOutput}
          </pre>
        </div>
      )}
    </div>
  )
}

function TerminalPane({ title, wsType }) {
  const hostRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!hostRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 18,
      fontFamily: 'Consolas, Menlo, Monaco, monospace',
      theme: {
        background: '#000000',
        foreground: 'rgb(21, 238, 75)',
      },
      scrollback: 3000,
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
    const ws = new WebSocket(`${protocol}://0.0.0.0:3001/ws/terminal?type=${wsType}`)

    ws.onopen = () => {
      term.writeln(`\x1b[32m[connected]\x1b[0m ${title}`)
      ws.send(
        JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        })
      )
    }

    ws.onmessage = (event) => {
      try {
        const data = event.data
        if (typeof data === 'string' && data.startsWith('{')) {
          const parsed = JSON.parse(data)
          if (parsed.type === 'output') {
            term.write(parsed.data)
          } else {
            term.write(data)
          }
        } else {
          term.write(data)
        }
      } catch {
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      term.writeln('\r\n\x1b[31m[disconnected]\x1b[0m')
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m[error]\x1b[0m websocket fout')
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
          ws.send(
            JSON.stringify({
              type: 'resize',
              cols: term.cols,
              rows: term.rows,
            })
          )
        }
      } catch {}
    }

    window.addEventListener('resize', handleResize)

    termRef.current = term
    fitRef.current = fitAddon
    wsRef.current = ws

    setTimeout(handleResize, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      try {
        ws.close()
      } catch {}
      try {
        term.dispose()
      } catch {}
    }
  }, [title, wsType])

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{wsType}</div>
      </div>
      <div
        ref={hostRef}
        className="h-[420px] rounded-xl border border-zinc-800 bg-black p-2"
      />
    </div>
  )
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function InfoCard({ title, body, accent = false }) {
  return (
    <div
      className={`rounded-3xl p-5 ${
        accent
          ? 'border border-cyan-700/60 bg-cyan-950/30 shadow-lg shadow-cyan-950/20'
          : 'border border-zinc-800 bg-zinc-950/80'
      }`}
    >
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-lg leading-relaxed text-zinc-300">{body}</p>
    </div>
  )
}

function BigButton({ children, onClick, variant = 'default' }) {
  const styles =
    variant === 'green'
      ? 'bg-emerald-500 text-black hover:scale-[1.02] hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30'
      : variant === 'cyan'
      ? 'border border-cyan-700 bg-cyan-950/20 text-white hover:border-cyan-500 hover:bg-cyan-950/30'
      : 'border border-zinc-700 bg-zinc-950 text-white hover:border-zinc-500 hover:bg-zinc-900'

  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-6 py-5 text-xl font-semibold transition ${styles}`}
    >
      {children}
    </button>
  )
}

function StatCard({ title, value, dotColor }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-black p-5">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500">{title}</div>
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full animate-pulse ${dotColor}`} />
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
    </div>
  )
}

function PanelCard({ title, value }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-500">{title}</div>
      <div className="break-all text-xl font-semibold text-white">{value}</div>
    </div>
  )
}

function ActionButton({ label, onClick, busy, variant = 'default' }) {
  const styles =
    variant === 'danger'
      ? 'border-red-800 bg-red-950/20 hover:border-red-600 hover:bg-red-950/30'
      : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800'

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${styles} ${
        busy ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      {busy ? 'Bezig...' : label}
    </button>
  )
}

function colorizeLog(log) {
  if (log.includes('[OK]')) return <span className="text-emerald-400">{log}</span>
  if (log.includes('[ERROR]')) return <span className="text-red-400">{log}</span>
  if (log.includes('[WAIT]') || log.includes('[STEP')) return <span className="text-yellow-400">{log}</span>
  if (log.includes('[START]') || log.includes('[BOOT]') || log.includes('[RELINK]')) {
    return <span className="text-cyan-400">{log}</span>
  }
  return <span>{log}</span>
}
