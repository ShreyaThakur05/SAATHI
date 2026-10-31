"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneState } from "@/lib/scene";
import type { HopState } from "@/lib/types";

const COLOR = { ok: "#12c07f", degraded: "#f4a21b", down: "#e5484d", checking: "#00b9f5", idle: "#5b6b82" };
const hopColor = (s: HopState) => (s === "ok" ? COLOR.ok : s === "degraded" ? COLOR.degraded : COLOR.down);

const DEVICE = new THREE.Vector3(-3.9, 0.55, 0.9);
const TOWER = new THREE.Vector3(0, 1.5, -0.6);
const GATEWAY = new THREE.Vector3(3.9, 0.75, 0.7);

/** One heartbeat travelling along a link. Behaviour encodes the link's real state. */
function Pulses({ from, to, state, everyS, speed }: { from: THREE.Vector3; to: THREE.Vector3; state: HopState; everyS: number; speed: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const burst = useRef<THREE.Mesh>(null);
  const count = 3;
  useFrame(({ clock }) => {
    const base = (clock.elapsedTime * speed) / (everyS * count);
    for (let i = 0; i < count; i++) {
      const m = refs.current[i];
      if (!m) continue;
      let t = (base * count + i / count) % 1;
      const mat = m.material as THREE.MeshBasicMaterial;
      if (state === "down") {
        // the heartbeat dies partway along a broken link
        t = Math.min(t, 0.5);
        mat.opacity = (base * count + i / count) % 1 > 0.5 ? 0 : 1;
      } else if (state === "degraded") {
        mat.opacity = i % 2 === 0 ? 1 : Math.max(0, 1 - Math.max(0, t - 0.35) * 2.2); // some are lost on the way
      } else mat.opacity = 1;
      m.position.lerpVectors(from, to, t);
      m.scale.setScalar(0.75 + 0.25 * Math.sin(clock.elapsedTime * 8 + i));
    }
    if (burst.current) {
      const b = burst.current;
      if (state === "down") {
        const k = (clock.elapsedTime * speed * 0.8) % 1;
        b.visible = true;
        b.position.lerpVectors(from, to, 0.5);
        b.scale.setScalar(0.2 + k * 1.1);
        (b.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      } else b.visible = false;
    }
  });
  const color = hopColor(state);
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshBasicMaterial color={color} transparent />
        </mesh>
      ))}
      <mesh ref={burst} visible={false}>
        <ringGeometry args={[0.7, 0.85, 32]} />
        <meshBasicMaterial color={COLOR.down} transparent side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function Link({ from, to, state, everyS, speed }: { from: THREE.Vector3; to: THREE.Vector3; state: HopState; everyS: number; speed: number }) {
  const geo = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.55, 0));
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 28, state === "down" ? 0.025 : 0.04, 8, false);
  }, [from, to, state]);
  return (
    <group>
      <mesh geometry={geo}>
        <meshBasicMaterial color={hopColor(state)} transparent opacity={state === "down" ? 0.35 : 0.7} />
      </mesh>
      <Pulses from={from} to={to} state={state} everyS={everyS} speed={speed} />
    </group>
  );
}

function DeviceModel({ kind, state, checking, speed }: { kind: "SOUNDBOX" | "CARD_MACHINE"; state: "ok" | "fault"; checking: boolean; speed: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      const k = (clock.elapsedTime * speed * 0.9) % 1;
      ring.current.visible = checking;
      ring.current.scale.setScalar(0.8 + k * 1.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    }
    if (light.current) (light.current.material as THREE.MeshStandardMaterial).emissiveIntensity = state === "ok" ? 1 + 0.6 * Math.sin(clock.elapsedTime * 5) : 0.4;
  });
  const body = state === "ok" ? "#1b2f55" : "#4a1f27";
  const accent = state === "ok" ? COLOR.ok : COLOR.down;
  return (
    <group position={DEVICE}>
      {kind === "SOUNDBOX" ? (
        <>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[1.1, 1.5, 1.1]} />
            <meshStandardMaterial color={body} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.05, 0.56]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.04, 32]} />
            <meshStandardMaterial color="#0a1226" />
          </mesh>
          <mesh position={[0, 0.05, 0.585]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.02, 24]} />
            <meshStandardMaterial color="#2b3a63" />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, -0.1, 0]} rotation={[-0.25, 0, 0]}>
            <boxGeometry args={[1.0, 1.5, 0.28]} />
            <meshStandardMaterial color={body} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.18, 0.14]} rotation={[-0.25, 0, 0]}>
            <planeGeometry args={[0.7, 0.5]} />
            <meshStandardMaterial color="#0a1226" emissive={accent} emissiveIntensity={state === "ok" ? 0.25 : 0.05} />
          </mesh>
        </>
      )}
      <mesh ref={light} position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} visible={false}>
        <ringGeometry args={[0.8, 0.92, 48]} />
        <meshBasicMaterial color={COLOR.checking} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function TowerModel({ state, speed }: { state: HopState; speed: number }) {
  const waves = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    waves.current.forEach((m, i) => {
      if (!m) return;
      const k = (clock.elapsedTime * speed * (state === "ok" ? 0.55 : 0.3) + i / 3) % 1;
      m.scale.setScalar(0.4 + k * 1.9);
      (m.material as THREE.MeshBasicMaterial).opacity = state === "down" ? 0.08 * (1 - k) : 0.7 * (1 - k);
    });
  });
  const c = state === "down" ? COLOR.idle : hopColor(state);
  return (
    <group position={TOWER}>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.08, 0.32, 2.2, 8]} />
        <meshStandardMaterial color="#8793a8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.9} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { waves.current[i] = el; }} position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.6, 0.02, 8, 48]} />
          <meshBasicMaterial color={c} transparent />
        </mesh>
      ))}
    </group>
  );
}

