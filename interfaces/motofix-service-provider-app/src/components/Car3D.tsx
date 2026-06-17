import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'

export type CarZone = 'engine' | 'wheel' | 'front' | 'rear' | 'body' | 'whole'

// Which car parts light up for each zone.
const HI: Record<CarZone, string[]> = {
  wheel:  ['wheel'],
  engine: ['hood'],
  front:  ['frontBumper', 'headlight'],
  rear:   ['rearBumper', 'taillight'],
  body:   ['cabin', 'body'],
  whole:  ['body', 'cabin', 'hood'],
}

/* Camera orbits the car: continuous azimuth (around) + sine elevation (above & below). */
function OrbitCam() {
  const { camera } = useThree()
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const R = 6.4
    const az = t * 0.5
    const el = Math.sin(t * 0.42) * 0.95 // swings above and below the car
    camera.position.set(
      R * Math.cos(az) * Math.cos(el),
      R * Math.sin(el) + 0.5,
      R * Math.sin(az) * Math.cos(el),
    )
    camera.lookAt(0, 0.3, 0)
  })
  return null
}

/* A mesh that, when `on`, darkens and pulses an emissive glow in the part colour. */
function HiMesh({ on, color, children, ...props }: { on: boolean; color: string } & ThreeElements['mesh']) {
  const ref = useRef<THREE.Mesh>(null)
  const emissive = useMemo(() => new THREE.Color(on ? color : '#000000'), [on, color])
  useFrame(({ clock }) => {
    const m = ref.current?.material as THREE.MeshStandardMaterial | undefined
    if (!m) return
    if (on) {
      const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 4.2)
      m.emissiveIntensity = 0.5 + pulse * 1.7
    }
  })
  return (
    <mesh ref={ref} castShadow {...props}>
      {children}
      <meshStandardMaterial
        color={on ? '#141119' : '#454b57'}
        emissive={emissive}
        emissiveIntensity={on ? 1 : 0}
        metalness={0.55}
        roughness={0.38}
      />
    </mesh>
  )
}

function Car({ zone, color }: { zone: CarZone; color: string }) {
  const hi = HI[zone]
  const on = (p: string) => hi.includes(p)
  const wheels: [number, number][] = [[1.25, 0.92], [1.25, -0.92], [-1.25, 0.92], [-1.25, -0.92]]
  const lightZ = [0.62, -0.62]
  return (
    <group position={[0, -0.1, 0]}>
      {/* lower body */}
      <HiMesh on={on('body')} color={color} position={[0, 0.45, 0]}>
        <boxGeometry args={[4.1, 0.7, 1.8]} />
      </HiMesh>
      {/* hood (engine bay, front) */}
      <HiMesh on={on('hood')} color={color} position={[1.45, 0.66, 0]}>
        <boxGeometry args={[1.15, 0.4, 1.7]} />
      </HiMesh>
      {/* cabin */}
      <HiMesh on={on('cabin')} color={color} position={[-0.25, 1.05, 0]}>
        <boxGeometry args={[2.1, 0.72, 1.55]} />
      </HiMesh>
      {/* front bumper */}
      <HiMesh on={on('frontBumper')} color={color} position={[2.1, 0.4, 0]}>
        <boxGeometry args={[0.3, 0.55, 1.8]} />
      </HiMesh>
      {/* rear bumper */}
      <HiMesh on={on('rearBumper')} color={color} position={[-2.1, 0.4, 0]}>
        <boxGeometry args={[0.3, 0.55, 1.8]} />
      </HiMesh>
      {/* headlights */}
      {lightZ.map((z, i) => (
        <HiMesh key={`h${i}`} on={on('headlight')} color={color} position={[2.18, 0.6, z]}>
          <boxGeometry args={[0.1, 0.22, 0.42]} />
        </HiMesh>
      ))}
      {/* taillights */}
      {lightZ.map((z, i) => (
        <HiMesh key={`t${i}`} on={on('taillight')} color={color} position={[-2.18, 0.6, z]}>
          <boxGeometry args={[0.1, 0.22, 0.42]} />
        </HiMesh>
      ))}
      {/* wheels */}
      {wheels.map(([x, z], i) => (
        <HiMesh key={`w${i}`} on={on('wheel')} color={color} position={[x, 0.15, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.36, 26]} />
        </HiMesh>
      ))}
    </group>
  )
}

export default function Car3D({ zone, color }: { zone: CarZone; color: string }) {
  return (
    <div style={{ width: '100%', height: 220 }}>
      <Canvas camera={{ position: [6, 3, 6], fov: 42 }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 9, 5]} intensity={0.95} />
        <directionalLight position={[-5, 3, -4]} intensity={0.3} />
        <pointLight position={[0, 3.5, 0]} intensity={0.8} color={color} distance={14} />
        <OrbitCam />
        <Car zone={zone} color={color} />
      </Canvas>
    </div>
  )
}
