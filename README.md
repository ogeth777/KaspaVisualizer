# Kaspa BlockDAG Visualizer

![Kaspa Visualizer](https://kaspa.org/wp-content/uploads/2023/04/Kaspa-Logo-Green.png)

A real-time, interactive 3D visualization of the Kaspa BlockDAG network. Created for the **Build at Internet Speed Hackathon 2026**.

## 🚀 Features

*   **Live Simulation**: Visualizes block creation in real-time (approx. 1-10 BPS).
*   **Real Network Sync**: Fetches the current block height from Kaspa Mainnet (`api.kaspa.org`) to initialize the simulation.
*   **3D Interactive Graph**:
    *   **Manual Control**: Full orbit, pan, and zoom controls.
    *   **Block Details**: Click on any block to inspect its Hash, Parents, Difficulty, and Timestamp.
*   **Audio Feedback**: Generative sound effects for block events (New Block, Gold Block, Red Block).
*   **High Performance**: Optimized with React Three Fiber, Instanced Mesh concepts, and efficient post-processing (Bloom, Vignette).

## 🛠 Tech Stack

*   **Framework**: React + TypeScript + Vite
*   **3D Engine**: Three.js + React Three Fiber (@react-three/fiber)
*   **Helpers**: @react-three/drei
*   **Effects**: @react-three/postprocessing
*   **Data**: Kaspa REST API

## 🏃‍♂️ How to Run (Development)

1.  Clone the repository
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open `http://localhost:5173` in your browser.

## 🎮 Controls

*   **Left Click + Drag**: Rotate Camera
*   **Right Click + Drag**: Pan Camera
*   **Scroll**: Zoom In/Out
*   **Click Block**: Select block to view details
*   **Click Background**: Deselect block

## 🏆 Hackathon Details

This project demonstrates the speed and structure of the Kaspa BlockDAG. Unlike traditional blockchains, Kaspa's DAG structure allows for parallel block creation, which is visualized here by the multiple parents and branching structure.

---

# 📦 Developer & Submission Guide

*(This section is for the project maintainer to prepare the hackathon submission)*

## 1. Deployment (Vercel)

1.  Push code to GitHub.
2.  Import project into [Vercel](https://vercel.com).
3.  Settings:
    *   **Framework**: Vite
    *   **Command**: `npm run build`
    *   **Output**: `dist`
4.  Get your production URL (e.g., `https://kaspa-visualizer.vercel.app`).

## 2. Demo Video Script (1-2 mins)

1.  **Intro (10s)**: Start on the "INITIALIZE SIMULATION" screen. Click to start. Hear the sound.
2.  **Concept (20s)**: "This connects to Kaspa Mainnet in real-time."
3.  **Features (20s)**: Show manual rotation, zoom, and clicking a block to see the Inspector panel.
4.  **Tech (10s)**: Mention React Three Fiber & Instanced Mesh.

## 3. DoraHacks Submission Fields

*   **Project Name**: `Kaspa Visualizer - Live BlockDAG Simulation`
*   **Description**:
    > A cinematic, real-time 3D visualization of the Kaspa BlockDAG network. It connects to the Kaspa Mainnet to synchronize block height and simulates the parallel creation of blocks using a high-performance WebGL engine. Features interactive inspection, audio feedback, and manual camera control.
*   **Tags**: BlockDAG, Real-time, Visualization, React Three Fiber, Kaspa.

---

*Built with ❤️ for the Kaspa Community.*
