/* @flow */
/* eslint-env browser */
import Sunburst from './sunburst'
const minSize = 960
document.addEventListener('DOMContentLoaded', () => {
  const idealHeight = Math.min(window.innerHeight - (document.body ? document.body.clientHeight : 0), minSize)
  const graph = new Sunburst({ selector: '#graph', width: minSize, height: idealHeight }, window.data)
  document.addEventListener('resize', () => {
    graph.visualize(window.data)
  })
})
