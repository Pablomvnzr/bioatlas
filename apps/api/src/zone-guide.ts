import type { ZoneGuide } from '@bioatlas/contracts';
const sources = {
  culture: {
    title: 'Plan Municipal de Cultura de Valdivia 2023–2026',
    url: 'https://www.cultura.gob.cl/redcultura/wp-content/uploads/sites/69/2024/03/pmc-valdivia-2023-2026.pdf#page=107',
  },
  plants: {
    title: 'Municipalidad de Valdivia · Flora y fauna',
    url: 'https://munivaldivia.cl/flora-y-fauna/',
  },
  wetlands: {
    title: 'Municipalidad / UACh · Catastro de humedales',
    url: 'https://munivaldivia.cl/repositorio-documental/',
  },
  park: {
    title: 'Parque Urbano El Bosque · Sitio de su administración',
    url: 'https://parqueurbano.cl/',
  },
  angachilla: {
    title: 'Corporación Humedales de Angachilla · El santuario',
    url: 'https://angachillasantuario.cl/el-santuario/',
  },
  teja: {
    title: 'Consejo de Monumentos Nacionales · Casa Anwandter',
    url: 'https://www.monumentos.gob.cl/monumentos/monumentos-historicos/inmueble-ubicado-en-isla-teja',
  },
  garden: {
    title: 'Universidad Austral de Chile · Jardín Botánico',
    url: 'https://ciencias.uach.cl/catalogo/',
  },
  collico: {
    title: 'Municipalidad de Valdivia · Parque Silo de Collico',
    url: 'https://munivaldivia.cl/2026/09/08/silo-de-collico-municipio-inauguro-un-nuevo-parque-para-valdivia/',
  },
  coast: {
    title: 'Museo de Sitio Castillo de Niebla',
    url: 'https://www.castillodeniebla.gob.cl/castillo-de-niebla',
  },
  guacamayo: {
    title: 'Ministerio del Medio Ambiente · Expediente Bosque–Miraflores–Las Mulatas–Guacamayo',
    url: 'https://sistemahumedales.mma.gob.cl/HumedalesUrbanos/DetailsPublico/26',
  },
};
type Section = ZoneGuide['sections'][number];
const section = (
  id: Section['id'],
  title: string,
  heading: string,
  text: string,
  source: keyof typeof sources,
  scope: Section['scope'] = 'sector',
): Section => ({ id, title, heading, text, scope, sources: [sources[source]] });
export function getZoneGuide(id: string, name: string): ZoneGuide {
  const sections: Section[] = [
    section(
      'culture',
      'Historia y cultura',
      'Valdivia y su patrimonio vivo',
      'La consulta ciudadana del Plan Municipal de Cultura reconoce los ríos, humedales, árboles y borde fluvial como parte del patrimonio local. También recoge oficios y expresiones como la navegación, la cestería y la tradición de guardar semillas. Este contexto corresponde a la comuna: todavía no contamos con una reseña histórica verificada de este sector.',
      'culture',
      'commune',
    ),
    section(
      'trees',
      'Árboles',
      'Bosques de la comuna de Valdivia',
      'La Municipalidad menciona roble, coigüe, olivillo, mañío, laurel y tineo entre los árboles de los bosques de la comuna. Esta referencia ayuda a conocer el paisaje regional, pero no confirma que todos estén presentes dentro de esta zona. El inventario arbóreo específico sigue pendiente.',
      'plants',
      'commune',
    ),
    section(
      'flora',
      'Flora y hábitats',
      'Bosques y humedales',
      'La Municipalidad describe una vegetación de selva valdiviana con varios estratos. El catastro municipal, desarrollado por la Universidad Austral de Chile, permite estudiar los humedales urbanos de manera más localizada. Para conocer presencias registradas en este polígono, consulta también sus avistamientos.',
      'plants',
      'commune',
    ),
  ];
  sections[2].sources.push(sources.wetlands);
  const replace = (s: Section) => {
    sections[sections.findIndex((x) => x.id === s.id)] = s;
  };
  if (id === 'inat-199913') {
    replace(
      section(
        'culture',
        'Historia y cultura',
        'Un espacio de conservación comunitaria',
        'El Parque Urbano El Bosque está administrado por el Comité Ecológico Lemu Lahuen, una organización comunitaria de vecinos. El lugar combina conservación, educación ambiental y encuentro con la comunidad.',
        'park',
      ),
    );
    replace(
      section(
        'trees',
        'Árboles',
        'Robles del parque',
        'La administración describe renovales de roble (Nothofagus obliqua) en el Sendero de los Robles. También destaca un ejemplar conocido como Roble Abuelo, al que atribuye más de cien años. Esta descripción corresponde al parque, no a toda la macrozona que lo rodea.',
        'park',
      ),
    );
    replace(
      section(
        'flora',
        'Flora y hábitats',
        'Un bosque y un humedal dentro de la ciudad',
        'El parque conserva un fragmento de bosque nativo y humedal en el sector El Bosque. Sus senderos permiten conocer ambos ambientes. Observa la vegetación sin extraer plantas, hongos ni otros productos del área de conservación.',
        'park',
      ),
    );
  } else if (id === 'inat-182731') {
    replace(
      section(
        'culture',
        'Historia y cultura',
        'Humedales y organización social',
        'La Corporación Humedales de Angachilla vincula el santuario con el patrimonio natural y cultural de Valdivia y describe una administración integrada por organizaciones sociales del entorno. El Plan Municipal de Cultura también reconoce a las Arpilleristas de Angachilla dentro del patrimonio inmaterial identificado por la ciudadanía.',
        'angachilla',
      ),
    );
    sections[0].sources.push(sources.culture);
    replace(
      section(
        'flora',
        'Flora y hábitats',
        'Vegetación acuática de Angachilla',
        'La administración del santuario identifica a la totora (Schoenoplectus californicus) como la formación vegetal de mayor extensión. Describe una red de ambientes de agua dulce y de influencia mareal. Sus plantas aportan refugio para la fauna y ayudan a retener sedimentos y nutrientes.',
        'angachilla',
      ),
    );
  } else if (name === 'TEJA') {
    replace(
      section(
        'culture',
        'Historia y cultura',
        'Casa Anwandter y memoria de Isla Teja',
        'La Casa Anwandter, en Isla Teja, es un referente patrimonial asociado a la historia de Carlos Anwandter y al Museo Histórico y Antropológico. La ficha del Consejo de Monumentos Nacionales permite conocer ese vínculo con la historia de Valdivia.',
        'teja',
      ),
    );
    replace(
      section(
        'flora',
        'Flora y hábitats',
        'Aprender sobre plantas en el Jardín Botánico',
        'El Jardín Botánico de la Universidad Austral ofrece un catálogo de especies y desarrolla trabajo de conservación, investigación y educación. Sus colecciones son una referencia para conocer plantas; una especie cultivada en el jardín no demuestra su presencia silvestre en toda Isla Teja.',
        'garden',
      ),
    );
  } else if (name === 'COLLICO') {
    replace(
      section(
        'culture',
        'Historia y cultura',
        'El Silo de Collico como espacio comunitario',
        'La Municipalidad documentó en septiembre de 2026 la inauguración del Parque Silo de Collico, tras trabajos de habilitación y mejoramiento. Es un antecedente del uso comunitario de este espacio del sector.',
        'collico',
      ),
    );
  } else if (name === 'COSTA') {
    replace(
      section(
        'culture',
        'Historia y cultura',
        'La costa y el Castillo de Niebla',
        'El Museo de Sitio Castillo de Niebla permite conocer la historia de la fortificación y sus relaciones con la bahía y otros puertos. Se presenta como contexto patrimonial del sector costero; el recinto del castillo y la macrozona del mapa no tienen los mismos límites.',
        'coast',
      ),
    );
  } else if (name === 'GUACAMAYO') {
    replace(
      section(
        'flora',
        'Flora y hábitats',
        'El sistema de humedales del sector',
        'El Ministerio del Medio Ambiente publica el expediente Bosque–Miraflores–Las Mulatas–Guacamayo, con antecedentes de sus ambientes y transformación del paisaje. Sus límites deben consultarse en ese expediente: no equivalen automáticamente al polígono de la macrozona Guacamayo.',
        'guacamayo',
      ),
    );
  }
  return { reviewedAt: '2026-11-04', sections };
}
