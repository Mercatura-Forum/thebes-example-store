import { useEffect, useRef, useState } from 'react'

/**
 * Hero3D — the souk's emblem: a glazed stoneware mug turning on a potter's
 * wheel, built entirely in code (spline-lathed body + swept handle — no
 * external models, textures or CDNs, so the hero is as self-contained as the
 * contract).
 *
 * Geometry discipline (this object IS the first impression):
 *  - ONE closed profile: bottom centre → foot → outer wall → rounded rim →
 *    inner wall → inner bottom centre. No naked edges at any angle.
 *  - The dipped glaze splits that profile at a SHARED boundary ring, so the
 *    clay/glaze seam is exact — no gap, no z-fighting.
 *  - The handle is a cubic-bézier tube whose ends are buried inside the wall,
 *    so both joints read as thrown, not glued on.
 *  - A PMREM room environment gives the glaze its ceramic sheen.
 *  - window.__soukHero.setAngle(rad) — the verification rig inspects the mug
 *    from every angle before it ships.
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
        const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
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

        // Studio: a PMREM room for ceramic sheen + warm key, soft warm sky,
        // cool indigo rim (the palette's counterpoint).
        const pmrem = new THREE.PMREMGenerator(renderer)
        const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        scene.environment = envTex
        scene.add(new THREE.HemisphereLight(0xfff2dd, 0xd8a06e, 0.75))
        const key = new THREE.DirectionalLight(0xffe8c0, 1.35)
        key.position.set(2.6, 3.4, 2.4)
        scene.add(key)
        const rim = new THREE.DirectionalLight(0x9db4ff, 0.4)
        rim.position.set(-3, 2.0, -2.6)
        scene.add(rim)

        const root = new THREE.Group()
        root.scale.setScalar(0.86)
        root.position.y = -0.04
        scene.add(root)

        // ── The mug: one closed profile, spline-smoothed ──
        // bottom centre → foot ring → belly → rim (rounded over) → inner wall
        // → inner floor → inner centre. x = radius, y = height.
        const CONTROL: [number, number][] = [
          [0.001, 0.02], [0.20, 0.01], [0.36, 0.02], [0.46, 0.08],
          [0.55, 0.22], [0.61, 0.46], [0.63, 0.72], [0.61, 0.98],
          [0.575, 1.22], [0.555, 1.40], [0.553, 1.50],           // rim outer
          [0.52, 1.545], [0.487, 1.50],                          // rounded rim top
          [0.482, 1.34], [0.50, 1.10], [0.515, 0.82], [0.49, 0.55],
          [0.40, 0.36], [0.24, 0.295], [0.001, 0.29],            // inner floor
        ]
        const spline = new THREE.SplineCurve(CONTROL.map(([x, y]) => new THREE.Vector2(x, y)))
        const pts = spline.getPoints(120).map((p) => new THREE.Vector2(Math.max(p.x, 0.001), p.y))

        // Split at the glaze dip on the way UP the outer wall (y ≥ 1.14):
        // everything above the dip line — outer shoulder, rim, whole interior —
        // wears the cream glaze. The boundary ring is shared point-for-point.
        let split = pts.findIndex((p, i) => i > 0 && p.y >= 1.14)
        if (split < 2) split = Math.floor(pts.length / 2)
        const clayPts = pts.slice(0, split + 1)
        const glazePts = pts.slice(split)

        const clay = new THREE.MeshPhysicalMaterial({
          color: 0xc96f4a, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4,
          envMapIntensity: 0.7, side: THREE.DoubleSide,
        })
        const glaze = new THREE.MeshPhysicalMaterial({
          color: 0xf3e4c9, roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.22,
          envMapIntensity: 1.0, side: THREE.DoubleSide,
        })
        root.add(new THREE.Mesh(new THREE.LatheGeometry(clayPts, 96), clay))
        root.add(new THREE.Mesh(new THREE.LatheGeometry(glazePts, 96), glaze))

        // ── The handle: a swept tube, both ends buried inside the wall ──
        const handleCurve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(0.50, 1.16, 0),   // buried in the upper wall
          new THREE.Vector3(1.06, 1.24, 0),
          new THREE.Vector3(1.10, 0.52, 0),
          new THREE.Vector3(0.50, 0.46, 0),   // buried in the lower wall
        )
        const handleGeo = new THREE.TubeGeometry(handleCurve, 48, 0.082, 20, false)
        root.add(new THREE.Mesh(handleGeo, clay))

        // Potter's wheel underneath.
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(1.02, 1.08, 0.12, 64),
          new THREE.MeshStandardMaterial({ color: 0x6f4a2f, roughness: 0.85, envMapIntensity: 0.35 }),
        )
        wheel.position.y = -0.07
        root.add(wheel)

        // Soft contact shadow: a radial-gradient canvas, generated at runtime.
        const sc = document.createElement('canvas')
        sc.width = sc.height = 128
        const g = sc.getContext('2d')!
        const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64)
        grad.addColorStop(0, 'rgba(43,33,24,0.30)')
        grad.addColorStop(1, 'rgba(43,33,24,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 128, 128)
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(3.2, 3.2),
          new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }),
        )
        shadow.rotation.x = -Math.PI / 2
        shadow.position.y = -0.135
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
        let manualAngle: number | undefined
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
          root.rotation.y = manualAngle ?? (2.35 + now / 6500 + smooth * 1.15)
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

        // Verification hook: freeze the turntable at an exact angle and render.
        ;(window as unknown as Record<string, unknown>).__soukHero = {
          setAngle: (a: number | undefined) => {
            manualAngle = a
            if (!running) frame(performance.now())
          },
        }

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
          delete (window as unknown as Record<string, unknown>).__soukHero
          pmrem.dispose()
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
