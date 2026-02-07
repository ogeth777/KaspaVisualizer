import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line, Float, Sparkles, Icosahedron } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import './App.css'

// --- CONSTANTS & TYPES ---
const SUI_BLUE = '#3898EC'
const SUI_OCEAN = '#6FBcF0'

interface BlockData {
  id: number
  position: [number, number, number]
  parents: number[]
  color: string
  createdAt: number
  hash: string
  difficulty: number
  tps: number
}

// --- SOUND UTILS ---
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
const playBlockSound = (type: 'normal' | 'large' | 'error') => {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  
  const now = audioCtx.currentTime
  
  if (type === 'large') {
    // Deep water drop sound
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, now)
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3)
    gain.gain.setValueAtTime(0.4, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc.start(now)
    osc.stop(now + 0.3)
  } else if (type === 'error') {
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(100, now)
    osc.frequency.linearRampToValueAtTime(50, now + 0.2)
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    osc.start(now)
    osc.stop(now + 0.2)
  } else {
    // Light drip
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600 + Math.random() * 200, now)
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.1)
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
    osc.start(now)
    osc.stop(now + 0.1)
  }
}

// --- COMPONENTS ---

function Block({ data, allBlocks, isNew, onSelect, isSelected }: { data: BlockData, allBlocks: BlockData[], isNew: boolean, onSelect: (b: BlockData) => void, isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHover] = useState(false)
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    
    if (meshRef.current) {
        // Fluid motion - SUI Water Theme
        meshRef.current.position.y = data.position[1] + Math.sin(t * 3 + data.id) * 0.2
        meshRef.current.rotation.x = Math.sin(t * 1) * 0.2
        meshRef.current.rotation.z = Math.cos(t * 1) * 0.2
        
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
      <Float speed={3} rotationIntensity={0.5} floatIntensity={1}>
        <mesh
          ref={meshRef}
          position={data.position}
          scale={isNew ? 0.1 : 1} 
          onClick={(e) => { e.stopPropagation(); onSelect(data) }}
          onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
          {/* SUI uses a "Drop" or Sphere shape often - using Icosahedron for tech/water look */}
          <icosahedronGeometry args={[0.5, 1]} /> 
          <meshPhysicalMaterial 
            color={isSelected ? '#ffffff' : (hovered ? '#b2ebf2' : data.color)} 
            emissive={isSelected ? '#ffffff' : data.color}
            emissiveIntensity={isSelected ? 2 : (hovered ? 1.0 : 0.5)}
            roughness={0.1}
            metalness={0.9}
            transmission={0.6} // Glass/Water effect
            thickness={1}
            clearcoat={1}
          />
        </mesh>
      </Float>
      
      {/* Edges (Parents) - Water flows */}
      {data.parents.map(parentId => {
        const parent = allBlocks.find(b => b.id === parentId)
        if (!parent) return null
        return (
          <Line
            key={`${data.id}-${parentId}`}
            points={[data.position, parent.position]}
            color={data.color}
            opacity={isSelected ? 0.8 : 0.3}
            transparent
            lineWidth={isSelected ? 2 : 1} 
          />
        )
      })}
    </group>
  )
}

function CameraController({ targetZ }: { targetZ: number }) {
  const { camera } = useThree()

  useFrame((state, delta) => {
    // Smoothly move camera to follow the growth
    const targetPos = new THREE.Vector3(5, 5, targetZ + 15) 
    
    const controlsRef = state.controls as any
    if (controlsRef) {
       const lookAtTarget = new THREE.Vector3(0, 0, targetZ)
       controlsRef.target.lerp(lookAtTarget, delta * 1)
       camera.position.lerp(targetPos, delta * 0.5)
       controlsRef.update()
    }
  })
  return null
}

