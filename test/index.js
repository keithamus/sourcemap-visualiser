/* @flow */
const buildHTML = require('../src')
const {
  buildTree,
  extractSourcemap,
  CANNOT_EXTRACT_SOURCEMAP,
  SOURCEMAP_IN_DIFFERENT_FILE,
  SOURCEMAP_HAS_NO_SOURCECONTENTS,
  INVALID_SOURCEMAP,
} = buildHTML
const { describe, it, beforeEach } = require('mocha')
const { expect } = require('chai')
const { readFileSync } = require('fs')
const { resolve, join } = require('path')
const dist = (file) => resolve(join(__dirname, '..', 'dist', file))
const defaultScript = readFileSync(dist('client.js'), 'utf-8')
const defaultStyle = readFileSync(dist('client.css'), 'utf-8')

describe('extractSourcemap', () => {
  it('extracts sourcemap contents from JS comment in file', () => {
    const sourcemap = extractSourcemap('\n//# sourceMappingURL=data:application/json;base64,eyJtYXBwaW5ncyI6IiJ9')
    expect(sourcemap)
      .to.be.an('object')
      .with.keys([ 'mappings' ])
      .with.property('mappings', '')
  })

  it('extracts sourcemap contents from CSS comment in file', () => {
    const sourcemap = extractSourcemap('\n/*# sourceMappingURL=data:application/json;base64,eyJtYXBwaW5ncyI6IiJ9*/')
    expect(sourcemap)
      .to.be.an('object')
      .with.keys([ 'mappings' ])
      .with.property('mappings', '')
  })

  it('throws if given a no sourceMappingURL', () => {
    expect(() => extractSourcemap('\n'))
      .to.throw(Error, /no sourceMappingURL/)
      .with.property('code', CANNOT_EXTRACT_SOURCEMAP)
  })

  it('throws if given a sourceMappingURL that points to a file', () => {
    expect(() => extractSourcemap('\n/*# sourceMappingURL=file.map'))
      .to.throw(Error, /file/)
      .with.property('code', SOURCEMAP_IN_DIFFERENT_FILE)
  })

  it('trims the file name if sourceMappingURL points to a different file', () => {
    expect(() => extractSourcemap('\n/*# sourceMappingURL=file.map\n\n'))
      .to.throw(Error, /file/)
      .with.nested.property('matches[1]', 'file.map')
  })
})

describe('buildHTML', () => {
  let sourcemap = null

  beforeEach(() => {
    sourcemap = {
      file: 'foo.js',
      sources: [ '/foo/bar.js', '/foo/baz.js' ],
      sourcesContent: [ 'aaa\nbbb', 'ccc\nddd' ],
    }
  })

  it('throws an error without sourcemap', () => {
    expect(() => buildHTML())
      .to.throw(TypeError)
      .with.property('code', INVALID_SOURCEMAP)
  })

  it('has title option which reflects title', () => {
    expect(buildHTML(sourcemap, { title: 'foo' })).to.contain('<title>foo</title>')
  })

  it('defaults title option to sourcemap.file', () => {
    expect(buildHTML(sourcemap)).to.contain('<title>foo.js</title>')
  })

  it('has style option which adds css', () => {
    expect(buildHTML(sourcemap, { style: 'body{color:black}' })).to.contain('<style>body{color:black}</style>')
  })

  it('defaults style option to client.css contents', () => {
    expect(buildHTML(sourcemap)).to.contain(`<style>${ defaultStyle }</style>`)
  })

  it('has script option which adds js', () => {
    expect(buildHTML(sourcemap, { script: 'alert(1)' }))
      .to.contain('<script type="text/javascript">\n        alert(1)\n')
  })

  it('defaults script option to client.js contents', () => {
    expect(buildHTML(sourcemap)).to.contain(`<script type="text/javascript">\n        ${ defaultScript }\n`)
  })

  it('has buildTree option which gets sourcemap and table, and is reflected in HTML', () => {
    const customBuildTree = (map, table) => {
      expect(map).to.equal(sourcemap)
      expect(table).to.be.a('function')
      return { file: sourcemap && sourcemap.file, table: table(sourcemap && sourcemap.file) }
    }
    expect(buildHTML(sourcemap, { script: '', style: '', buildTree: customBuildTree })).to.contain(
      'var data = ({\n  "file": "foo.js",\n  "table": {}\n})'
    )
  })

  it('throws an error if sourcemap has no `sourcescontents` property', () => {
    expect(() => buildHTML({ sourcemap: { sources: [] } }))
      .to.throw(TypeError)
      .with.property('code', SOURCEMAP_HAS_NO_SOURCECONTENTS)
  })
})

describe('buildTree', () => {
  let sourcemap = null

  beforeEach(() => {
    sourcemap = {
      file: 'foo.js',
      sources: [ '/foo/bar.js', '/foo/baz.js' ],
      sourcesContent: [ 'aaa\nbbb', 'ccc\nddd' ],
    }
  })

  it('returns a tree of files in the sourcemap', () => {
    expect(buildTree(sourcemap, () => ({}))).to.deep.equal({
      name: '/',
      children: [
        {
          name: 'foo',
          children: [
            {
              name: 'bar.js',
              children: [],
              contents: 'aaa\nbbb',
              size: 7,
              sizeGzipped: 15,
              loc: 2,
              table: {
                Name: '/foo/bar.js',
                Size: '7 b (15 b gz)',
              },
            },
            {
              name: 'baz.js',
              children: [],
              contents: 'ccc\nddd',
              size: 7,
              sizeGzipped: 15,
              loc: 2,
              table: {
                Name: '/foo/baz.js',
                Size: '7 b (15 b gz)',
              },
            },
          ],
        },
      ],
    })
  })

  it('calls table with node, and assigns return object to table prop', () => {
    let calls = 0
    const table = (node) => {
      calls += 1
      expect(node).to.be.an('object')
      if (calls === 1) {
        expect(node).to.deep.equal({
          name: '/foo/bar.js',
          contents: 'aaa\nbbb',
          size: 7,
          sizeGzipped: 15,
          loc: 2,
        })
      } else if (calls === 2) {
        expect(node).to.deep.equal({
          name: '/foo/baz.js',
          contents: 'ccc\nddd',
          size: 7,
          sizeGzipped: 15,
          loc: 2,
        })
      } else {
        throw new Error('table called too many times')
      }
      return {
        'LOC': node.loc,
        'Good': 'Yep',
      }
    }
    expect(buildTree(sourcemap, table)).to.deep.equal({
      name: '/',
      children: [
        {
          name: 'foo',
          children: [
            {
              name: 'bar.js',
              children: [],
              contents: 'aaa\nbbb',
              size: 7,
              sizeGzipped: 15,
              loc: 2,
              table: {
                Name: '/foo/bar.js',
                Size: '7 b (15 b gz)',
                LOC: 2,
                Good: 'Yep',
              },
            },
            {
              name: 'baz.js',
              children: [],
              contents: 'ccc\nddd',
              size: 7,
              sizeGzipped: 15,
              loc: 2,
              table: {
                Name: '/foo/baz.js',
                Size: '7 b (15 b gz)',
                LOC: 2,
                Good: 'Yep',
              },
            },
          ],
        },
      ],
    })
  })
})
