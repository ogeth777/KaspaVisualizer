import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line, Text, Float, Sparkles } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { useRef, useState, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import './App.css'

// --- CONSTANTS & TYPES ---
const KASPA_CYAN = '#48Cca8'
const BLOCK_SPEED = 1 // blocks per second in simulation
const MAX_BLOCKS = 100

interface BlockData {
  id: number
  position: [number, number, number]
  parents: number[]
  color: string
  createdAt: number
  hash: string
  difficulty: number
}

// --- SOUND UTILS ---
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
const playBlockSound = (type: 'normal' | 'gold' | 'red') => {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  
  const now = audioCtx.currentTime
  
  if (type === 'gold') {
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1)
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc.start(now)
    osc.stop(now + 0.3)
  } else if (type === 'red') {
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(110, now)
    osc.frequency.linearRampToValueAtTime(55, now + 0.2)
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    osc.start(now)
    osc.stop(now + 0.2)
  } else {
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440 + Math.random() * 100, now)
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
    osc.start(now)
    osc.stop(now + 0.1)
  }
}

// --- COMPONENTS ---

// --- SHARED GEOMETRY ---
const boxGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8)

function Block({ data, allBlocks, isNew, onSelect, isSelected }: { data: BlockData, allBlocks: BlockData[], isNew: boolean, onSelect: (b: BlockData) => void, isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHover] = useState(false)
  
  // Animation for new blocks
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    
    // Floating effect - Simplified math
    if (meshRef.current) {
        meshRef.current.position.y = data.position[1] + Math.sin(t * 2 + data.id) * 0.1
        
        // Scale up animation on spawn
        if (isNew && meshRef.current.scale.x < 1) {
           meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1)
        }
        
        // Pulse if selected
        if (isSelected) {
           meshRef.current.scale.setScalar(1 + Math.sin(t * 10) * 0.1)
        } else if (!isNew) {
           meshRef.current.scale.setScalar(1)
        }
    }
  })

  return (
    <group>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh
          ref={meshRef}
          position={data.position}
          scale={isNew ? 0.1 : 1} // Start small if new
          geometry={boxGeometry}
          onClick={(e) => { e.stopPropagation(); onSelect(data) }}
          onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
          <meshStandardMaterial 
            color={isSelected ? '#ffffff' : (hovered ? '#b2ebf2' : data.color)} 
            emissive={isSelected ? '#ffffff' : data.color}
            emissiveIntensity={isSelected ? 2 : (hovered ? 1.5 : 0.8)}
            toneMapped={false}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      </Float>
      
      {/* Edges (Parents) - Only render if parent exists */}
      {data.parents.map(parentId => {
        const parent = allBlocks.find(b => b.id === parentId)
        if (!parent) return null
        return (
          <Line
            key={`${data.id}-${parentId}`}
            points={[data.position, parent.position]}
            color={data.color}
            opacity={isSelected ? 0.8 : 0.2}
            transparent
            lineWidth={isSelected ? 2 : 1} 
          />
        )
      })}
    </group>
  )
}

function CameraController({ targetZ }: { targetZ: number }) {
  const { camera, controls } = useThree()

  useFrame((state, delta) => {
    // Smoothly move camera to follow the growth
    const targetPos = new THREE.Vector3(5, 5, targetZ + 15) // Keep offset
    
    // We only update if controls are available (OrbitControls)
    const controlsRef = state.controls as any
    if (controlsRef) {
       // Look slightly behind the newest block
       const lookAtTarget = new THREE.Vector3(0, 0, targetZ)
       controlsRef.target.lerp(lookAtTarget, delta * 1)
       
       // Move camera along
       camera.position.lerp(targetPos, delta * 0.5)
       controlsRef.update()
    }
  })
  return null
}

