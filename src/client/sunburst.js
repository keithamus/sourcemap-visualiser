/* @flow */
/* eslint-env browser */
import {
  select,
  arc,
  scaleLinear,
  scaleSqrt,
  scaleOrdinal,
  interpolate,
  hierarchy,
  partition,
  schemeCategory20,
} from 'd3'

const kibi = 1024
const toSize = (size) => {
  if (size > kibi) {
    // $FlowFixMe flow disagrees with toLocaleString args
    return `${ (size / kibi).toLocaleString({
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) }kb`
  }
  return `${ size }b`
}

/* :: type options = {
  selector: string,
  width: number,
  height: number,
} */

/* ::type node = {|
  name: string,
  children: node[],
  size?: number,
  sizeGzipped?: number,
  loc?: number,
  hasExports?: boolean,
  hasImports?: boolean,
  data?: { contents: string } 
|}*/
export default class Sunburst {
  /* :: visualization: any */
  /* :: selector: string */
  /* :: width: number */
  /* :: height: number */
  /* :: totalSize: number */
  /* :: resetHighlights: Function */
  /* :: zoomVisualizationToNode: Function */
  /* :: highlightNode: Function */
  /* :: arcSegment: any */
  /* :: radius: any */
  /* :: scaleX: any */
  /* :: scaleY: any */
  /* :: breadcrumbs: any */
  /* :: stats: any */
  /* :: color: any */

  constructor(options /* : options*/, tree /* : node*/) {
    this.highlightNode = this.highlightNode.bind(this)
    this.resetHighlights = this.resetHighlights.bind(this)
    this.zoomVisualizationToNode = this.zoomVisualizationToNode.bind(this)
    this.height = options.height
    this.width = options.width
    this.selector = options.selector
    this.radius = Math.min(this.width, this.height) / 2
    this.scaleX = scaleLinear().range([ 0, 2 * Math.PI ])
    this.scaleY = scaleSqrt().range([ 0, this.radius ])
    this.color = scaleOrdinal(schemeCategory20)
    this.arcSegment = arc()
      .startAngle((d) => Math.max(0, Math.min(2 * Math.PI, this.scaleX(d.x0))))
      .endAngle((d) => Math.max(0, Math.min(2 * Math.PI, this.scaleX(d.x1))))
      .innerRadius((d) => Math.max(0, this.scaleY(d.y0)))
      .outerRadius((d) => Math.max(0, this.scaleY(d.y1) - 1))
      .padAngle(() => 0.01)
    if (tree) {
      this.visualize(tree)
    }
  }

  visualize(tree /* : node */) {
    const el = document.querySelector(this.selector)
    if (el) {
      el.innerHTML = ''
    }
    this.initializeSvgRoot()
    this.initializeBreadcrumbTrail()
    this.initializeStats()
    this.drawArcsFromTree(tree)
    select(this.selector).on('mouseleave', this.resetHighlights)
  }

