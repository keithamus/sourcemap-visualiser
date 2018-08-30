const { deflateSync } = require('zlib')
const { readFileSync } = require('fs')
const { resolve, join } = require('path')
const { parse } = require('url')
const dist = (file) => resolve(join(__dirname, '..', 'dist', file))
const defaultScript = readFileSync(dist('client.js'), 'utf-8')
const defaultStyle = readFileSync(dist('client.css'), 'utf-8')
const isPlainObject = (objectLike) => Boolean(objectLike) && Object.getPrototypeOf(objectLike) === Object.prototype
const stringFromBufferLike = (bufferLike) => Buffer.from(bufferLike).toString('utf-8')

const gigabytes = 1073741824
const megabytes = 1048576
const kilobytes = 1024
const friendlyBytes = (bytes) => {
  if (bytes > gigabytes) {
    return `${ (bytes / gigabytes).toFixed(2) } gb`
  }
  if (bytes > megabytes) {
    return `${ (bytes / megabytes).toFixed(2) } mb`
  }
  if (bytes > kilobytes) {
    return `${ (bytes / kilobytes).toFixed(2) } kb`
  }
  return `${ bytes } b`
}

const CANNOT_EXTRACT_SOURCEMAP = Symbol('CANNOT_EXTRACT_SOURCEMAP')
const SOURCEMAP_IN_DIFFERENT_FILE = Symbol('SOURCEMAP_IN_DIFFERENT_FILE')
const SOURCEMAP_HAS_NO_SOURCECONTENTS = Symbol('SOURCEMAP_HAS_NO_SOURCECONTENTS')
const INVALID_SOURCEMAP = Symbol('INVALID_SOURCEMAP')
const sourceMapRegExp = /^(?:\/\/|\/\*)#\s*sourceMappingURL\s*=([^*\s]+)\s*(?:\*\/)?$/m
const dataPrelude = 'data:application/json;base64,'
const extractSourcemap = (code) => {
  const matches = stringFromBufferLike(code).match(sourceMapRegExp)
  if (!matches || matches.length !== 2) {
    throw Object.assign(
      new Error(`Saw ${ matches ? 'too many' : 'no' } sourceMappingURL comments (${ matches || 0 } found)`),
      { code: CANNOT_EXTRACT_SOURCEMAP, matches }
    )
  }
  if (matches[1].startsWith(dataPrelude) === false) {
    throw Object.assign(
      new Error('Sourcemap refers to different file. Refusing to read other file'),
      { code: SOURCEMAP_IN_DIFFERENT_FILE, matches }
    )
  }
  return JSON.parse(Buffer.from(matches[1].substr(dataPrelude.length), 'base64').toString('utf-8'))
}


const defaultBuildTree = (sourcemap, table) => {
  const tree = { name: '/', children: [] }
  for (let i = 0; i < sourcemap.sources.length; i += 1) {
    const name = sourcemap.sources[i]
    const contents = sourcemap.sourcesContent[i]
    const pathParts = parse(name).pathname.split('/')
    let node = tree
    for (const part of pathParts) {
      if (part === '' || part === '/') {
        continue
      }
      let currentNode = node.children.find((child) => child.name === part)
      if (!currentNode) {
        currentNode = { name: part, children: [] }
        node.children.push(currentNode)
      }
      node = currentNode
    }
    const size = Buffer.byteLength(contents)
    const sizeGzipped = Buffer.byteLength(deflateSync(contents))
    const loc = contents.split('\n').length
    Object.assign(node, {
      size,
      sizeGzipped,
      loc,
      contents,
      table: Object.assign({
        'Name': name,
        'Size': `${ friendlyBytes(size) } (${ friendlyBytes(sizeGzipped) } gz)`,
      }, table({ name, contents, size, sizeGzipped, loc })),
    })
  }
  return tree
}


const escapeRg = /["&'<>`]/g
const escapeMap = {
  '"': '&quot;',
  '&': '&amp;',
  '\'': '&#x27;',
  '<': '&lt;',
  '>': '&gt;',
  '`': '&#x60;',
}
const escape = (str) => str.replace(escapeRg, (symbol) => escapeMap[symbol])
const jsonStringifyEscaper = (key, value) => {
  if (typeof value === 'string') {
    return escape(value)
  }
  return value
}

module.exports = (sourcemap, {
  title = '',
  script = defaultScript,
  style = defaultStyle,
  buildTree = defaultBuildTree,
  table = () => ({}),
} = {}) => {
  if (!isPlainObject(sourcemap)) {
    try {
      sourcemap = JSON.parse(stringFromBufferLike(sourcemap))
    } catch (jsonParseError) {
      throw Object.assign(
        new TypeError('sourcemap must be a valid Object or a JSON Buffer.fromable'),
        { code: INVALID_SOURCEMAP }
      )
    }
  }
  if (!sourcemap.sources || !sourcemap.sourcesContent || sourcemap.sources.length !== sourcemap.sourcesContent.length) {
    throw Object.assign(
      new TypeError('sourcemap does not countain sourceContents'),
      { code: SOURCEMAP_HAS_NO_SOURCECONTENTS }
    )
  }
  return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>${ title || sourcemap.file }</title>
      <style>${ style }</style>
    </head>
    <body>
      <h1>${ title || sourcemap.file }</h1>
      <input id="search" type="text"/>
      <div id="graph"></div>
      <script type="text/javascript">
        ${ script }
        ;;
        var data = (${ (JSON.stringify(buildTree(sourcemap, table), jsonStringifyEscaper, 2)) })
      </script>
    </body>
    </html>
  `
}

module.exports.buildTree = defaultBuildTree
module.exports.extractSourcemap = extractSourcemap
module.exports.CANNOT_EXTRACT_SOURCEMAP = CANNOT_EXTRACT_SOURCEMAP
module.exports.SOURCEMAP_IN_DIFFERENT_FILE = SOURCEMAP_IN_DIFFERENT_FILE
module.exports.SOURCEMAP_HAS_NO_SOURCECONTENTS = SOURCEMAP_HAS_NO_SOURCECONTENTS
module.exports.INVALID_SOURCEMAP = INVALID_SOURCEMAP
