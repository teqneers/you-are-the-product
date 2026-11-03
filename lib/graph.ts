import * as d3 from 'd3';
import './graph.css';
import { BUCKET_LABELS, BUCKET_ORDER, INFRASTRUCTURE, type Bucket } from './buckets';
import { t } from './i18n';
import type { Icons } from './icons';
import { isVisible, type Settings } from './settings';
import { ownerOf, type State } from './state';

type Kind = 'site' | 'tracker' | 'unknown' | 'infra';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  kind: Kind;
  /** Sites for a party node, visits for a site node. */
  weight: number;
  /** Party node: sites it was seen on. Site node: parties seen on it. */
  related: Set<string>;
  /** Circle radius, set once all weights are known. */
  r?: number;
  icon?: string;
  /** Party nodes: most invasive group among their domains. */
  bucket?: Bucket;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
}

export type GroupBy = 'company' | 'domain';

const color: Record<Kind, string> = {
  site: 'var(--site)',
  tracker: 'var(--tracker)',
  unknown: 'var(--unknown)',
  infra: 'var(--infra)',
};

const kindOf = (b: Bucket): Kind => (b === 'unknown' ? 'unknown' : INFRASTRUCTURE.includes(b) ? 'infra' : 'tracker');

const radius = (d: Node) => d.r ?? 10;
const ICON_PLATE = '#e8eaf0';

/** Free space around a site's frame that companies keep clear of. */
const SITE_GAP = 26;

/** Radius a node claims for itself: its size, plus a margin around sites (squares reach further). */
const clearance = (d: Node) => (d.kind === 'site' ? radius(d) * 1.42 + SITE_GAP : radius(d) + 3);

const PARTY_MIN_R = 9;
const PARTY_MAX_R = 28;

/**
 * Third parties grow with the share of visited sites they appear on, relative to the most widespread one,
 * so the company that follows you everywhere stands out (up to PARTY_MAX_R). Sites grow slightly with visits.
 */
function sizeNodes(nodes: Iterable<Node>) {
  const all = [...nodes];
  const parties = all.filter((n) => n.kind !== 'site');
  const most = Math.max(1, ...parties.map((n) => n.weight));
  for (const n of all) {
    if (n.kind === 'site') n.r = Math.min(20 + Math.sqrt(n.weight) * 2, 28);
    else n.r = PARTY_MIN_R + (most > 1 ? ((n.weight - 1) / (most - 1)) ** 0.7 : 0) * (PARTY_MAX_R - PARTY_MIN_R);
  }
}

/** Hover this long before the first tooltip appears. */
const TIP_DELAY_MS = 500;
/** After a tooltip closes, others open instantly for this long. */
const TIP_WARM_MS = 1500;

function buildGraph(state: State, groupBy: GroupBy, icons: Icons, settings: Settings) {
  const nodes = new Map<string, Node>();
  const links = new Map<string, Link>();

  for (const [site, visit] of Object.entries(state.sites)) {
    nodes.set(`s:${site}`, {
      id: `s:${site}`,
      label: site,
      kind: 'site',
      weight: visit.visits,
      related: new Set(),
      icon: icons[site] || undefined,
    });
  }
  for (const [domain, party] of Object.entries(state.parties)) {
    if (!isVisible(party.bucket, settings)) continue;
    // Data from before groups existed: known companies count as trackers.
    const bucket: Bucket = party.bucket ?? (party.company ? 'ads' : 'unknown');
    const label = groupBy === 'company' ? ownerOf(domain, party.company) : domain;
    const id = `p:${label}`;
    if (!nodes.has(id)) nodes.set(id, { id, label, kind: kindOf(bucket), bucket, weight: 0, related: new Set() });
    const node = nodes.get(id)!;
    if (BUCKET_ORDER.indexOf(bucket) < BUCKET_ORDER.indexOf(node.bucket!)) {
      node.bucket = bucket;
      node.kind = kindOf(bucket);
    }
    node.icon ||= icons[party.icon ?? domain] || icons[domain] || undefined;
    for (const site of Object.keys(party.sites)) {
      node.related.add(site);
      const siteNode = nodes.get(`s:${site}`);
      if (!siteNode) continue;
      siteNode.related.add(label);
      links.set(`${site}|${id}`, { source: siteNode.id, target: id });
    }
  }
  for (const n of nodes.values()) if (n.kind !== 'site') n.weight = n.related.size;
  sizeNodes(nodes.values());

  return { nodes: [...nodes.values()], links: [...links.values()] };
}

