// atlases/genome/shared/page-index.js
// =============================================================================
// Per-page mini-nav. Renders a small chip bar at the top of every page so
// the user can see the whole atlas at a glance, jump to a sibling page, and
// tell which pages participate in the cross-atlas selection loop.
//
// Idempotent per-root: installPageIndex(root, activePageId) is safe to call
// from every page's mount; if a `.ga-page-index` already exists inside root
// the call is a no-op.
//
// PAGE list mirrors atlases/genome/manifest.json. The capabilities array
// summarises what each page does with the cross-atlas slots:
//   - 'cand'   = highlights the active candidate row (page 5/7/8 cargo)
//   - 'chrom'  = auto-navigates to the active chrom (page 2/3/5/8/9)
//   - 'static' = pure documentation (page 1/4)
// =============================================================================

// Mirror of atlases/genome/manifest.json#pages — keep in sync when adding
// or renaming pages. Capabilities reflect what each page does with the
// cross-atlas slots once its renderer wires up:
//   - 'cand'   = highlights / consumes the active inversion candidate
//   - 'chrom'  = auto-navigates to the active chromosome
//   - 'static' = pure documentation page
// Empty array = page exists but doesn't participate in the selection loop yet.
const PAGES = [
  { id: 'page_scaffold',             stage: 'assembly',    label: 'scaffold',             capabilities: ['static'] },
  { id: 'page_assembly_stats',       stage: 'assembly',    label: 'assembly stats',       capabilities: ['chrom'] },
  { id: 'page_chromosome_overview',  stage: 'assembly',    label: 'chromosome overview',  capabilities: ['chrom'] },
  { id: 'page_assembly_methods',     stage: 'assembly',    label: 'assembly methods',     capabilities: ['static'] },
  { id: 'page_genes',                stage: 'annotation',  label: 'genes',                capabilities: ['cand', 'chrom'] },
  { id: 'page_repeats_te',           stage: 'annotation',  label: 'repeats / TE',         capabilities: ['cand'] },
  { id: 'page_variant_annotations',  stage: 'annotation',  label: 'variant annotations',  capabilities: ['cand'] },
  { id: 'page_conserved_elements',   stage: 'annotation',  label: 'conserved elements',   capabilities: ['cand', 'chrom'] },
  { id: 'page_synteny',              stage: 'comparative', label: 'synteny (focal)',      capabilities: ['chrom'] },
  { id: 'page_haplotype_synteny',    stage: 'comparative', label: 'haplotype synteny',    capabilities: ['chrom'] },
  { id: 'page_ancestral_karyotype',  stage: 'comparative', label: 'ancestral karyotype',  capabilities: [] },
  { id: 'page_orthologues',          stage: 'comparative', label: 'orthologues',          capabilities: [] },
  { id: 'page_comparative_te',       stage: 'comparative', label: 'comparative TE',       capabilities: [] },
];

const STAGE_ORDER = ['assembly', 'annotation', 'comparative'];

const CAPABILITY_LABEL = {
  cand:   { short: 'cand',  title: 'Highlights the active candidate.' },
  chrom:  { short: 'chrom', title: 'Auto-navigates to the active chromosome.' },
  static: { short: 'doc',   title: 'Documentation-only page.' },
};

export function installPageIndex(root, activePageId) {
  if (!root || typeof root.querySelector !== 'function') return;
  if (root.querySelector('.ga-page-index')) return;   // idempotent

  const nav = document.createElement('nav');
  nav.className = 'ga-page-index';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Genome Atlas page index');

  STAGE_ORDER.forEach((stage) => {
    const stagePages = PAGES.filter((p) => p.stage === stage);
    if (stagePages.length === 0) return;
    const group = document.createElement('div');
    group.className = `ga-page-index-group is-${stage}`;
    const head = document.createElement('span');
    head.className = 'ga-page-index-stage';
    head.textContent = stage;
    group.appendChild(head);

    stagePages.forEach((p) => {
      const chip = document.createElement('a');
      chip.className = 'ga-page-index-chip' + (p.id === activePageId ? ' is-active' : '');
      chip.setAttribute('href', `#${p.id}`);
      chip.setAttribute('data-ga-page-target', p.id);

      const num = document.createElement('span');
      num.className = 'ga-page-index-num';
      // Strip the "page" prefix for display so the number is the eye-catch.
      num.textContent = p.id.replace(/^page/, '');
      chip.appendChild(num);

      const lbl = document.createElement('span');
      lbl.className = 'ga-page-index-label';
      lbl.textContent = p.label;
      chip.appendChild(lbl);

      p.capabilities.forEach((cap) => {
        const meta = CAPABILITY_LABEL[cap];
        if (!meta) return;
        const cb = document.createElement('span');
        cb.className = `ga-page-index-cap is-${cap}`;
        cb.textContent = meta.short;
        cb.setAttribute('title', meta.title);
        chip.appendChild(cb);
      });

      group.appendChild(chip);
    });

    nav.appendChild(group);
  });

  // Insert at the very top of the root so it lives above .ga-content.
  if (root.firstChild) root.insertBefore(nav, root.firstChild);
  else root.appendChild(nav);
}

export const _PAGES_FOR_TESTS = PAGES;
