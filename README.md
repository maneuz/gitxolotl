# Gitxólotl 🦎

Un ajolote en pixel art que vive en un canal de Xochimilco y se alimenta de tu
actividad en GitHub. Tus lenguajes le colorean las branquias, tus contribuciones
lo hacen crecer, tus rachas le dan manchitas doradas y lo que hiciste ayer decide
qué hace hoy. Si lo abandonas, palidece y se le encogen las branquias; cuando
vuelves, **se regenera**.

<p align="center">
  <img src="docs/nadando.svg" width="640" alt="Un ajolote rosa nadando en un canal de Xochimilco" />
</p>

*axolotl*, del náhuatl *atl* (agua) y *xólotl*. Gitxólotl: el ajolote de tu Git.

## Cómo se traduce tu actividad

| Lo que pasa en GitHub | Lo que le pasa al ajolote |
| --- | --- |
| Tus 3 lenguajes principales (por bytes de código) | Color de cada par de branquias (los ajolotes tienen 3 pares) |
| Contribuciones totales: 0 / 250 / 1,000 / 5,000 | Etapa: larva → juvenil → adulto → ancestral |
| Racha más larga | Manchitas doradas en el lomo (una cada 5 días de racha) |
| 7+ días sin actividad | Las branquias empiezan a encogerse |
| 14+ días sin actividad | Pálido, descansando en el fondo, de noche |
| 60+ días sin actividad | Dormido, agua turbia, branquias mínimas |

### Comportamiento del día

Cada noche se juzga el día que terminó. Gana la primera regla que se cumpla:

| Comportamiento | Cuándo |
| --- | --- |
| **Dormido** | 60 o más días seguidos sin contribuciones |
| **Descansando** | 14 o más días seguidos sin contribuciones |
| **Regenerando** | Contribuiste ayer después de 14+ días sin actividad: le vuelven a crecer las branquias |
| **Comiendo** | Fue tu primer día con contribuciones en la semana (lunes a domingo) |
| **Acelerado** | Cruzaste un hito (100, 500, 1,000, 2,500, 5,000…) en los últimos 7 días, o es domingo y cerraste una semana en tu top 10% |
| **Nadando** | Cualquier otro día |

<table>
  <tr>
    <td><img src="docs/regenerando.svg" width="320" alt="Regenerando"><br><sub>Regenerando</sub></td>
    <td><img src="docs/comiendo.svg" width="320" alt="Comiendo"><br><sub>Comiendo</sub></td>
  </tr>
  <tr>
    <td><img src="docs/descansando.svg" width="320" alt="Descansando"><br><sub>Descansando</sub></td>
    <td><img src="docs/dormido.svg" width="320" alt="Dormido"><br><sub>Dormido</sub></td>
  </tr>
</table>

### Morphs

Eliges la variante de color, como en los ajolotes reales: `leucistico` (rosa,
default), `salvaje`, `dorado`, `melanoide` y `cobre`.

<table>
  <tr>
    <td><img src="docs/morph-salvaje.svg" width="320" alt="Salvaje"></td>
    <td><img src="docs/morph-dorado.svg" width="320" alt="Dorado"></td>
  </tr>
  <tr>
    <td><img src="docs/morph-melanoide.svg" width="320" alt="Melanoide"></td>
    <td><img src="docs/morph-cobre.svg" width="320" alt="Cobre"></td>
  </tr>
</table>

## Ponerlo en tu perfil

1. Crea (o abre) tu repo de perfil: el que se llama igual que tu usuario,
   por ejemplo `maneuz/maneuz`, y que sea **público**.
2. Copia [`examples/perfil-workflow.yml`](examples/perfil-workflow.yml) a
   `.github/workflows/ajolote.yml` en ese repo.
3. Agrega esto a su `README.md`:

   ```html
   <p align="center"><img src="ajolote/ajolote.svg" width="640" alt="Mi ajolote"></p>
   ```

4. En *Actions*, corre el workflow **Ajolote** a mano la primera vez
   (*Run workflow*). Después se redibuja solo cada noche.

### Si tu actividad es privada

El `GITHUB_TOKEN` del workflow solo ve lo público. Tienes dos opciones:

- **Contribuciones:** en tu perfil, activa *Contribution settings → Private
  contributions* para que cuenten (solo se ve el número, no los repos).
- **Lenguajes:** crea un token *fine-grained* de solo lectura
  (*Settings → Developer settings → Personal access tokens*), con acceso a tus
  repos y permiso *Metadata: Read-only*. Guárdalo en tu repo de perfil como
  secreto `GITXOLOTL_TOKEN` y descomenta la línea `token:` del workflow.

## Desarrollo local

Requiere Node.js 22.18 o superior, que ejecuta TypeScript directamente y no
necesita compilar ni instalar dependencias en tiempo de ejecución.

```bash
npm install              # solo para typecheck (typescript, @types/node)
npm run demo             # genera demo/index.html con todas las escenas
npm test
npm run typecheck

# Con tus datos reales:
GITHUB_TOKEN=ghp_xxx node src/cli.ts --usuario maneuz --salida ajolote/ajolote.svg

# Desde un archivo (sin red):
node src/cli.ts --datos examples/snapshot-ejemplo.json --morph cobre
```

Abre `demo/index.html` en el navegador para ver las animaciones.

### Estructura

```text
src/
  cli.ts        punto de entrada y opciones
  collect.ts    lectura de la API GraphQL de GitHub
  state.ts      reglas: actividad → etapa, comportamiento, salud
  axolotl.ts    dibujo procedural del ajolote (pixel art)
  scene.ts      el canal de Xochimilco: chinampa, ahuejotes, lirios, lodo
  render.ts     composición del SVG y animaciones CSS
  palettes.ts   morphs y cielos (día, atardecer, noche)
  font.ts       fuente pixel 3x5 del letrero
  demo.ts       datos sintéticos para cada comportamiento
test/           pruebas con node:test
action.yml      la GitHub Action
```

### Notas técnicas

- La salida es un **SVG animado solo con CSS**. GitHub muestra los SVG del README
  como `<img>`, donde no corren scripts pero sí las animaciones CSS.
- El ajolote se define en "unidades de adulto" y se rasteriza a la escala de cada
  etapa, así que todas las etapas salen del mismo modelo.
- Todo es determinista: la misma actividad produce el mismo SVG, y el escenario
  se genera con una semilla basada en tu usuario.
- Respeta `prefers-reduced-motion`.

## Ideas para siguientes versiones

- Morph **GFP** (fluorescente) que se desbloquea con un hito grande.
- Eventos de temporada: cempasúchil en Día de Muertos, papel picado en septiembre.
- Trajinera que cruza el canal al alcanzar un hito.
- El cielo según la hora de tu último commit.
- Comer un gusanito por cada PR fusionado.

## Licencia

MIT. Inspirado en [git-koi](https://github.com/yalongwastaken/git-koi).