/** Text for the hover tooltip. */
function describe(d: Node, siteCount: number) {
  const list = [...d.related].slice(0, 8).join(', ') + (d.related.size > 8 ? ', …' : '');
  if (d.kind === 'site') return { title: d.label, text: t('tip.site', { n: d.related.size, list }) };
  const what = d.bucket === 'unknown' ? t('tip.unknown') : BUCKET_LABELS[d.bucket ?? 'unknown'];
  return { title: d.label, text: t('tip.party', { what, n: d.related.size, total: siteCount, count: siteCount, list }) };
}

const LEGEND_KEY = 'graph-legend-open';

/** A "Legende" button in the graph's corner that shows what colours, sizes and rings mean. */
function addLegend(container: HTMLElement) {
  const dot = (cssColor: string, ring = false) => {
    const i = document.createElement('i');
    i.className = ring ? 'dot ring' : 'dot';
    i.style.setProperty('--c', cssColor);
    return i;
  };
  const square = () => {
    const i = document.createElement('i');
    i.className = 'dot square';
    i.style.setProperty('--c', 'var(--site)');
    return i;
  };
  const row = (marker: HTMLElement | string, text: string) => {
    const li = document.createElement('li');
    li.append(marker, text);
    return li;
  };
  const panel = document.createElement('ul');
  panel.className = 'legend';
  panel.append(
    row(square(), t('legend.site')),
    row(dot('var(--tracker)'), t('legend.tracker', { kinds: trackingLabels() })),
    row(dot('var(--unknown)'), t('legend.unknown')),
    row(dot('var(--infra)'), t('legend.infra')),
    row(dot('var(--tracker)', true), t('legend.ring')),
    row(dot('var(--text)', true), t('legend.active')),
    row(dot('var(--tracker)'), t('legend.circles')),
    row('⬤ ', t('legend.size')),
    row('— ', t('legend.line')),
  );
  const button = document.createElement('button');
  button.className = 'legend-button';
  button.textContent = t('legend.button');
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    button.classList.toggle('active', open);
    try {
      localStorage.setItem(LEGEND_KEY, open ? '1' : '');
    } catch {}
  };
  button.addEventListener('click', () => setOpen(panel.hidden !== false));
  let open = false;
  try {
    open = localStorage.getItem(LEGEND_KEY) === '1';
  } catch {}
  setOpen(open);
  container.classList.add('graph-container');
  container.append(button, panel);
}

const trackingLabels = () =>
  (['ads', 'analytics', 'social', 'session', 'fraud', 'tracker'] as Bucket[]).map((b) => BUCKET_LABELS[b]).join(', ');

