
# ⚡ Thomas Cluster Dashboard

A modular local control center for managing AI, servers, and infrastructure — from a single interface.

---

## 🧠 What is this?

Thomas Cluster Dashboard is a **local-first control panel** that allows you to:

- manage AI models (Ollama)
- control local and remote systems
- run commands across nodes
- monitor infrastructure in real-time

It scales from:

👉 a single computer  
👉 to a full multi-node cluster  

---

## ⚙️ Modular Design

This system is built as a **modular platform**.

You can start simple and expand over time.

👉 No module is required to run the dashboard.

---

## 🧩 Available Modules

### 🤖 AI (Ollama)
- Local LLM execution
- Model switching
- Chat / console interface

---

### 🐳 Docker
- Monitor containers
- Start / stop services
- Manage local infrastructure

---

### 🔄 n8n
- Workflow automation control
- Trigger and monitor flows
- AI pipeline integration

---

### 🎨 ComfyUI
- Image generation interface
- Stable Diffusion workflows
- Visual AI pipelines

---

### 🐧 Linux / SSH
- Execute remote commands
- Run scripts
- Monitor systems

---

### 🧠 OpenClaw (optional)
- Agent orchestration
- Multi-node routing
- Gateway control

---

### 🖥️ Proxmox (optional)
- VM overview
- Infrastructure monitoring
- Virtualization layer control

---

👉 Modules activate only if configured.

---

## 🧠 About the Project

This dashboard was originally built around a **personal multi-node setup**, including:

- AI node (Ollama)
- Linux gateway (OpenClaw)
- Kali Linux environment
- Proxmox infrastructure

However:

👉 You do NOT need this setup.

The system is designed to be:

- flexible  
- adaptable  
- expandable  

---

## 🚀 Quick Start (Basic Setup)

Minimum requirements:

- Node.js
- 1 computer

### 1. Clone

```bash
git clone https://github.com/r0952470/thomas-cluster-dashboard.git
cd thomas-cluster-dashboard
2. Install
npm install
cd backend
npm install
cd ..
3. Run
npm run dev
4. Open
http://localhost:5173
⚙️ Optional Setup
Install Ollama (AI)

https://ollama.com

Run a model:

ollama run llama3
🧱 Architecture
Frontend (React + Vite)
        ↓
Backend (Node.js / Express)
        ↓
Nodes (dynamic)
🧪 Example Setup (Author)

One possible configuration:

Victus (AI / Ollama)
Lucifershell (OpenClaw Gateway)
Kali Linux (Operations)
Proxmox (Virtualization)

👉 This is NOT required — just an example.

🔐 Security
Do not expose backend to the internet without protection
Store secrets in .env
Never expose API keys in frontend
Ollama runs locally (no API key required)
🧑‍💻 Author

Thomas Huybrechts

⚡ Philosophy

Control your tools. Control your data. Control your system.


---

# 💥 Wat ik gefixt heb (belangrijk)

👉 dubbele stukken verwijderd  
👉 structuur logisch gemaakt  
👉 jouw setup → **voorbeeld gemaakt i.p.v. verplichting**  
👉 modules duidelijk gemaakt  
👉 beginner → kan starten  
👉 advanced user → ziet potentieel  

---

# 🧠 Eerlijk oordeel

Nu is je README:

👉 van “rommel doc”  
naar  
👉 **legit project dat iemand wil clonen**

---

# 🚀 Volgende stap (aanrader)

Als je dit echt wil levelen:

- screenshots toevoegen  
- korte GIF (das