function Scene({ statsRefs, onBlockSelect, selectedBlockId, isRunning }: { statsRefs: any, onBlockSelect: (b: BlockData | null) => void, selectedBlockId: number | null, isRunning: boolean }) {
  const [blocks, setBlocks] = useState<BlockData[]>([])
  const lastIdRef = useRef(0)
  const lastTimeRef = useRef(Date.now())
  const hasStartedRef = useRef(false)

  // Simulation Start
  useEffect(() => {
    hasStartedRef.current = true
    // Initial mock stats
    if (statsRefs.current.baseHeight) statsRefs.current.baseHeight = 124500000
  }, [])

  // --- SIMULATION LOOP ---
  useFrame(() => {
    if (!hasStartedRef.current || !isRunning) return

    const now = Date.now()
    // Optimized for performance - add block every ~600ms
    if (now - lastTimeRef.current > 600) {
      lastTimeRef.current = now
      
      const newId = lastIdRef.current + 1
      lastIdRef.current = newId
      
      // Procedural position (Flowing river like DAG)
      const z = newId * 1.5 // Increased spacing
      const x = (Math.random() - 0.5) * 8 // Narrower stream
      const y = (Math.random() - 0.5) * 4

      // Find parents (SUI Object centric, but visualised as DAG here)
      const parents: number[] = []
      const potentialParents = blocks.slice(-6) // Look at fewer recent blocks
      potentialParents.forEach(b => {
        if (Math.random() > 0.5) parents.push(b.id) 
      })
      if (parents.length === 0 && blocks.length > 0) {
        parents.push(blocks[blocks.length - 1].id) 
      }

      // Color logic
      const rnd = Math.random()
      let color = SUI_BLUE
      let type: 'normal' | 'large' | 'error' = 'normal'
      if (rnd > 0.95) { color = '#ffffff'; type = 'large' } // Whale transaction (White/Splash)
      else if (rnd > 0.98) { color = '#FF4081'; type = 'error' } // Failed

      playBlockSound(type)

      const newBlock: BlockData = {
        id: newId,
        position: [x, y, z],
        parents,
        color,
        createdAt: now,
        hash: '0x' + Math.random().toString(16).substring(2, 40),
        difficulty: 1,
        tps: Math.floor(Math.random() * 5000) + 1000 // Mock SUI TPS
      }

      setBlocks(prev => {
        const updated = [...prev, newBlock]
        if (updated.length > 40) updated.shift() // Limit to 40 blocks for performance
        return updated
      })
      
      // Update UI stats
      // Simulate fluctuating high TPS
      const currentTps = 2000 + Math.random() * 3000
      if (statsRefs.current.bps) statsRefs.current.bps.innerText = currentTps.toFixed(0) + ' TPS'
      if (statsRefs.current.count) {
        const realHeight = (statsRefs.current.baseHeight || 0) + newId
        statsRefs.current.count.innerText = realHeight.toLocaleString()
      }
    }
  })

  // Initial seed
  useEffect(() => {
    setBlocks([{ 
        id: 0, 
        position: [0,0,0], 
        parents: [], 
        color: SUI_BLUE, 
        createdAt: Date.now(),
        hash: 'genesis',
        difficulty: 1,
        tps: 0
    }])
  }, [])

  const newestZ = blocks.length > 0 ? blocks[blocks.length - 1].position[2] : 0

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, newestZ]} intensity={2} color="#ffffff" distance={50} />
      <pointLight position={[-10, -5, newestZ - 10]} intensity={2} color={SUI_OCEAN} distance={50} />
      
      <group onClick={() => onBlockSelect(null)}> 
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

      <Sparkles count={50} scale={20} size={6} speed={0.4} opacity={0.5} color={SUI_OCEAN} position={[0,0, newestZ]} />
      <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
      
      <CameraController targetZ={newestZ} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
      
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.2} radius={0.6} />
        <Noise opacity={0.02} />
        <Vignette eskil={false} offset={0.1} darkness={1.0} />
      </EffectComposer>
    </>
  )
}

// --- APP UI ---
function App() {
  const [selectedBlock, setSelectedBlock] = useState<BlockData | null>(null)
  const [isRunning, setIsRunning] = useState(true)
  
  // Refs for stats to update without re-render
  const statsRefs = useRef({
    bps: null as HTMLSpanElement | null,
    count: null as HTMLSpanElement | null,
    baseHeight: 0
  })

  return (
    <div className="app-container">
      <div className="canvas-container">
        <Canvas camera={{ position: [5, 5, 5], fov: 60 }} gl={{ antialias: false }}>
          <color attach="background" args={['#000510']} />
          <Scene 
            statsRefs={statsRefs} 
            onBlockSelect={setSelectedBlock} 
            selectedBlockId={selectedBlock?.id || null}
            isRunning={isRunning}
          />
        </Canvas>
      </div>

      <div className="hud-overlay">
        {/* Header */}
        <div className="header">
          <div className="logo">
            SUI<span className="highlight">.VISUALIZER</span>
          </div>
          <div className="status">
            LIVE MAINNET SIMULATION
          </div>
        </div>

        {/* Stats */}
        <div className="stats-panel">
          <div className="stat-item">
            <div className="label">TRANSACTIONS PER SECOND</div>
            <div className="value">
              <span ref={el => statsRefs.current.bps = el}>0</span>
              <span className="unit"> TPS</span>
            </div>
            <div className="bar-container">
               <div className="bar-fill" style={{width: '80%'}}></div>
            </div>
          </div>
          
          <div className="stat-item">
            <div className="label">TOTAL TRANSACTIONS</div>
            <div className="value" ref={el => statsRefs.current.count = el}>LOADING...</div>
          </div>
          
          <div className="stat-item">
            <div className="label">NETWORK LOAD</div>
            <div className="value">LOW</div>
          </div>
        </div>

        {/* Details Panel (if block selected) */}
        {selectedBlock && (
          <div className="details-panel">
            <h3>TRANSACTION DETAILS</h3>
            <div className="detail-row">
              <span>ID:</span> <span>{selectedBlock.id}</span>
            </div>
            <div className="detail-row">
              <span>HASH:</span> <span className="mono">{selectedBlock.hash.substring(0, 16)}...</span>
            </div>
            <div className="detail-row">
              <span>TIME:</span> <span>{new Date(selectedBlock.createdAt).toLocaleTimeString()}</span>
            </div>
            <button className="close-btn" onClick={() => setSelectedBlock(null)}>CLOSE</button>
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <div className="controls">
            <button onClick={() => setIsRunning(!isRunning)}>{isRunning ? 'PAUSE' : 'RESUME'}</button>
          </div>
          <div className="credit">
            Built for SUI Hackathon 2026
          </div>
        </div>
      </div>
    </div>
  )
}

export default App