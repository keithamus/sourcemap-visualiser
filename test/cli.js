/* @flow */
const { opts, cli } = require('../src/cli')
const buildHTML = require('../src')
const { describe, it, beforeEach, afterEach } = require('mocha')
const { expect } = require('chai')
const { promisify } = require('util')
const { writeFile, readFile, stat, unlink } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')
const { randomBytes } = require('crypto')
const { PassThrough } = require('stream')
const streamToArray = require('stream-to-array')
const readFileAsync = promisify(readFile)
const writeFileAsync = promisify(writeFile)
const unlinkAsync = promisify(unlink)
const statAsync = promisify(stat)
const streamToString = async (stream) => Buffer.concat(await streamToArray(stream)).toString('utf-8')
const fixture = (file) => join(__dirname, 'fixtures', file)
describe('cli', () => {
  describe('opts', () => {
    it('returns parsed options hash', () => {
      expect(opts([ 'a' ])).to.deep.equal({
        directory: false,
        files: [ 'a' ],
        title: '',
      })
    })

    it('parses --dir correctly', () => {
      expect(opts([ '--dir', 'foobar', 'a' ])).to.deep.equal({
        directory: 'foobar',
        files: [ 'a' ],
        title: '',
      })
      expect(opts([ 'a', '--dir', 'foobar' ])).to.deep.equal({
        directory: 'foobar',
        files: [ 'a' ],
        title: '',
      })
    })

    it('does not parse anything past --', () => {
      expect(opts([ '--', '-v', '-h', '--dir', 'foobar' ])).to.deep.equal({
        directory: false,
        files: [ '-v', '-h', '--dir', 'foobar' ],
        title: '',
      })
    })

    it('does not parse interpolate multiple flags past --', () => {
      expect(opts([ '--', '-vhd' ])).to.deep.equal({
        directory: false,
        files: [ '-vhd' ],
        title: '',
      })
    })
  })

  describe('cli', () => {
    let stdout = new PassThrough()
    let stderr = new PassThrough()
    let stdoutString = null
    let stderrString = null
    let sourcemap = null
    beforeEach(async () => {
      stdout = new PassThrough()
      stdoutString = streamToString(stdout)
      stderr = new PassThrough()
      stderrString = streamToString(stderr)
      sourcemap = {
        file: 'foo.js',
        sources: [ '/foo/bar.js', '/foo/baz.js' ],
        sourcesContent: [ 'aaa\nbbb', 'ccc\nddd' ],
      }
      const sourceMapPrefix = '//#sourceMappingURL=data:application/json;base64,'
      const sourcemapString = Buffer.from(JSON.stringify(sourcemap)).toString('base64')
      await writeFileAsync(fixture('a.js'), `${ sourceMapPrefix }${ sourcemapString }`)
    })
    afterEach(async () => {
      try {
        await unlinkAsync(fixture('a.html'))
        await unlinkAsync(fixture('b.html'))
        await unlinkAsync(fixture('c.html'))
      } catch (unlinkError) {
        // Ignore
      }
    })

    it('writes files next to given files, if directory is false', async () => {
      await cli(stdout, stderr, { directory: false, files: [ fixture('a.js') ], title: 'Foo' })
      const generated = buildHTML(sourcemap, { title: 'Foo' })
      expect(await readFileAsync(fixture('a.html'), 'utf-8')).to.equal(generated)
      stderr.end()
      stdout.end()
      expect(await stderrString).to.match(/Finished in \d{1,3}ms/)
      expect(await stdoutString).to.equal('')
    })

    it('writes files into given directory, making it if it doesnt exist', async () => {
      const randomFolderLength = 10
      const directory = join(tmpdir(), randomBytes(randomFolderLength).toString('hex'))
      const start = Date.now()
      await cli(stdout, stderr, { directory, files: [ fixture('a.js') ], title: 'Foo' })
      const generated = buildHTML(sourcemap, { title: 'Foo' })
      expect(await statAsync(directory)).to.have.property('ctimeMs').gt(start)
      expect(await readFileAsync(`${ directory }/a.html`, 'utf-8')).to.equal(generated)
    })
  })
})
