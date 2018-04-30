/* @flow */
const { Output, extractSourcemap, CANNOT_EXTRACT_SOURCEMAP, SOURCEMAP_HAS_NO_SORUCECONTENTS, INVALID_SOURCEMAP } = require('../src/')
const { describe, it, beforeEach } = require('mocha')
const { expect } = require('chai')

describe('extractSourcemap', () => {
  it('extracts sourcemap contents from JS comment in file', () => {
    const sourcemap = extractSourcemap('\n//# sourceMappingURL=data:application/json;base64,eyJtYXBwaW5ncyI6IiJ9')
    expect(sourcemap).to.be.an('object').with.keys(['mappings']).with.property('mappings', '')
  })

  it('extracts sourcemap contents from CSS comment in file', () => {
    const sourcemap = extractSourcemap('\n/*# sourceMappingURL=data:application/json;base64,eyJtYXBwaW5ncyI6IiJ9*/')
    expect(sourcemap).to.be.an('object').with.keys(['mappings']).with.property('mappings', '')
  })
})

describe('Output', () => {
  let sourcemap

  beforeEach(() => {
    sourcemap = {
      sources: ['/foo/bar.js', '/foo/baz.js'],
      sourcesContent: ['aaa\nbbb', 'ccc\nddd'],
    }
  })

  it('takes options and assigns them', () => {
    expect(new Output({ title: 'foo', sourcemap })).to.have.property('title', 'foo')
    expect(new Output({ script: 'bar', sourcemap })).to.have.property('script', 'bar')
  })

  it('throws an error without sourcemap', () => {
    expect(() => new Output()).to.throw(TypeError).with.property('code', INVALID_SOURCEMAP)
  })

  it('throws an error if sourcemap has no `sourcescontents` property', () => {
    expect(() => new Output({ sourcemap: { sources: [] } })).to.throw(TypeError).with.property('code', SOURCEMAP_HAS_NO_SORUCECONTENTS)
  })

  describe('buildTree', () => {
    
    it('returns a Promise<tree> of files in the sourcemap', async () => {
      expect(await (new Output({ sourcemap }).buildTree())).to.deep.equal({
        name: '/',
        children: [
          {
            name: 'foo' ,
            children: [
              {
                name: 'bar.js',
                children: [],
                size: 7,
                sizeGzipped: 15,
                loc: 2,
                table: {
                  'Name': '/foo/bar.js',
                  'Size': '7 b (15 b gz)'
                }
              },
              {
                name: 'baz.js',
                children: [],
                size: 7,
                sizeGzipped: 15,
                loc: 2,
                table: {
                  'Name': '/foo/baz.js',
                  'Size': '7 b (15 b gz)'
                }
              }
            ]
          }
        ]
      })
    })
  
  })

})