/** Force graph of visited sites and the third parties loaded on them. */
export function createGraph(
  element: SVGSVGElement,
  options: { onSelect?: (label: string, kind: 'site' | 'party') => void } = {},
) {
  if (element.parentElement) addLegend(element.parentElement);
  const svg = d3.select(element).classed('graph', true);
  const root = svg.append('g');
  const linkLayer = root.append('g');
  const nodeLayer = root.append('g');
  // Until the reader zooms or pans by hand, the view keeps fitting the whole graph.
  let userZoomed = false;
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('start', (e) => {
      cancelTip();
      if (e.sourceEvent) userZoomed = true;
    })
    .on('zoom', (e) => root.attr('transform', e.transform));
  svg.call(zoom).on('dblclick.zoom', null);
  // Double-click returns to the fitted view.
  svg.on('dblclick', () => {
    userZoomed = false;
    fit(true);
  });

  /** Scales and centres the view so all nodes fit, with a margin; never zooms in beyond 2.5×. */
  function fit(animate: boolean) {
    const nodes = simulation.nodes();
    if (!nodes.length || userZoomed) return;
    const width = element.clientWidth;
    const height = element.clientHeight;
    const pad = 40;
    const xs = nodes.map((n) => n.x ?? 0);
    const ys = nodes.map((n) => n.y ?? 0);
    const r = Math.max(...nodes.map(clearance));
    const [x0, x1, y0, y1] = [Math.min(...xs) - r, Math.max(...xs) + r, Math.min(...ys) - r, Math.max(...ys) + r];
    const k = Math.min(2.5, (width - 2 * pad) / (x1 - x0 || 1), (height - 2 * pad) / (y1 - y0 || 1));
    const transform = d3.zoomIdentity.scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    (animate ? svg.transition().duration(600) : svg).call(zoom.transform as any, transform);
  }

  const simulation = d3
    .forceSimulation<Node, Link>()
    // Companies sit on a ring around each site, at least SITE_GAP away from its frame.
    .force(
      'link',
      d3
        .forceLink<Node, Link>()
        .id((d) => d.id)
        .distance((l) => clearance(l.source as Node) + clearance(l.target as Node) + 12),
    )
    .force('charge', d3.forceManyBody<Node>().strength((d) => (d.kind === 'site' ? -400 : -40 - radius(d) * 6)))
    .force('collide', d3.forceCollide<Node>().radius(clearance).iterations(2))
    .force('x', d3.forceX().strength(0.03))
    .force('y', d3.forceY().strength(0.03));

  let lastGroupBy: GroupBy | undefined;

  // The native <title> tooltip appears only after about a second, so the graph shows its own:
  // a short delay for the first one, then instant while moving from bubble to bubble.
  const tip = document.createElement('div');
  tip.className = 'graph-tip';
  tip.hidden = true;
  document.body.append(tip);
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let warmUntil = 0;
  let lastPointer = { x: 0, y: 0 };
  const placeTip = () => {
    const x = Math.min(lastPointer.x + 12, innerWidth - tip.offsetWidth - 8);
    tip.style.transform = `translate(${Math.max(8, x)}px, ${lastPointer.y + 14}px)`;
  };
  const trackPointer = (e: PointerEvent) => {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (!tip.hidden) placeTip();
  };
  const showTip = (d: Node, siteCount: number) => {
    const { title, text } = describe(d, siteCount);
    tip.replaceChildren(Object.assign(document.createElement('strong'), { textContent: title }), document.createElement('br'), text);
    tip.hidden = false;
    placeTip();
  };
  let dragging = false;
  /** Moving the graph or a bubble closes the tooltip and starts the delay over. */
  const cancelTip = () => {
    clearTimeout(showTimer);
    tip.hidden = true;
    warmUntil = 0;
  };
  const hideTip = () => {
    clearTimeout(showTimer);
    if (tip.hidden) return;
    tip.hidden = true;
    warmUntil = Date.now() + TIP_WARM_MS;
  };

  /** Redraws the graph, keeping the positions of nodes that already exist. `highlight` marks one site. */
  function render(state: State, groupBy: GroupBy, icons: Icons, settings: Settings, highlight?: string) {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (!width || !height) return;
    svg.attr('viewBox', [-width / 2, -height / 2, width, height]);
    // In a tall, narrow side panel, let clusters spread vertically instead of piling up in the middle.
    const tall = height > width * 1.3;
    simulation.force<d3.ForceX<Node>>('x')!.strength(tall ? 0.1 : 0.03);
    simulation.force<d3.ForceY<Node>>('y')!.strength(tall ? 0.01 : 0.03);

    if (groupBy !== lastGroupBy) simulation.nodes([]);
    lastGroupBy = groupBy;
    const previous = new Map(simulation.nodes().map((n) => [n.id, n]));
    const { nodes, links } = buildGraph(state, groupBy, icons, settings);
    const siteCount = Object.keys(state.sites).length;
    for (const n of nodes) {
      const old = previous.get(n.id);
      if (old) Object.assign(n, { x: old.x, y: old.y, vx: old.vx, vy: old.vy });
    }

    linkLayer
      .selectAll('line')
      .data(links, (d: any) => `${d.source.id ?? d.source}|${d.target.id ?? d.target}`)
      .join('line');

    const node = nodeLayer
      .selectAll<SVGGElement, Node>('g')
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g');
        // Visited sites are rounded squares, third parties circles, so the sites stay easy to find.
        g.append((d) => document.createElementNS('http://www.w3.org/2000/svg', d.kind === 'site' ? 'rect' : 'circle'));
        g.append('image');
        return g;
      });
    // With a favicon the shape becomes a coloured frame around the logo.
    node
      .select<SVGElement>('circle, rect')
      .attr('r', radius)
      .attr('x', (d) => -radius(d))
      .attr('y', (d) => -radius(d))
      .attr('width', (d) => radius(d) * 2)
      .attr('height', (d) => radius(d) * 2)
      .attr('rx', (d) => radius(d) * 0.3)
      // Light behind logos: many are dark on a transparent background (the black "T" of nytimes.com).
      .attr('fill', (d) => (d.icon ? ICON_PLATE : color[d.kind]))
      .attr('stroke', (d) => (d.kind === 'site' ? color.site : d.icon ? color[d.kind] : null))
      .attr('stroke-width', (d) => (d.kind === 'site' ? 4 : d.icon ? 3 : null))
      .classed('highlight', (d) => d.kind === 'site' && d.label === highlight);
    // Sites on top of the companies around them.
    node.filter((d) => d.kind === 'site').raise();
    node
      .select('image')
      .attr('href', (d) => d.icon ?? null)
      .attr('width', (d) => (d.icon ? (radius(d) - 2) * 1.3 : 0))
      .attr('height', (d) => (d.icon ? (radius(d) - 2) * 1.3 : 0))
      .attr('x', (d) => -(radius(d) - 2) * 0.65)
      .attr('y', (d) => -(radius(d) - 2) * 0.65);
    node
      .on('pointerenter', (e: PointerEvent, d) => {
        trackPointer(e);
        if (dragging) return;
        clearTimeout(showTimer);
        if (Date.now() < warmUntil) showTip(d, siteCount);
        else showTimer = setTimeout(() => showTip(d, siteCount), TIP_DELAY_MS);
      })
      .on('pointermove', trackPointer)
      .on('pointerleave', hideTip)
      // A click without dragging selects the node.
      .on('click', (_, d) => options.onSelect?.(d.label, d.kind === 'site' ? 'site' : 'party'));
    node.call(
      d3
        .drag<SVGGElement, Node>()
        .on('start', (e, d) => {
          dragging = true;
          cancelTip();
          if (!e.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (e, d) => {
          d.fx = e.x;
          d.fy = e.y;
        })
        .on('end', (e, d) => {
          dragging = false;
          if (!e.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

    simulation.nodes(nodes).on('tick', () => {
      linkLayer
        .selectAll<SVGLineElement, Link>('line')
        .attr('x1', (d) => (d.source as Node).x!)
        .attr('y1', (d) => (d.source as Node).y!)
        .attr('x2', (d) => (d.target as Node).x!)
        .attr('y2', (d) => (d.target as Node).y!);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });
    simulation.force<d3.ForceLink<Node, Link>>('link')!.links(links);
    simulation.on('end', () => fit(true));
    simulation.alpha(previous.size ? 0.3 : 1).restart();
  }

  /**
   * PNG of the graph as currently shown. Colours come from CSS variables, which an exported SVG
   * cannot see, so the computed colours are copied onto a clone first.
   */
  async function snapshot(caption: string, scale = 2): Promise<Blob> {
    const { width, height } = element.getBoundingClientRect();
    const clone = element.cloneNode(true) as SVGSVGElement;
    const originals = element.querySelectorAll<SVGElement>('*');
    clone.querySelectorAll<SVGElement>('*').forEach((node, i) => {
      const style = getComputedStyle(originals[i]!);
      for (const prop of ['fill', 'stroke', 'stroke-width', 'opacity'] as const) {
        node.style.setProperty(prop, style.getPropertyValue(prop));
      }
    });
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    const ns = 'http://www.w3.org/2000/svg';
    const background = document.createElementNS(ns, 'rect');
    const [x, y] = (clone.getAttribute('viewBox') ?? '0 0').split(/[ ,]+/).map(Number);
    Object.entries({ x, y, width, height, fill: getComputedStyle(document.body).backgroundColor }).forEach(([k, v]) =>
      background.setAttribute(k, String(v)),
    );
    clone.prepend(background);

    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = getComputedStyle(document.body).color;
      ctx.fillText(caption, 20, 34);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), 'image/png'),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return { render, snapshot };
}
