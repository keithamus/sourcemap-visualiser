/*@flow*/
const {deflate} = require('zlib')
const {promisify} = require('util')
const deflateAsync = promisify(deflate)
/*::type CompilerOutput = {|
  entry: string,
  start: Date,
  end: Date,
  includedFiles: string[],
  source: string,
  map?: string,
|}*/
/*::type node = {|
  name: string,
  children: node[],
  size?: number,
  sizeGzipped?: number,
  loc?: number,
  hasExports?: boolean,
  hasImports?: boolean,
|}*/
module.exports = async ({entry, source, map, start, end} /*:CompilerOutput*/) => {
  const files = []
  const tree /*: node */ = {name: '/', children: []}
  if (map) {
    map = JSON.parse(map)
    for (let i = 0; i < map.sources.length; i += 1) {
      const entry = map.sources[i]
      const entryContents = map.sourcesContent[i]
      const route = entry.split('/').slice(2)
      let node = tree
      files.push(entry)
      for (const name of route) {
        let newnode = !node ? null : node.children.find(child => child.name === name)
        if (!newnode) {
          newnode /*: node */ = {name, children: []}
          node.children.push(newnode)
        }
        node = newnode
      }
      const eslintDisables = (entryContents.match(/eslint-disable.*$/gm) || []).map(line => line.slice(15, -3))
      Object.assign(node, {
        size: Buffer.byteLength(entryContents),
        sizeGzipped: Buffer.byteLength(await deflateAsync(entryContents)),
        loc: entryContents.split('\n').length,
        hasExports: /^\s*export /m.test(entryContents),
        hasImports: /^\s*import /m.test(entryContents),
        isNodeModule: /node_modules/.test(entry),
        hasFlowWeak: /^\s*\/\* @flow weak \*\//.test(entryContents),
        eslintDisables
      })
    }
  }
  return {
    entry,
    start,
    end,
    size: Buffer.byteLength(source),
    sizeGzipped: Buffer.byteLength(await deflateAsync(source)),
    files,
    tree
  }
}