function Scene({ statsRefs, onBlockSelect, selectedBlockId, isRunning }: { statsRefs: any, onBlockSelect: (b: BlockData) => void, selectedBlockId: number | null, isRunning: boolean }) {
  const [blocks, setBlocks] = useState<BlockData[]>([])
  const lastIdRef = useRef(0)
  const lastTimeRef = useRef(Date.now())
  const hasStartedRef = useRef(false)

  // Fetch initial block count
  useEffect(() => {
    fetch('https://api.kaspa.org/info/blockdag')
      .then(res => res.json())
      .then(data => {
        if (data && data.blockCount) {
           statsRefs.current.baseHeight = parseInt(data.blockCount)
           hasStartedRef.current = true
        }
      })
      .catch(e => {
        console.error("Failed to fetch Kaspa stats", e)
        statsRefs.current.baseHeight = 100000000 // Fallback
        hasStartedRef.current = true
      })
  }, [])

  // --- SIMULATION LOOP ---
  useFrame((state) => {
    if (!hasStartedRef.current || !isRunning) return

    const now = Date.now()
    // Add block every ~300ms (approx 3 BPS for visual pleasure)
    if (now - lastTimeRef.current > 300) {
      lastTimeRef.current = now
      
      const newId = lastIdRef.current + 1
      lastIdRef.current = newId
      
      // Procedural position
      const z = newId * 1.5 
      const x = (Math.random() - 0.5) * 8
      const y = (Math.random() - 0.5) * 4

      // Find parents (closest recent blocks)
      const parents: number[] = []
      const potentialParents = blocks.slice(-8) // Look at last 8 blocks
      potentialParents.forEach(b => {
        if (Math.random() > 0.6) parents.push(b.id) // Randomly link
      })
      if (parents.length === 0 && blocks.length > 0) {
        parents.push(blocks[blocks.length - 1].id) // Ensure at least one parent
      }

      // Color logic
      const rnd = Math.random()
      let color = KASPA_CYAN
      let type: 'normal' | 'gold' | 'red' = 'normal'
      if (rnd > 0.95) { color = '#FFD700'; type = 'gold' } // Gold (Super block)
      else if (rnd > 0.90) { color = '#FF4081'; type = 'red' } // Red (Conflict)

      // Play sound
      playBlockSound(type)

      const newBlock: BlockData = {
        id: newId,
        position: [x, y, z],
        parents,
        color,
        createdAt: now,
        hash: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        difficulty: Math.floor(Math.random() * 1000) + 1000
      }

      setBlocks(prev => {
        const updated = [...prev, newBlock]
        if (updated.length > 75) updated.shift() // Limit to 75 blocks for performance
        return updated
      })
      
      // Update UI stats directly via DOM refs to avoid re-renders
      const currentBps = (1000 / (now - (lastTimeRef.current - 300))) * 1
      if (statsRefs.current.bps) statsRefs.current.bps.innerText = currentBps.toFixed(1) + ' BPS'
      if (statsRefs.current.count) {
        const realHeight = (statsRefs.current.baseHeight || 0) + newId
        statsRefs.current.count.innerText = realHeight.toLocaleString()
      }
    }
  })

  // Initial seed
  useEffect(() => {
    // Start with one block
    setBlocks([{ 
        id: 0, 
        position: [0,0,0], 
        parents: [], 
        color: KASPA_CYAN, 
        createdAt: Date.now(),
        hash: 'genesis',
        difficulty: 1
    }])
  }, [])

  const newestZ = blocks.length > 0 ? blocks[blocks.length - 1].position[2] : 0

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, newestZ]} intensity={2} color="#ffffff" distance={30} />
      <pointLight position={[-10, -5, newestZ - 10]} intensity={1} color={KASPA_CYAN} distance={30} />
      
      <group onClick={() => onBlockSelect(null)}> {/* Click bg to deselect */}
        {blocks.map(block => (
            <Block 
              key={block.id} 
              data={block} 
              allBlocks={blocks} 
              isNew={block.id === lastIdRef.current}
              onSelect={onBlockSelect}
              isSelected={selectedBlockId === block.id}
            />
        ))}
      </group>

      <Sparkles count={100} scale={20} size={4} speed={0.4} opacity={0.5} color={KASPA_CYAN} position={[0,0, newestZ]} />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      
      <CameraController targetZ={newestZ} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
      
      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} radius={0.5} />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </>
  )
}

