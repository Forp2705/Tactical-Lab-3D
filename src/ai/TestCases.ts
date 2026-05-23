export const TACTICAL_TEST_CASES = [
  {
    name: "Equipo largo al defender",
    input: `
Mi equipo juega 4-4-2.

Cuando perdemos la pelota, defendemos mucho por acumulación y poco por duelos.
Los delanteros retroceden demasiado, el bloque se hunde y terminamos defendiendo cerca del área.

Queremos que el equipo sea más corto hacia adelante y recuperar más arriba,
pero sin romper el orden defensivo.

No tenemos entrenamientos analíticos.
Solo podemos trabajar cosas aplicables en cancha durante el amistoso del miércoles contra suplentes/reserva.
`,
  },

  {
    name: "Problemas de amplitud",
    input: `
Mi equipo juega 4-4-2.

Queremos darle lateral al rival tanto para defender como para construir,
pero cuando intentamos salir jugando la cancha nos queda demasiado grande.

Los mediocampistas quedan lejos entre sí,
los delanteros se desconectan
y terminamos jugando largo más de lo deseado.
`,
  },

  {
    name: "Bloque medio demasiado pasivo",
    input: `
Mi equipo juega 4-4-2.

En bloque medio esperamos demasiado.
Los delanteros acompañan pero no terminan de activar la presión,
y los volantes retroceden antes de tiempo.

El rival progresa cómodo hasta tres cuartos
y recién ahí intentamos saltar.
`,
  },
]