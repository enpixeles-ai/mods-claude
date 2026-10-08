# 🔑 Guardia de Llaves

Tapa tus llaves de API **antes** de que Claude las vea.

Mod propio de EnPíxeles Media. No es traducción: nació en español.

---

## El problema que resuelve

Nuestras llaves de API están repartidas por todas partes: `.env`, `.profile`,
`.bashrc`, `.npmrc`, variables de contenedores de Docker.

Cuando le pedimos a Claude *"mira este archivo"* o *"busca dónde está esta
variable"*, la llave entera le llega en la respuesta. Y ahí se queda:
**escrita en el historial de la conversación, para siempre.**

## Qué hace

Se pone en medio de tres puertas y revisa todo lo que pasa:

| Puerta | Qué hace |
|--------|----------|
| **Comandos** (`cat`, `head`, `tail`, `printenv`, `docker inspect`…) | Si el comando solo sirve para escupir un archivo de secretos, lo **frena** y le propone a Claude la misma lectura ya tapada. |
| **Leer archivos** (Read) | Nunca frena. Tapa las llaves antes de entregar el contenido. |
| **Buscar en archivos** (Grep) | Tapa las llaves en las líneas encontradas. |

Lo que Claude recibe:

```
GEMINI_API_KEY=AIzaSyD4…TAPADO
```

Se ven **los primeros ocho caracteres a propósito**, para que tú puedas
distinguir *cuál* llave es sin que la llave completa quede expuesta. Si tapara
todo, no sabrías de qué estás hablando.

Y te avisa con un mensajito en la esquina cada vez que tapa algo, para que
sepas que actuó.

## Qué llaves conoce

Google (`AIzaSy…`), Anthropic (`sk-ant-…`), OpenAI (`sk-proj-…`, `sk-…`),
OpenRouter (`sk-or-v1-…`), GitHub (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`),
Meta / Facebook (`EAA…`), Apify, Slack (`xoxb-…`), Telegram, y cualquier token
JWT (`eyJ…`).

Además pilla **cualquier** `ALGO_KEY=valor`, `ALGO_TOKEN=valor`,
`ALGO_SECRET=valor`, `ALGO_PASSWORD=valor` — y también en español:
`ALGO_CLAVE`, `ALGO_LLAVE`. Aunque sea de un servicio que no conoce.

## Qué archivos protege

`.env` y todas sus variantes, `.profile`, `.bashrc`, `.zshrc`, `.bash_profile`,
`.zprofile`, `.npmrc`, `.netrc`, `credentials`, `auth.json`,
`oauth_tokens.json`, las claves SSH (`id_rsa`, `id_dsa`) y cualquier carpeta
`.secrets/`.

## Cómo nos sirve

Podemos dejar que Claude lea configuraciones sin pensarlo dos veces. Que mire
un `.env` para entender por qué algo no arranca. Que busque dónde está
declarada una variable. Sin que la llave acabe en el historial.

## Lo que no hace

- **No desactiva la llave.** Tapa lo que Claude ve; la llave sigue siendo
  válida y sigue estando en tus archivos. Si una llave se filtró, hay que
  **rotarla** en el panel del proveedor. Esto evita filtraciones nuevas, no
  arregla las viejas.
- **No frena las escrituras.** Si Claude *escribe* una llave en un archivo, eso
  pasa. Vigila lo que entra, no lo que sale.
- **No pilla formas raras.** Conoce las de arriba. Un token con un formato que
  no ha visto nunca y sin un nombre que lo delate (`ALGO_KEY=`) se le puede
  escapar.
- **Es una red, no un candado.** Para bloquear de verdad, usa las
  [reglas de permisos](https://code.claude.com/docs/en/settings) de Claude Code.

## Pruebas

Tiene **11 pruebas automáticas**. Para correrlas:

```bash
claude plugin test ./guardia-llaves
```

Cubren: tapar llaves de la salida normal y del canal de errores, frenar la
lectura de archivos de contraseñas, frenar un volcado de variables de entorno,
frenar `docker inspect`, dejar pasar lo que ya viene tapado, no tocar lo que no
lleva llaves, y las tres puertas por separado.

## Requisitos

- Claude Code **2.1.287** o más nuevo (`claude --version`).

No hay que configurar nada. Funciona desde el primer segundo.

## Instalar

Dos comandos en tu terminal:

```bash
claude plugin marketplace add enpixeles-ai/mods-claude
```

```bash
claude plugin install guardia-llaves@enpixeles
```

Abre Claude Code otra vez y ya está activo.

## Quitar

```bash
claude plugin uninstall guardia-llaves@enpixeles
```

---

EnPíxeles Media, licencia Apache 2.0.
