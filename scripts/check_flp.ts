/**
 * Inspección y validación de archivos .flp.
 * Uso: npx tsx scripts/check_flp.ts <archivo.flp> [archivo2.flp ...]
 * Aplica asserts de los fixtures de pyflp (FL 20.8.4.flp, multi-channel.flp)
 * cuando el nombre coincide, para verificar el parser contra proyectos reales.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseFlp } from './flp_parse'

function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error('ASSERT fallido: ' + label)
  console.log(`    ✓ ${label}`)
}

function assertFixtures(file: string, parsed: ReturnType<typeof parseFlp>): void {
  const name = basename(file)

  if (name === 'FL2084.flp') {
    assert(parsed.ppq === 96, 'ppq == 96')
    assert(parsed.channelCount === 19, 'channel_count == 19')
    assert(Math.abs((parsed.tempo ?? 0) - 69.42) < 0.001, 'tempo == 69.420')
    assert(parsed.title === 'PyFLP Test FLP', 'title == "PyFLP Test FLP"')
    assert((parsed.version ?? '').startsWith('20.8.4'), 'version 20.8.4')
    assert(parsed.genre === 'Testing...', 'genre == "Testing..."')
    assert(parsed.channels.size >= 19, '>= 19 canales parseados')
    assert(parsed.patterns.length === 5, '5 patrones')
    const pnames = new Set(parsed.patterns.map((p) => p.name))
    for (const expected of ['Default', 'Colored', 'MIDI', 'Timemarkers', 'Selected']) {
      assert(pnames.has(expected), `patrón "${expected}"`)
    }
    const internal = [...parsed.channels.values()].map((c) => c.internalName)
    for (const expected of ['BooBass', 'Fruit Kick', 'Plucked!']) {
      assert(internal.includes(expected), `plugin interno "${expected}"`)
    }
    const names = [...parsed.channels.values()].map((c) => c.name ?? c.pluginName ?? c.internalName)
    assert(names.includes('22in Kick'), 'canal "22in Kick"')
    assert(parsed.notes.length > 0, `${parsed.notes.length} notas extraídas`)
  }

  if (name === 'multi-channel.flp') {
    assert(parsed.notes.length > 0, `${parsed.notes.length} notas extraídas`)
    const racks = new Set(parsed.notes.map((n) => n.rackChannel))
    assert(racks.size === 2, `rack_channels == {0,1} (${[...racks].join(',')})`)
    for (const r of racks) assert(r === 0 || r === 1, `rack_channel ${r} válido`)
  }
}

function main(): void {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error('Uso: npx tsx scripts/check_flp.ts <archivo.flp> ...')
    process.exit(1)
  }
  for (const file of files) {
    try {
      const parsed = parseFlp(file, readFileSync(file))
      console.log(`\n∇ ${file}`)
      console.log(
        `  FL v${parsed.version ?? '?'} · ${parsed.ppq} PPQ · ` +
          `${parsed.channelCount} canales (${parsed.channels.size} parseados) · ` +
          `${parsed.patterns.length} patrones · ${parsed.notes.length} notas · ` +
          `${parsed.tempo ? parsed.tempo.toFixed(3) : '?'} BPM · "${parsed.title ?? ''}"`,
      )
      for (const ch of parsed.channels.values()) {
        const n = parsed.notes.filter((x) => x.rackChannel === ch.iid).length
        const label = ch.name ?? ch.pluginName ?? ch.internalName ?? '?'
        console.log(`    canal ${ch.iid}: "${label}" [${ch.internalName ?? ''}] type=${ch.type} · ${n} notas`)
      }
      for (const pat of parsed.patterns) {
        console.log(`    patrón ${pat.iid}: "${pat.name ?? ''}" · ${pat.noteCount} notas`)
      }
      assertFixtures(file, parsed)
    } catch (e) {
      console.error(`  ✗ ${file}: ${String(e)}`)
      process.exitCode = 1
    }
  }
  if (process.exitCode === 0) console.log('\nTodo OK')
}

main()