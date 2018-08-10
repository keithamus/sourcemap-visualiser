#!/usr/bin/env node
/* @flow*/
const pkg = require('../package.json')
const visualiser = require('./')
const { promisify } = require('util')
const { access, mkdir, writeFile, readFile } = require('fs')
const { join, dirname, basename, extname, resolve } = require('path')
const { extractSourcemap, SOURCEMAP_IN_DIFFERENT_FILE } = visualiser
const writeFileAsync = promisify(writeFile)
const readFileAsync = promisify(readFile)
const accessAsync = promisify(access)
const mkdirAsync = promisify(mkdir)

/* :: type options = {
  files: string[],
  directory?: string|false,
  title: string,
}*/

const help = (additionalMessage) => `
${ additionalMessage ? `${ additionalMessage }\n\n` : '' }
Usage: ${ pkg.name } [options] <files>

Options:
  --help, -h         Show help                                         [boolean]
  --version, -V, -v  Show version number                               [boolean]
  --dir, -d <dir>    Output directory                                   [string]

Examples:

  ${ pkg.name } src/ # Find all sourcemaps in 'src/' and output html files next to them
  ${ pkg.name } -d viz src/ # Find all sourcemaps in 'src/' and output html files to 'viz/'
`

// eslint-disable-next-line complexity
module.exports.opts = (argv /* : string[]*/) => {
  let files = []
  let directory = false
  let title = ''
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg[0] === '-' && arg[1] !== '-' && arg.length > 2) {
      argv = argv.slice(0, i).concat(arg.split('').slice(1).map((flag) => `-${ flag }`)).concat(argv.slice(i + 1))
    }
    switch (arg) {
      case '--':
        files = files.concat(argv.slice(i + 1))
        i = Infinity
        break
      case '--help':
      case '-h':
        throw new Error(help())
      case '--version':
      case '-v':
      case '-V':
        process.stdout.write(`${ pkg.version }\n\n`)
        throw new Error(help())
      case '-d':
      case '--dir':
        directory = argv[(i += 1)]
        break
      case '-t':
      case '--title':
        title = argv[(i += 1)]
        break
      default:
        if (arg[0] === '-') {
          throw new Error(help(`unknown flag ${ arg }`))
        }
        files.push(arg)
        break
    }
  }
  if (files.length === 0) {
    throw new Error(help('Please specify files to read'))
  }
  return { directory, files, title }
}

module.exports.cli = async (
  stdout /* : stream$Writable*/,
  stderr /* : stream$Writable*/,
  { directory, files, title } /* : options*/
) => {
  const now = Date.now()
  if (directory) {
    try {
      const readableDirectoryMask = 0o7
      await accessAsync(directory, readableDirectoryMask)
    } catch (accessError) {
      const readableDirectory = 0o777
      await mkdirAsync(directory, readableDirectory)
    }
  }
  await Promise.all(files.map(async (file) => {
    const contents = await readFileAsync(file, 'utf-8')
    // generate
    let sourcemap = null
    try {
      sourcemap = extractSourcemap(contents)
    } catch (extractError) {
      if (extractError.code === SOURCEMAP_IN_DIFFERENT_FILE) {
        sourcemap = JSON.parse(await readFileAsync(resolve(dirname(file), extractError.matches[1])))
      } else {
        throw extractError
      }
    }
    const htmlFile = join(directory || dirname(file), `${ basename(file, extname(file)) }.html`)
    await writeFileAsync(htmlFile, await visualiser(sourcemap, { title }), 'utf-8')
  }))
  stderr.write(`Finished in ${ Date.now() - now }ms`)
}

if (require.main === module) {
  const { opts, cli } = module.exports
  cli(process.stdout, process.stderr, opts(process.argv.slice(2)))
    .catch((cliError) => {
      process.stderr.write(cliError.message || cliError)
      process.stderr.write('\n')
      if (cliError.stack) {
        process.stderr.write(cliError.stack)
      }
      // eslint-disable-next-line no-process-exit
      process.exit(1)
    })
}
