/* @flow */
/* eslint-env browser */
import Sunburst from './sunburst'
const minSize = 960
const debounceTime = 300
const defaultFilterFunction = (node, input) => Boolean(node.data.contents && new RegExp(input).test(node.data.contents))

document.addEventListener('DOMContentLoaded', () => {
  const idealHeight = Math.min(window.innerHeight - (document.body ? document.body.clientHeight : 0), minSize)
  const graph = new Sunburst({ selector: '#graph', width: minSize, height: idealHeight }, window.data)
  document.addEventListener('resize', () => {
    graph.visualize(window.data)
  })
  const filterFunction = window.filterFunction || defaultFilterFunction
  const searchInput = document.getElementById('search')
  if (searchInput instanceof HTMLInputElement) {
    let time = Date.now()
    searchInput.addEventListener('input', () => {
      if (Date.now() - time < debounceTime) {
        return
      }
      time = Date.now()
      graph.hideStats()
      graph.updateBreadcrumbs([])
      graph.highlightNodes((node) => filterFunction(node, searchInput.value))
    })
  }
})

