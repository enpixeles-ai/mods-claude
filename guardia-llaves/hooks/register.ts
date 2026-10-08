import type { Engine, Register } from 'claude-code'

/**
 * Formas conocidas de llave, de la más específica a la más general, para que
 * una coincidencia estrecha quede tapada antes de que un patrón más ancho
 * reclame los mismos caracteres.
 */
const LLAVES: readonly RegExp[] = [
  /AIzaSy[A-Za-z0-9_-]{33}/g, // Google / Gemini
  /sk-ant-[A-Za-z0-9_-]{24,}/g, // Anthropic
  /sk-or-v1-[A-Za-z0-9]{32,}/g, // OpenRouter
  /sk-proj-[A-Za-z0-9_-]{24,}/g, // OpenAI (proyecto)
  /sk-[A-Za-z0-9]{32,}/g, // OpenAI (antigua)
  /gh[pousr]_[A-Za-z0-9]{36}/g, // GitHub
  /EAA[A-Za-z0-9]{60,}/g, // Meta / Facebook
  /apify_api_[A-Za-z0-9]{36}/g, // Apify
  /xox[baprs]-[A-Za-z0-9-]{12,}/g, // Slack
  /\b\d{9,10}:[A-Za-z0-9_-]{35}\b/g, // Telegram
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
]

/** `NOMBRE=valor` donde el propio nombre delata que el valor es una llave. */
const ASIGNACION =
  /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|CLAVE|LLAVE)[A-Z0-9_]*)\s*=\s*(["']?)([^\s"';]{8,})\2/g

/** Archivos que son contraseñas de principio a fin. */
const ARCHIVO_SECRETO =
  /(\.env(\.[\w.-]+)?|\.profile|\.bash_profile|\.bashrc|\.zshrc|\.zprofile|\.npmrc|\.netrc|credentials|oauth_tokens\.json|auth\.json|id_[rd]sa|\.secrets?\/)/

/** Comandos cuyo único trabajo es imprimir un archivo tal cual. */
const LECTOR = /\b(cat|bat|less|more|head|tail|nl|strings|xxd|od)\b/

/**
 * El usuario ya se encargó: una tapa nuestra, una que escribió él, o una
 * tubería hacia algo que reescribe el texto de salida.
 */
const YA_TAPADO = /…|TAPADO|REDACT|XXXXXX|\|\s*(sed|awk|cut|tr|md5sum|sha\d+sum)\b/

const TUBERIA_TAPADORA = "| sed -E 's/(=.{0,6}).*/\\1…/'"

/** Deja lo justo para distinguir dos llaves, nunca lo suficiente para usar una. */
const tapar = (llave: string): string => `${llave.slice(0, 8)}…TAPADO`

function limpiar(texto: string): { readonly texto: string; readonly tapadas: number } {
  let tapadas = 0
  let salida = texto

  for (const patron of LLAVES) {
    salida = salida.replace(patron, encontrada => {
      tapadas += 1

      return tapar(encontrada)
    })
  }

  salida = salida.replace(ASIGNACION, (completa, nombre: string, comilla: string, valor: string) =>
    YA_TAPADO.test(valor) ? completa : ((tapadas += 1), `${nombre}=${comilla}${tapar(valor)}${comilla}`),
  )

  return { texto: salida, tapadas }
}

const avisar = ($: Engine, tapadas: number): void => {
  $.ui.toast(
    `${$.plugin.name}: tapé ${tapadas} ${tapadas === 1 ? 'contraseña' : 'contraseñas'} en esa salida`,
  )
}

export const register: Register = on => {
  // ── Puerta 1 · la terminal ────────────────────────────────────────────────
  // Frena los comandos que solo existen para volcar contraseñas, y tapa lo
  // que se cuele por cualquier otro.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const { command } = e
    const frenar = (porque: string, enLugar: string) => ({
      deny: `${$.plugin.name}: ${porque}\nCórrelo tapado así:\n  ${enLugar}`,
    })

    // Se frenan antes de correr: una vez que la llave queda en pantalla, hay
    // que rotarla.
    if (!YA_TAPADO.test(command)) {
      if (LECTOR.test(command) && ARCHIVO_SECRETO.test(command)) {
        return frenar(
          'eso imprimiría un archivo de contraseñas tal cual en la pantalla.',
          `${command} ${TUBERIA_TAPADORA}`,
        )
      }

      if (/^\s*(printenv|env)\s*$/.test(command)) {
        return frenar(
          'un volcado de variables muestra todas tus llaves de golpe.',
          `${command} ${TUBERIA_TAPADORA}`,
        )
      }

      if (/docker\s+(inspect|exec)[^|]*\bEnv\b/.test(command)) {
        return frenar(
          'docker imprime las variables del contenedor sin taparlas.',
          `${command} ${TUBERIA_TAPADORA}`,
        )
      }

      if (/\bgrep\b[^|]*(KEY|TOKEN|SECRET|PASSWORD|CLAVE|LLAVE)/i.test(command) && ARCHIVO_SECRETO.test(command)) {
        return frenar(
          'buscar el nombre de una llave en un archivo de contraseñas imprime también su valor.',
          `${command} ${TUBERIA_TAPADORA}`,
        )
      }
    }

    const corrido = await next(e)

    if (corrido.deny !== undefined) {
      return corrido
    }

    const salida = limpiar(corrido.result.stdout ?? '')
    const errores = limpiar(corrido.result.stderr ?? '')
    const tapadas = salida.tapadas + errores.tapadas

    if (tapadas === 0) {
      return corrido
    }

    avisar($, tapadas)

    return { result: { ...corrido.result, stdout: salida.texto, stderr: errores.texto } }
  })

  // ── Puerta 2 · la lectura de archivos ─────────────────────────────────────
  // Aquí no se frena: Claude necesita leer para trabajar. Se deja pasar el
  // archivo con las llaves tapadas.
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const corrido = await next(e)

    if (corrido.deny !== undefined || corrido.result.type !== 'text') {
      return corrido
    }

    const { texto, tapadas } = limpiar(corrido.result.file.content)

    if (tapadas === 0) {
      return corrido
    }

    avisar($, tapadas)

    return { result: { ...corrido.result, file: { ...corrido.result.file, content: texto } } }
  })

  // ── Puerta 3 · la búsqueda dentro de archivos ─────────────────────────────
  // Buscar "KEY" devuelve la línea entera, con el valor pegado. Se tapa igual.
  on('tool.call', { tool: 'Grep' }, async ($, e, next) => {
    const corrido = await next(e)

    if (corrido.deny !== undefined || corrido.result.content === undefined) {
      return corrido
    }

    const { texto, tapadas } = limpiar(corrido.result.content)

    if (tapadas === 0) {
      return corrido
    }

    avisar($, tapadas)

    return { result: { ...corrido.result, content: texto } }
  })
}