function App() {
  const bpsRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLDivElement>(null)
  const statsRefs = useRef({ bps: null, count: null, baseHeight: 0 })
  const [selectedBlock, setSelectedBlock] = useState<BlockData | null>(null)
  const [started, setStarted] = useState(false)

  // Link refs
  useEffect(() => {
    statsRefs.current.bps = bpsRef.current
    statsRefs.current.count = countRef.current
  }, [])

  const handleStart = () => {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    setStarted(true)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505', overflow: 'hidden' }}>
      
      {!started && (
        <div style={{
          position: 'absolute', zIndex: 100, top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <h1 style={{color: '#48Cca8', fontSize: '3rem', marginBottom: '20px', fontFamily: 'monospace'}}>KASPA.VISUALIZER</h1>
          <button 
            onClick={handleStart}
            style={{
              background: 'transparent', border: '2px solid #48Cca8', color: '#48Cca8',
              padding: '15px 40px', fontSize: '1.5rem', cursor: 'pointer', fontFamily: 'monospace',
              textTransform: 'uppercase', letterSpacing: '2px'
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(72, 204, 168, 0.2)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            INITIALIZE SIMULATION
          </button>
        </div>
      )}

      <Canvas camera={{ position: [5, 5, 15], fov: 60 }} gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, powerPreference: "high-performance" }} dpr={[1, 2]}>
        <fog attach="fog" args={['#050505', 10, 60]} />
        <Scene statsRefs={statsRefs} onBlockSelect={setSelectedBlock} selectedBlockId={selectedBlock?.id ?? null} isRunning={started} />
      </Canvas>
      
      {/* PRO HUD INTERFACE */}
      <div className="hud-overlay" style={{opacity: started ? 1 : 0, transition: 'opacity 1s'}}>
        <div className="header">
          <div className="logo">KASPA<span className="highlight">.VISUALIZER</span></div>
          <div className="status">LIVE MAINNET SIMULATION</div>
        </div>
        
        <div className="stats-panel">
          <div className="stat-item">
            <div className="label">BLOCK RATE</div>
            <div className="value" ref={bpsRef}>0.0 <span className="unit">BPS</span></div>
          </div>
          <div className="stat-item">
            <div className="label">BLOCK HEIGHT</div>
            <div className="value" ref={countRef}>LOADING...</div>
          </div>
          <div className="stat-item">
            <div className="label">NETWORK LOAD</div>
            <div className="bar-container">
               <div className="bar" style={{width: '85%'}}></div>
            </div>
          </div>
        </div>

        {/* DETAILS PANEL */}
        {selectedBlock && (
          <div className="details-panel" style={{
            position: 'absolute',
            top: '20%',
            right: '20px',
            width: '300px',
            background: 'rgba(0, 20, 20, 0.9)',
            border: '1px solid #48Cca8',
            padding: '20px',
            color: '#48Cca8',
            fontFamily: 'monospace',
            pointerEvents: 'auto'
          }}>
            <h3 style={{marginTop: 0, borderBottom: '1px solid #48Cca8', paddingBottom: '10px'}}>BLOCK DETAILS</h3>
            <div style={{marginBottom: '10px'}}>
              <span style={{color: '#888'}}>HASH:</span><br/>
              <span style={{wordBreak: 'break-all', color: '#fff', fontSize: '0.8rem'}}>{selectedBlock.hash}</span>
            </div>
            <div style={{marginBottom: '10px'}}>
              <span style={{color: '#888'}}>PARENTS:</span> {selectedBlock.parents.length}
            </div>
            <div style={{marginBottom: '10px'}}>
              <span style={{color: '#888'}}>DIFFICULTY:</span> {selectedBlock.difficulty}
            </div>
            <div>
               <span style={{color: '#888'}}>TIMESTAMP:</span><br/>
               {new Date(selectedBlock.createdAt).toLocaleTimeString()}
            </div>
          </div>
        )}

        <div className="footer">
          Build at Internet Speed Hackathon 2026
        </div>
      </div>
    </div>
  )
}

export default App
