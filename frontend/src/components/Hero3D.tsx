import { useEffect, useRef, useState } from 'react'

/**
 * Hero3D — the souk's emblem: a stoneware vessel turning on a potter's wheel,
 * built entirely in code (lathe geometry + procedural materials — no external
 * models, textures or CDNs, so the hero is as self-contained as the contract).
 *
 * Design rules applied (Thebes home-page bar):
 *  - bright and inviting — warm light on the sand field, never dark-first;
 *  - one world, one camera — scroll gently cranes the camera, nothing morphs;
 *  - the copy stays legible — the scene lives inside the stall arch, beside
 *    (never behind) the headline;
 *  - honest weight — three.js loads lazily in its own chunk; WebGL failure or
 *    reduced-motion falls back to the drawn emblem, and the page never waits.
 */
export function Hero3D({ onFail }: { onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!host.current) return
    let disposed = false
    let cleanup: (() => void) | undefined

    ;(async () => {
      try {
        const THREE = await import('three')
        if (disposed || !host.current) return

        const el = host.current
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const narrow = window.innerWidth < 720

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(narrow ? 1 : Math.min(window.devicePixelRatio, 2))
        renderer.setClearColor(0x000000, 0)
        el.appendChild(renderer.domElement)
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        renderer.domElement.style.display = 'block'

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30)

        // ── Lighting: warm key + sky, cool indigo rim (the palette in light) ──
        scene.add(new THREE.HemisphereLight(0xfff2dd, 0xc98a5a, 1.15))
        const key = new THREE.DirectionalLight(0xffe8c0, 1.7)
        key.position.set(2.5, 3.2, 2.2)
        scene.add(key)
        const rim = new THREE.DirectionalLight(0x9db4ff, 0.55)
        rim.position.set(-3, 2.2, -2.5)
        scene.add(rim)

        const root = new THREE.Group()
        root.scale.setScalar(0.88)
        root.position.y = -0.06
        scene.add(root)

        // ── The vessel: a mug-jar profile swept on a lathe ──
        const profile: InstanceType<typeof THREE.Vector2>[] = [
          [0.0, 0.0], [0.46, 0.0], [0.54, 0.05], [0.58, 0.18], [0.62, 0.5],
          [0.63, 0.78], [0.6, 1.05], [0.56, 1.28], [0.54, 1.42], [0.555, 1.5],
        ].map(([x, y]) => new THREE.Vector2(x, y))
        const clay = new THREE.MeshPhysicalMaterial({
          color: 0xc96f4a, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5,
        })
        const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), clay)
        root.add(body)

        // Cream glaze dip over the shoulder — a thin shell lathe.
        const glazeProfile = profile
          .filter((p) => p.y >= 1.0)
          .map((p) => new THREE.Vector2(p.x + 0.015, p.y))
        const glaze = new THREE.Mesh(
          new THREE.LatheGeometry(glazeProfile, 64),
          new THREE.MeshPhysicalMaterial({
            color: 0xf3e3c8, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25,
          }),
        )
        root.add(glaze)

        // Handle — a partial torus in the same clay.
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.075, 14, 28, Math.PI * 1.1), clay)
        handle.position.set(0.62, 0.82, 0)
        handle.rotation.z = Math.PI / 2 - 0.35
        root.add(handle)

        // Potter's wheel underneath.
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(1.0, 1.06, 0.12, 48),
          new THREE.MeshStandardMaterial({ color: 0x6f4a2f, roughness: 0.8 }),
        )
        wheel.position.y = -0.07
        root.add(wheel)

        // Soft contact shadow: a radial-gradient canvas, generated at runtime.
        const sc = document.createElement('canvas')
        sc.width = sc.height = 128
        const g = sc.getContext('2d')!
        const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64)
        grad.addColorStop(0, 'rgba(43,33,24,0.32)')
        grad.addColorStop(1, 'rgba(43,33,24,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 128, 128)
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(3.1, 3.1),
          new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }),
        )
        shadow.rotation.x = -Math.PI / 2
        shadow.position.y = -0.13
        scene.add(shadow)

        // Gold motes — sparse, slow, market-dust in the light shaft.
        let motes: InstanceType<typeof THREE.Points> | undefined
        if (!narrow) {
          const N = 56
          const pos = new Float32Array(N * 3)
          for (let i = 0; i < N; i++) {
            const th = Math.random() * Math.PI * 2
            const r = 0.9 + Math.random() * 1.1
            pos[i * 3] = Math.cos(th) * r
            pos[i * 3 + 1] = 0.1 + Math.random() * 2.1
            pos[i * 3 + 2] = Math.sin(th) * r
          }
          const pg = new THREE.BufferGeometry()
          pg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
          motes = new THREE.Points(pg, new THREE.PointsMaterial({
            color: 0xc99a3f, size: 0.028, transparent: true, opacity: 0.75, sizeAttenuation: true,
          }))
          scene.add(motes)
        }

        // ── Camera + scroll coupling (gentle crane, double-damped) ──
        const look = new THREE.Vector3(0, 0.72, 0)
        let smooth = 0
        const fit = () => {
          const w = el.clientWidth
          const h = el.clientHeight
          renderer.setSize(w, h, false)
          camera.aspect = w / h
          camera.updateProjectionMatrix()
        }
        fit()

        let last = performance.now()
        const frame = (now: number) => {
          const dt = Math.min((now - last) / 1000, 0.1)
          last = now
          const target = Math.max(0, Math.min(1, window.scrollY / (window.innerHeight * 0.9)))
          smooth += (target - smooth) * (1 - Math.pow(0.002, dt))
          root.rotation.y = 2.35 + now / 6500 + smooth * 1.15
          camera.position.set(Math.sin(smooth * 0.35) * 0.5, 1.22 + smooth * 0.4, 4.15 - smooth * 0.25)
          camera.lookAt(look)
          if (motes) {
            motes.rotation.y = -now / 22000
            motes.position.y = Math.sin(now / 3600) * 0.05
          }
          renderer.render(scene, camera)
        }

        let raf = 0
        let running = false
        const loop = (t: number) => { frame(t); raf = requestAnimationFrame(loop) }
        const start = () => { if (!running && !reduced) { running = true; last = performance.now(); raf = requestAnimationFrame(loop) } }
        const stop = () => { running = false; cancelAnimationFrame(raf) }

        if (reduced) {
          frame(performance.now()) // one static beauty frame
        } else {
          start()
        }

        // Pause when off-screen or tab hidden — the hero costs nothing unseen.
        const io = new IntersectionObserver(([e]) => { e.isIntersecting ? start() : stop() })
        io.observe(el)
        const onVis = () => { document.hidden ? stop() : start() }
        document.addEventListener('visibilitychange', onVis)
        const ro = new ResizeObserver(() => { fit(); if (reduced) frame(performance.now()) })
        ro.observe(el)

        cleanup = () => {
          stop()
          io.disconnect()
          ro.disconnect()
          document.removeEventListener('visibilitychange', onVis)
          renderer.dispose()
          scene.traverse((o) => {
            const m = o as { geometry?: { dispose: () => void }; material?: { dispose: () => void } }
            m.geometry?.dispose?.()
            m.material?.dispose?.()
          })
          renderer.domElement.remove()
        }
      } catch {
        if (!disposed) setFailed(true)
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    if (failed) onFail()
  }, [failed, onFail])

  return <div ref={host} className="h-full w-full" aria-hidden="true" />
}
