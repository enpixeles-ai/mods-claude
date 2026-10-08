import { expect, test } from 'claude-code/testing'

const LLAVE_GOOGLE = 'AIzaSyD4LLAVEFALSA0LLAVEFALSA0LLAVEFALS'
const LLAVE_TELEGRAM = '1234567890:TOKENFALSO0TOKENFALSO0TOKENFALSO0TO'

const respondeBash = (stdout: string) => ({ result: { stdout, stderr: '', interrupted: false } })

const respondeRead = (content: string) => ({
  result: {
    type: 'text' as const,
    file: { filePath: '/Users/tu-usuario/.zshrc', content, numLines: 1, startLine: 1, totalLines: 1 },
  },
})

// ── Puerta 1 · la terminal ──────────────────────────────────────────────────

test('terminal · tapa una llave de Google que un comando imprimió', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => respondeBash(`GEMINI_API_KEY="${LLAVE_GOOGLE}"`))

  const corrido = await $.tool.call({ tool: 'Bash', command: 'bash ./mostrar-config.sh' })

  expect(corrido.result?.stdout).not.toContain(LLAVE_GOOGLE)
  expect(corrido.result?.stdout).toContain('TAPADO')
})

test('terminal · tapa también lo que sale por el canal de errores', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({
    result: { stdout: '', stderr: `fallo con token ${LLAVE_TELEGRAM}`, interrupted: false },
  }))

  const corrido = await $.tool.call({ tool: 'Bash', command: 'node bot.js' })

  expect(corrido.result?.stderr).not.toContain(LLAVE_TELEGRAM)
})

test('terminal · frena la lectura de un archivo de contraseñas', async $ => {
  const corrido = await $.tool.call({ tool: 'Bash', command: 'cat ~/.zshrc' })

  expect(corrido.deny).toContain('archivo de contraseñas')
  expect(corrido.deny).toContain('Córrelo tapado así')
})

test('terminal · frena un volcado de variables de entorno', async $ => {
  const corrido = await $.tool.call({ tool: 'Bash', command: 'printenv' })

  expect(corrido.deny).toContain('todas tus llaves de golpe')
})

test('terminal · frena docker inspect sobre las variables del contenedor', async $ => {
  const corrido = await $.tool.call({
    tool: 'Bash',
    command: "docker inspect mirofish --format '{{range .Config.Env}}{{println .}}{{end}}'",
  })

  expect(corrido.deny).toContain('docker')
})

test('terminal · deja pasar la misma lectura cuando ya va tapada', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => respondeBash('GEMINI_API_KEY=AIzaSyD…'))

  const corrido = await $.tool.call({
    tool: 'Bash',
    command: "cat ~/.zshrc | sed -E 's/(=.{0,6}).*/\\1…/'",
  })

  expect(corrido.deny).toBeUndefined()
})

test('terminal · no toca una salida que no lleva ninguna llave', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => respondeBash('mirofish   Up 2 months'))

  const corrido = await $.tool.call({ tool: 'Bash', command: 'docker ps' })

  expect(corrido.result?.stdout).toBe('mirofish   Up 2 months')
})

// ── Puerta 2 · la lectura de archivos ───────────────────────────────────────

test('lectura · tapa la llave sin frenar el archivo', async ($, on) => {
  on('tool.call', { tool: 'Read' }, () => respondeRead(`export GEMINI_API_KEY="${LLAVE_GOOGLE}"`))

  const corrido = await $.tool.call({ tool: 'Read', file_path: '/Users/tu-usuario/.zshrc' })

  expect(corrido.deny).toBeUndefined()
  expect(corrido.result?.file?.content).not.toContain(LLAVE_GOOGLE)
  expect(corrido.result?.file?.content).toContain('TAPADO')
})

test('lectura · deja intacto un archivo sin llaves', async ($, on) => {
  on('tool.call', { tool: 'Read' }, () => respondeRead('export PATH="$HOME/.local/bin:$PATH"'))

  const corrido = await $.tool.call({ tool: 'Read', file_path: '/Users/tu-usuario/.zshrc' })

  expect(corrido.result?.file?.content).toBe('export PATH="$HOME/.local/bin:$PATH"')
})

// ── Puerta 3 · la búsqueda dentro de archivos ───────────────────────────────

test('búsqueda · tapa la llave en las líneas encontradas', async ($, on) => {
  on('tool.call', { tool: 'Grep' }, () => ({
    result: {
      mode: 'content' as const,
      numFiles: 1,
      filenames: ['/Users/tu-usuario/.zshrc'],
      content: `.zshrc:12:export GEMINI_API_KEY="${LLAVE_GOOGLE}"`,
      numLines: 1,
    },
  }))

  const corrido = await $.tool.call({ tool: 'Grep', pattern: 'API_KEY', output_mode: 'content' })

  expect(corrido.result?.content).not.toContain(LLAVE_GOOGLE)
  expect(corrido.result?.content).toContain('TAPADO')
})

// ── Lo que hace útil la tapa ────────────────────────────────────────────────

test('deja ver el principio de la llave para poder distinguirla', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => respondeBash(LLAVE_GOOGLE))

  const corrido = await $.tool.call({ tool: 'Bash', command: 'bash ./mostrar.sh' })

  expect(corrido.result?.stdout).toContain('AIzaSyD4')
  expect(corrido.result?.stdout).not.toContain('n1KeWw')
})