  initializeSvgRoot() {
    this.visualization = select(this.selector)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height + 30)
      .append('g')
      .attr('transform', `translate(${ this.width / 2 },${ this.height / 2 + 30 })`)
  }

  initializeBreadcrumbTrail() {
    this.breadcrumbs = select(this.selector)
      .select('svg')
      .append('g')
      .attr('width', this.width)
      .attr('height', 20)
  }

  initializeStats() {
    this.stats = document.createElement('div')
    this.stats.id = 'stats'
    const element = document.querySelector(this.selector)
    if (element) {
      element.appendChild(this.stats)
    }
  }

  drawArcsFromTree(tree /* : node */) {
    const hydratedTree = hierarchy(tree)
    hydratedTree.sum((d) => d.size)
    this.totalSize = hydratedTree.value
    this.visualization
      .selectAll('path')
      .data(partition()(hydratedTree).descendants())
      .enter()
      .append('path')
      .attr('d', this.arcSegment)
      .style('fill', (d) => this.color((d.children ? d : d.parent).data.name))
      .on('mouseover', this.highlightNode)
      .on('click', this.zoomVisualizationToNode)
      .append('title')
      .text((d) => `${ d.data.name }\n${ d.value }`)
  }

  zoomVisualizationToNode(d /* : any */) {
    this.visualization
      .transition()
      .duration(300)
      .tween('scale', () => {
        const xd = interpolate(this.scaleX.domain(), [ d.x0, d.x1 ])
        const yd = interpolate(this.scaleY.domain(), [ d.y0, 1 ])
        const yr = interpolate(this.scaleY.range(), [ d.y0 ? 20 : 0, this.radius ])
        return (t) => {
          this.scaleX.domain(xd(t))
          this.scaleY.domain(yd(t)).range(yr(t))
        }
      })
      .selectAll('path')
      .attrTween('d', (d) => () => this.arcSegment(d))
  }

  highlightNodes(shouldHighlight /* : (node) => boolean */) {
    this.visualization.selectAll('path').style('opacity', 0.3)
    this.visualization
      .selectAll('path')
      .filter(shouldHighlight)
      .style('opacity', 1)
  }

  highlightNode(d /* : any */) {
    const sequenceArray = this.getAncestors(d)
    this.updateBreadcrumbs(sequenceArray)
    this.updateStats(d)
    this.highlightNodes((node) => sequenceArray.indexOf(node) >= 0)
  }

  resetHighlights() {
    this.visualization
      .selectAll('path')
      .transition()
      .duration(500)
      .style('opacity', 1)
    this.stats.style.opacity = '1'
  }

  getAncestors(node /* : any */) {
    const path = []
    let current = node
    while (current.parent) {
      path.unshift(current)
      current = current.parent
    }
    return path
  }

  hideStats() {
    this.stats.style.opacity = '0'
  }

  updateStats(node /* : any */) {
    this.stats.style.opacity = '1'
    if ('size' in node.data) {
      const { name, loc, size, sizeGzipped } = node.data
      let extraData = ''
      if ('table' in node.data) {
        for (const row in node.data.table) {
          const value = node.data.table[row]
          extraData += `<tr><th>${ row }</th><td>${ value }</td></tr>`
        }
      }
      this.stats.innerHTML = `
        <h2>${ name }</h2>
        <em>File</em>
        <table>
          <tr>
            <th>Size</th>
            <td>${ toSize(size) } (${ toSize(sizeGzipped) } gz)</td>
          </tr><tr>
            <th>LOC</th>
            <td>${ loc.toLocaleString() }</td>
          </tr>${ extraData }
        </table>
      `
    } else {
      this.stats.innerHTML = `
        <h2>${ node.data.name }</h2>
        <em>Directory</em>
      `
    }
  }

  updateBreadcrumbs(sequence /* : [] */) {
    const width = 100
    const height = 20
    const tail = 10
    const spacing = 3
    const breadcrumbShape = `0,0 ${ width },0 ${ width + tail },${ height / 2 } ${ width },${ height } 0,${ height }`

    const breadcrumbRoot = this.breadcrumbs.selectAll('g').data(sequence, (d) => d.name + d.depth)

    const allBreadcrumbs = breadcrumbRoot.enter().append('g')

    allBreadcrumbs
      .append('polygon')
      .attr('points', (d, i) => (i > 0 ? `${ breadcrumbShape } ${ tail },${ height / 2 }` : breadcrumbShape))
      .style('fill', (d) => this.color((d.children ? d : d.parent).data.name))

    allBreadcrumbs
      .append('text')
      .attr('x', (width + tail) / 2)
      .attr('y', height / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .text((d) => d.data.name)

    allBreadcrumbs.attr('transform', (d, i) => `translate(${ i * (width + spacing) }, 0)`)

    breadcrumbRoot.exit().remove()

    this.breadcrumbs.style('visibility', '')
  }

}