function GatewayModel({ speed }: { speed: number }) {
  const lights = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    lights.current.forEach((m, i) => {
      if (m) (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + 0.8 * Math.max(0, Math.sin(clock.elapsedTime * speed * 3 + i * 1.7));
    });
  });
  return (
    <group position={GATEWAY}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, -0.45 + i * 0.5, 0]}>
          <mesh>
            <boxGeometry args={[1.5, 0.4, 0.9]} />
            <meshStandardMaterial color="#1b2f55" roughness={0.45} />
          </mesh>
          <mesh ref={(el) => { lights.current[i] = el; }} position={[0.55, 0, 0.46]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color={COLOR.ok} emissive={COLOR.ok} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Saathi's probe: a packet that goes out from the gateway towards the device and back. */
function Probe({ active, speed }: { active: boolean; speed: number }) {
  const m = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!m.current) return;
    m.current.visible = active;
    const k = (clock.elapsedTime * speed * 0.45) % 1; // 0..1 out, back
    const p = k < 0.5 ? k * 2 : 2 - k * 2;
    const a = GATEWAY, mid = TOWER, b = DEVICE;
    if (p < 0.5) m.current.position.lerpVectors(a, mid, p * 2);
    else m.current.position.lerpVectors(mid, b, (p - 0.5) * 2);
    m.current.position.y += 0.45;
    m.current.scale.setScalar(1 + 0.3 * Math.sin(clock.elapsedTime * 10));
  });
  return (
    <mesh ref={m} visible={false}>
      <octahedronGeometry args={[0.16]} />
      <meshBasicMaterial color={COLOR.checking} />
    </mesh>
  );
}

/** Keep the whole scene in view whatever shape the panel is (narrow panels pull the camera back). */
function FitCamera() {
  const { camera, size } = useThree();
  useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const dist = Math.max(9.5, 16 / aspect);
    camera.position.set(0, dist * 0.34, dist);
    camera.lookAt(0, 0.4, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** A text label drawn to a canvas texture (no DOM overlay, so nothing outside the canvas to mount). */
function Label({ position, text }: { position: [number, number, number]; text: string }) {
  // bigger text on narrow screens (phones), where the whole scene is shrunk to fit
  const compact = useThree((st) => st.size.width < 520);
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(255,255,255,0.94)";
    g.beginPath();
    g.roundRect(8, 12, 496, 72, 36);
    g.fill();
    g.fillStyle = "#0f172a";
    g.font = "600 36px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 256, 49, 470);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  return (
    <sprite position={position} scale={compact ? [4.1, 4.1 * (96 / 512), 1] : [3.3, 3.3 * (96 / 512), 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

export interface SceneProps {
  scene: SceneState;
  kind: "SOUNDBOX" | "CARD_MACHINE";
  serial: string;
  reducedMotion: boolean;
}

export default function DeviceScene3D({ scene, kind, serial, reducedMotion }: SceneProps) {
  const speed = reducedMotion ? 0.25 : 1;
  return (
    <Canvas camera={{ position: [0, 3.9, 11.2], fov: 40 }} dpr={[1, 1.75]} aria-hidden>
      <FitCamera />
      <color attach="background" args={["#0a1f3c"]} />
      <fog attach="fog" args={["#0a1f3c", 12, 24]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 8, 5]} intensity={1.4} />
      <pointLight position={[-4, 2, 2]} intensity={0.8} color={scene.device === "ok" ? COLOR.ok : COLOR.down} />
      <gridHelper args={[26, 26, "#1d3a66", "#14294a"]} position={[0, -0.75, 0]} />

      <DeviceModel kind={kind} state={scene.device} checking={scene.checking} speed={speed} />
      <TowerModel state={scene.linkTower} speed={speed} />
      <GatewayModel speed={speed} />

      {/* heartbeats flow device -> cell site -> gateway */}
      <Link from={DEVICE.clone().add(new THREE.Vector3(0, 1.0, 0))} to={TOWER.clone().add(new THREE.Vector3(0, 1.0, 0))} state={scene.linkTower} everyS={scene.pulseEveryS} speed={speed} />
      <Link from={TOWER.clone().add(new THREE.Vector3(0, 1.0, 0))} to={GATEWAY.clone().add(new THREE.Vector3(0, 0.6, 0))} state={scene.linkGateway} everyS={scene.pulseEveryS} speed={speed} />
      <Probe active={scene.checking} speed={speed} />

      <Label position={[DEVICE.x, DEVICE.y - 1.3, DEVICE.z]} text={`${kind === "SOUNDBOX" ? "Soundbox" : "Card machine"} ${serial}`} />
      <Label position={[TOWER.x, TOWER.y - 1.7, TOWER.z]} text="Cell site" />
      <Label position={[GATEWAY.x, GATEWAY.y - 1.3, GATEWAY.z]} text="Paytm service" />

      <OrbitControls enablePan={false} enableZoom={false} autoRotate={!reducedMotion} autoRotateSpeed={0.5} minPolarAngle={0.9} maxPolarAngle={1.45} />
    </Canvas>
  );
}
