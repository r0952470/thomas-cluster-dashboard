# ⚡ Thomas Cluster Dashboard

> Local AI Cluster Command Center for managing Ollama, OpenClaw, and multi-node infrastructure.

---

## 🧠 Overview

Thomas Cluster Dashboard is a **local control panel** designed to monitor, manage, and interact with multiple systems:

- 🖥️ AI Node (Ollama - HP Victus)
- 🧩 Gateway Node (Lucifershell - OpenClaw)
- 🐉 Kali Node (Pentest / Terminal)
- 🧱 Proxmox (Virtualization Layer)

This is not just a dashboard — it's a **mission control interface** for your personal infrastructure.

---

## 🔥 Features

- 📡 Cluster status monitoring
- 🤖 Ollama model management (local AI)
- 🧠 AI console (chat with models)
- 🖥️ Multi-node visibility
- 🐉 Kali Linux terminal integration
- 🔌 OpenClaw gateway control
- 📊 Real-time system interaction
- ⚡ Command execution via terminal

---

## 🏗️ Architecture

Frontend (React + Vite)
↓
Backend (Node.js / Express)
↓
Nodes:

Victus (AI / Ollama)
Lucifershell (Gateway / OpenClaw)
Kali (Terminal / Ops)
Proxmox (Infra)

---

## 🚀 Getting Started

### 1. Clone repository

```bash
git clone https://github.com/r0952470/thomas-cluster-dashboard.git
cd thomas-cluster-dashboard
2. Install dependencies
npm install
cd backend
npm install
cd ..
3. Start application
npm run start

Of apart:

npm run dev
npm run dev:backend
4. Open dashboard
http://localhost:5173
⚙️ Configuration

Maak een .env file in root:

VITE_API_BASE_URL=http://localhost:3001

Backend (optioneel):

LINUX_SSH_HOST=192.168.0.161
OPENCLAW_HOST=127.0.0.1
🐉 Kali Integration

Run commands rechtstreeks vanuit dashboard:

Network scanning (nmap)
Web scanning (nikto, gobuster)
Exploitation tools
Custom scripts
⚠️ Notes
Dit project is bedoeld voor lokaal gebruik
Zet je backend niet open naar internet zonder beveiliging
Vereist een werkende Ollama instance op poort 11434
🔐 Security Reminder
Nooit API keys in frontend zetten
Gebruik .env voor secrets
Ollama draait lokaal (geen API key nodig)
👤 Author

Thomas Huybrechts
Builder of local AI infrastructure and custom control systems.

⚡ Philosophy

"Control your tools. Control your data. Control your system."


---

```
