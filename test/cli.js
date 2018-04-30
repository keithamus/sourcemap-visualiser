/* @flow */
const { opts, cli } = require('../src/cli')
const { describe, it, beforeEach, afterEach } = require('mocha')
const { expect } = require('chai')
const { promisify } = require('util')
const { readFile, stat, unlink } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')
const { PassThrough } = require('stream')
const streamToArray = require('stream-to-array')
const readFileAsync = promisify(readFile)
const unlinkAsync = promisify(unlink)
const statAsync = promisify(stat)
const streamToString = async stream => Buffer.concat(await streamToArray(stream)).toString('utf-8')
const flipPromise = promise =>
  // eslint-disable-next-line github/no-then
  promise.then(v => {
    throw v
  }, e => e)
describe('cli', () => {
  describe('opts', () => {
    it('returns parsed options hash', () => {
      expect(opts(['a'])).to.deep.equal({
        directory: false,
        files: ['a']
      })
    })

    it('parses --dir correctly', () => {
      expect(opts(['--dir', 'foobar', 'a'])).to.deep.equal({
        directory: 'foobar',
        files: ['a']
      })
      expect(opts(['a', '--dir', 'foobar'])).to.deep.equal({
        directory: 'foobar',
        files: ['a']
      })
    })

    it('does not parse anything past --', () => {
      expect(opts(['--', '-v', '-h', '--dir', 'foobar'])).to.deep.equal({
        directory: false,
        files: ['-v', '-h', '--dir', 'foobar']
      })
    })

    it('does not parse interpolate multiple flags past --', () => {
      expect(opts(['--', '-vhd'])).to.deep.equal({
        directory: false,
        files: ['-vhd']
      })
    })
  })

  describe('cli', () => {
    let stdout
    let stderr
    let stdoutString
    let stderrString
    let compile
    beforeEach(() => {
      stdout = new PassThrough()
      stdoutString = streamToString(stdout)
      stderr = new PassThrough()
      stderrString = streamToString(stderr)
      const time = Date.now()
    })
    afterEach(async () => {
      try {
        await unlinkAsync(`${__dirname}/fixtures/a.html`)
        await unlinkAsync(`${__dirname}/fixtures/b.html`)
        await unlinkAsync(`${__dirname}/fixtures/c.html`)
      } catch(e) {}
    })

    it('writes files next to given files, if directory is false', async () => {
      await cli(stdout, stderr, {directory: false, files: [join(__dirname, 'fixtures', 'a.js')]})
      const generated = 'hello'
      expect(await readFileAsync(join(__dirname, 'fixtures', 'a.html'), 'utf-8')).to.equal(generated)
    })

    it('writes files into given directory, making it if it doesnt exist', async () => {
      const directory = join(tmpdir(), Math.floor(Math.random()*1e15).toString(16))
      const start = Date.now()
      const generated = 'hello'
      await cli(stdout, stderr, {directory, files: [ `${__dirname}/fixtures/a.js` ]})
      expect(await statAsync(directory)).to.have.property('ctimeMs').gt(start)
      expect(await readFileAsync(`${directory}/a.html`, 'utf-8')).to.equal(generated)
    })

  })

})
