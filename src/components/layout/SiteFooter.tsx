export function SiteFooter() {
  return (
    <footer className="app-footer">
      <p>
        Datos publicados por la{' '}
        <a
          href="https://datos-abiertos.venadotuerto.gob.ar/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Municipalidad de Venado Tuerto
        </a>{' '}
        bajo licencias abiertas (CC-BY / ODC-BY).
      </p>
      <p style={{ marginTop: '0.5rem' }}>
        Construido con datos del portal CKAN oficial. Dashboard por{' '}
        <a href="https://colossuslab.org" target="_blank" rel="noopener noreferrer">
          Laboratorio Colossus
        </a>{' '}
        · OpenArg.
      </p>
    </footer>
  );
}
